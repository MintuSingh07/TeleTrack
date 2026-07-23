import { startVideoDownloadPipeline, downloadSingleSegment, getSegmentCachePath, SEGMENT_SIZE } from './pipeline';
import { IVideoDocument } from '@/models/Video';
import fs from 'fs';

export async function downloadVideoChunk({
  sessionString,
  video,
  offsetBytes,
  limitBytes,
}: {
  sessionString: string;
  video: IVideoDocument;
  offsetBytes: number;
  limitBytes: number;
}): Promise<Buffer> {
  const fileSize = video.fileSize || 0;

  // Clamp request to file bounds
  if (fileSize > 0 && offsetBytes >= fileSize) {
    return Buffer.alloc(0);
  }
  if (fileSize > 0) {
    limitBytes = Math.min(limitBytes, fileSize - offsetBytes);
  }
  if (limitBytes <= 0) return Buffer.alloc(0);

  // Trigger sequential background download
  startVideoDownloadPipeline(sessionString, video).catch(() => {});

  const segmentIndex = Math.floor(offsetBytes / SEGMENT_SIZE);
  const segmentOffset = segmentIndex * SEGMENT_SIZE;
  const expectedSegmentSize = fileSize > 0
    ? Math.min(SEGMENT_SIZE, fileSize - segmentOffset)
    : SEGMENT_SIZE;

  // Helper: read segment from cache with size validation
  const readCachedSegment = async (segIdx: number): Promise<Buffer | null> => {
    const cachePath = getSegmentCachePath(video.telegramChatId, video.telegramMessageId, segIdx);
    if (!fs.existsSync(cachePath)) return null;
    try {
      const buf = await fs.promises.readFile(cachePath);
      const segOff = segIdx * SEGMENT_SIZE;
      const expected = fileSize > 0 ? Math.min(SEGMENT_SIZE, fileSize - segOff) : SEGMENT_SIZE;
      if (buf.length >= expected) return buf;
      // Incomplete cache — delete it
      await fs.promises.unlink(cachePath).catch(() => {});
      return null;
    } catch (e) {
      return null;
    }
  };

  // 1. Instant SSD Read: If segment is fully downloaded, serve immediately
  const cached = await readCachedSegment(segmentIndex);
  if (cached) {
    const startInSegment = offsetBytes - segmentOffset;
    const available = Math.max(0, cached.length - startInSegment);
    return cached.subarray(startInSegment, startInSegment + Math.min(limitBytes, available));
  }

  // 2. Poll SSD cache for up to 5 seconds for pipeline to finish writing this segment
  let attempts = 0;
  while (attempts < 25) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const polled = await readCachedSegment(segmentIndex);
    if (polled) {
      const startInSegment = offsetBytes - segmentOffset;
      const available = Math.max(0, polled.length - startInSegment);
      return polled.subarray(startInSegment, startInSegment + Math.min(limitBytes, available));
    }
    attempts++;
  }

  // 3. Fallback: directly download this single segment
  try {
    const segmentBuffer = await downloadSingleSegment(sessionString, video, segmentIndex);
    if (segmentBuffer && segmentBuffer.length > 0) {
      const startInSegment = offsetBytes - segmentOffset;
      const available = Math.max(0, segmentBuffer.length - startInSegment);
      return segmentBuffer.subarray(startInSegment, startInSegment + Math.min(limitBytes, available));
    }
  } catch (err) {
    console.error('[stream] Fallback segment fetch error:', err);
  }

  return Buffer.alloc(0);
}
