import { createTelegramClient, getConnectedTelegramClient } from './client';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { IVideoDocument, VideoModel } from '@/models/Video';
import { ProgressModel } from '@/models/Progress';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.next', 'cache', 'telegram_media');
export const SEGMENT_SIZE = 4194304; // 4 MB per segment

if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch (e) {
    // Ignore
  }
}

const activePipelines = new Set<string>();

export function getSegmentCachePath(telegramChatId: string, telegramMessageId: number, segmentIndex: number): string {
  const alignedOffset = segmentIndex * SEGMENT_SIZE;
  return path.join(CACHE_DIR, `${telegramChatId}_${telegramMessageId}_seg_${segmentIndex}_${alignedOffset}.bin`);
}

/**
 * Automatically cleans up local disk cache files for videos that were completed 1+ hour ago.
 */
export async function cleanExpiredVideoCaches() {
  try {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const expiredProgressList = await ProgressModel.find({
      status: 'completed',
      completedAt: { $lte: oneHourAgo },
    }).lean();

    if (!expiredProgressList || expiredProgressList.length === 0) return;

    const videoIds = expiredProgressList.map((p) => p.videoId);
    const completedVideos = await VideoModel.find({ _id: { $in: videoIds } }, 'telegramChatId telegramMessageId').lean();

    if (!fs.existsSync(CACHE_DIR)) return;
    const files = await fs.promises.readdir(CACHE_DIR);

    for (const vid of completedVideos) {
      const prefix = `${vid.telegramChatId}_${vid.telegramMessageId}_`;
      for (const file of files) {
        if (file.startsWith(prefix)) {
          const filePath = path.join(CACHE_DIR, file);
          await fs.promises.unlink(filePath).catch(() => {});
        }
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
}

/**
 * Robust segment downloader.
 *
 * KEY INSIGHT: Telegram's upload.getFile limit must be a multiple of 4096 AND
 * a power-of-two multiple of 1024 in practice. Using a fixed 1MB (1048576)
 * limit ALWAYS satisfies this. Telegram returns min(limit, remaining_bytes)
 * so requesting 1MB at end-of-file just returns the remaining bytes.
 *
 * Previous attempts to "clamp" the limit to fileSize caused it to become
 * a non-power-of-two value that Telegram silently rejected.
 */
export async function downloadSingleSegment(
  sessionString: string,
  video: IVideoDocument,
  segmentIndex: number
): Promise<Buffer> {
  const cachePath = getSegmentCachePath(video.telegramChatId, video.telegramMessageId, segmentIndex);
  const fileSize = video.fileSize || 0;
  const segmentStartOffset = segmentIndex * SEGMENT_SIZE;

  // Validate cache: check it exists AND has the correct expected size
  if (fs.existsSync(cachePath)) {
    try {
      const stats = await fs.promises.stat(cachePath);
      const expectedSize = fileSize > 0
        ? Math.min(SEGMENT_SIZE, fileSize - segmentStartOffset)
        : SEGMENT_SIZE;
      if (stats.size >= expectedSize) {
        return await fs.promises.readFile(cachePath);
      }
      // Cache file exists but is incomplete — delete and re-download
      await fs.promises.unlink(cachePath).catch(() => {});
    } catch (e) {
      // Fallback to download
    }
  }

  if (fileSize > 0 && segmentStartOffset >= fileSize) {
    return Buffer.alloc(0);
  }

  const segmentEndOffset = fileSize > 0 ? Math.min(segmentStartOffset + SEGMENT_SIZE, fileSize) : segmentStartOffset + SEGMENT_SIZE;
  const totalSegmentBytes = segmentEndOffset - segmentStartOffset;

  if (totalSegmentBytes <= 0) return Buffer.alloc(0);

  const client = await getConnectedTelegramClient(sessionString);
  const dialogs = await client.getDialogs({});
  const foundInDialogs = dialogs.find((d: any) => {
    if (!d.entity) return false;
    const idStr = d.entity.id?.toString() || d.entity.channelId?.toString();
    return idStr === video.telegramChatId;
  });

  const entity = foundInDialogs ? foundInDialogs.entity : await client.getEntity(video.telegramChatId);
  const messages = await client.getMessages(entity, { ids: [video.telegramMessageId] });

  const message = messages[0];
  if (!message || !message.media) return Buffer.alloc(0);

  const mediaDoc = (message.media as any).document;
  if (!mediaDoc) return Buffer.alloc(0);

  const chunkBuffers: Buffer[] = [];
  // Always request exactly 1MB. This value is:
  //  - A multiple of 4096 ✓
  //  - A power-of-two multiple of 1024 ✓
  //  - Under the Telegram MTProto maximum of 1MB ✓
  // Telegram naturally returns fewer bytes when near end-of-file.
  const CHUNK_SIZE = 1048576; // 1MB — NEVER change this

  let bytesCollected = 0;

  for (let currentOffset = segmentStartOffset; currentOffset < segmentEndOffset; currentOffset += CHUNK_SIZE) {
    // offset must be 4KB-aligned (1MB-aligned offsets always satisfy this)
    const alignedOffset = Math.floor(currentOffset / 4096) * 4096;

    try {
      const fileResult: any = await client.invoke(
        new Api.upload.GetFile({
          location: new Api.InputDocumentFileLocation({
            id: mediaDoc.id,
            accessHash: mediaDoc.accessHash,
            fileReference: mediaDoc.fileReference,
            thumbSize: '',
          }),
          offset: bigInt(alignedOffset),
          limit: CHUNK_SIZE, // ALWAYS 1MB — Telegram returns fewer bytes at EOF
        })
      );

      if (fileResult && fileResult.bytes) {
        const rawBuf = Buffer.from(fileResult.bytes);

        if (rawBuf.length === 0) break; // End of file reached

        const offsetDelta = currentOffset - alignedOffset;
        const remainingInSegment = segmentEndOffset - currentOffset;
        const available = Math.max(0, rawBuf.length - offsetDelta);
        const take = Math.min(remainingInSegment, available);

        if (take > 0) {
          chunkBuffers.push(rawBuf.subarray(offsetDelta, offsetDelta + take));
          bytesCollected += take;
        }

        // If Telegram returned fewer bytes than requested, we've hit EOF
        if (rawBuf.length < CHUNK_SIZE) break;
      } else {
        break; // No data returned
      }
    } catch (rpcErr: any) {
      console.error(`[pipeline] GetFile RPC error seg=${segmentIndex} offset=${alignedOffset}:`, rpcErr?.message || rpcErr);
      break;
    }
  }

  const fullSegmentBuffer = Buffer.concat(chunkBuffers);

  if (fullSegmentBuffer.length > 0) {
    await fs.promises.writeFile(cachePath, fullSegmentBuffer).catch(() => {});
    console.log(`[pipeline] Cached segment ${segmentIndex} → ${fullSegmentBuffer.length} bytes (expected ${totalSegmentBytes})`);
  } else {
    console.error(`[pipeline] EMPTY segment ${segmentIndex} for "${video.title}" (expected ${totalSegmentBytes} bytes)`);
  }

  return fullSegmentBuffer;
}

/**
 * Sequential Pipeline Downloader:
 * Downloads all video segments (0 to totalSegments-1) sequentially.
 */
export async function startVideoDownloadPipeline(sessionString: string, video: IVideoDocument) {
  cleanExpiredVideoCaches().catch(() => {});

  const pipelineKey = `${video.telegramChatId}_${video.telegramMessageId}`;
  if (activePipelines.has(pipelineKey)) {
    return;
  }
  activePipelines.add(pipelineKey);

  try {
    const fileSize = video.fileSize || 0;
    if (fileSize <= 0) {
      activePipelines.delete(pipelineKey);
      return;
    }

    const totalSegments = Math.ceil(fileSize / SEGMENT_SIZE);
    console.log(`[pipeline] Starting download for "${video.title}" — ${totalSegments} segments, ${fileSize} bytes`);

    for (let seg = 0; seg < totalSegments; seg++) {
      const cachePath = getSegmentCachePath(video.telegramChatId, video.telegramMessageId, seg);

      // Validate existing cache
      if (fs.existsSync(cachePath)) {
        try {
          const stats = await fs.promises.stat(cachePath);
          const expectedSize = Math.min(SEGMENT_SIZE, fileSize - seg * SEGMENT_SIZE);
          if (stats.size >= expectedSize) {
            continue; // Already fully cached
          }
          // Incomplete — delete and re-download
          await fs.promises.unlink(cachePath).catch(() => {});
        } catch (e) {
          // Re-download
        }
      }

      try {
        await downloadSingleSegment(sessionString, video, seg);
      } catch (err: any) {
        console.error(`[pipeline] Error downloading segment ${seg} for "${video.title}":`, err?.message || err);
      }
    }

    console.log(`[pipeline] Finished download for "${video.title}"`);
  } catch (error: any) {
    console.error(`[pipeline] Pipeline error for "${video.title}":`, error?.message || error);
  } finally {
    activePipelines.delete(pipelineKey);
  }
}
