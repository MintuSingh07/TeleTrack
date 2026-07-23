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
  // Trigger 4-worker parallel background download
  startVideoDownloadPipeline(sessionString, video).catch(() => {});

  const segmentIndex = Math.floor(offsetBytes / SEGMENT_SIZE);
  const cachePath = getSegmentCachePath(video.telegramChatId, video.telegramMessageId, segmentIndex);
  const segmentOffset = segmentIndex * SEGMENT_SIZE;

  // 1. Instant SSD Read: If segment is downloaded by background workers, serve in < 1ms
  if (fs.existsSync(cachePath)) {
    try {
      const cachedSegment = await fs.promises.readFile(cachePath);
      const startInSegment = offsetBytes - segmentOffset;
      return cachedSegment.subarray(startInSegment, startInSegment + limitBytes);
    } catch (e) {
      // Fallback
    }
  }

  // 2. Poll SSD cache for up to 3 seconds for active parallel workers to finish writing segment
  let attempts = 0;
  while (attempts < 15) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (fs.existsSync(cachePath)) {
      try {
        const cachedSegment = await fs.promises.readFile(cachePath);
        const startInSegment = offsetBytes - segmentOffset;
        return cachedSegment.subarray(startInSegment, startInSegment + limitBytes);
      } catch (e) {
        // Retry
      }
    }
    attempts++;
  }

  // 3. Fallback direct segment download
  try {
    const segmentBuffer = await downloadSingleSegment(sessionString, video, segmentIndex);
    if (segmentBuffer && segmentBuffer.length > 0) {
      const startInSegment = offsetBytes - segmentOffset;
      return segmentBuffer.subarray(startInSegment, startInSegment + limitBytes);
    }
  } catch (err) {
    console.error('Fallback segment fetch error:', err);
  }

  return Buffer.alloc(0);
}
