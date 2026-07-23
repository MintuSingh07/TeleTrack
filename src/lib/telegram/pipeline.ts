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

export async function downloadSingleSegment(
  sessionString: string,
  video: IVideoDocument,
  segmentIndex: number
): Promise<Buffer> {
  const cachePath = getSegmentCachePath(video.telegramChatId, video.telegramMessageId, segmentIndex);

  if (fs.existsSync(cachePath)) {
    try {
      return await fs.promises.readFile(cachePath);
    } catch (e) {
      // Fallback
    }
  }

  const segmentStartOffset = segmentIndex * SEGMENT_SIZE;
  const fileSize = video.fileSize || 0;

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
  const chunkSize = 1024 * 1024; // 1MB max per Telegram MTProto upload.getFile RPC

  for (let currentOffset = segmentStartOffset; currentOffset < segmentEndOffset; currentOffset += chunkSize) {
    const alignedOffset = Math.floor(currentOffset / 4096) * 4096;
    const bytesNeeded = segmentEndOffset - currentOffset;
    // CRITICAL FIX: Align limit to 4096-byte boundary so Telegram MTProto upload.getFile RPC never rejects unaligned end bytes
    const requestLimit = Math.min(chunkSize, Math.ceil(bytesNeeded / 4096) * 4096 || 4096);

    const fileResult: any = await client.invoke(
      new Api.upload.GetFile({
        location: new Api.InputDocumentFileLocation({
          id: mediaDoc.id,
          accessHash: mediaDoc.accessHash,
          fileReference: mediaDoc.fileReference,
          thumbSize: '',
        }),
        offset: bigInt(alignedOffset),
        limit: requestLimit,
      })
    );

    if (fileResult && fileResult.bytes) {
      const rawBuf = Buffer.from(fileResult.bytes);
      const offsetDelta = currentOffset - alignedOffset;
      const validBytes = rawBuf.subarray(offsetDelta, offsetDelta + bytesNeeded);
      chunkBuffers.push(validBytes);
    }
  }

  const fullSegmentBuffer = Buffer.concat(chunkBuffers).subarray(0, totalSegmentBytes);
  if (fullSegmentBuffer.length > 0) {
    await fs.promises.writeFile(cachePath, fullSegmentBuffer).catch(() => {});
  }

  return fullSegmentBuffer;
}

/**
 * Aggressive Multi-Connection Parallel Downloader:
 * Launches 4 independent GramJS workers downloading Segments 0, 1, 2, 3... simultaneously.
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
    const CONCURRENT_WORKERS = 4;

    const workerPromises = Array.from({ length: CONCURRENT_WORKERS }, async (_, workerIndex) => {
      const client = createTelegramClient(sessionString);
      await client.connect();

      try {
        const dialogs = await client.getDialogs({});
        const foundInDialogs = dialogs.find((d: any) => {
          if (!d.entity) return false;
          const idStr = d.entity.id?.toString() || d.entity.channelId?.toString();
          return idStr === video.telegramChatId;
        });

        const entity = foundInDialogs ? foundInDialogs.entity : await client.getEntity(video.telegramChatId);
        const messages = await client.getMessages(entity, { ids: [video.telegramMessageId] });

        const message = messages[0];
        if (!message || !message.media) return;

        const mediaDoc = (message.media as any).document;
        if (!mediaDoc) return;

        for (let seg = workerIndex; seg < totalSegments; seg += CONCURRENT_WORKERS) {
          const cachePath = getSegmentCachePath(video.telegramChatId, video.telegramMessageId, seg);
          if (fs.existsSync(cachePath)) continue;

          const segmentStartOffset = seg * SEGMENT_SIZE;
          const segmentEndOffset = Math.min(segmentStartOffset + SEGMENT_SIZE, fileSize);
          const totalSegmentBytes = segmentEndOffset - segmentStartOffset;
          const chunkBuffers: Buffer[] = [];
          const chunkSize = 1024 * 1024;

          for (let currentOffset = segmentStartOffset; currentOffset < segmentEndOffset; currentOffset += chunkSize) {
            const alignedOffset = Math.floor(currentOffset / 4096) * 4096;
            const bytesNeeded = segmentEndOffset - currentOffset;
            const requestLimit = Math.min(chunkSize, Math.ceil(bytesNeeded / 4096) * 4096 || 4096);

            const fileResult: any = await client.invoke(
              new Api.upload.GetFile({
                location: new Api.InputDocumentFileLocation({
                  id: mediaDoc.id,
                  accessHash: mediaDoc.accessHash,
                  fileReference: mediaDoc.fileReference,
                  thumbSize: '',
                }),
                offset: bigInt(alignedOffset),
                limit: requestLimit,
              })
            );

            if (fileResult && fileResult.bytes) {
              const rawBuf = Buffer.from(fileResult.bytes);
              const offsetDelta = currentOffset - alignedOffset;
              const validBytes = rawBuf.subarray(offsetDelta, offsetDelta + bytesNeeded);
              chunkBuffers.push(validBytes);
            }
          }

          const fullSegmentBuffer = Buffer.concat(chunkBuffers).subarray(0, totalSegmentBytes);
          if (fullSegmentBuffer.length > 0) {
            await fs.promises.writeFile(cachePath, fullSegmentBuffer).catch(() => {});
          }
        }
      } catch (workerErr) {
        // Log quietly
      } finally {
        await client.disconnect().catch(() => {});
      }
    });

    await Promise.all(workerPromises);
  } catch (error) {
    console.error(`Pipeline download error for ${video.title}:`, error);
  } finally {
    activePipelines.delete(pipelineKey);
  }
}
