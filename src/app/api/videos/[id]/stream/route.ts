import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db/mongodb';
import { VideoModel } from '@/models/Video';
import { downloadVideoChunk } from '@/lib/telegram/stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session.isLoggedIn || !session.telegramSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const video = await VideoModel.findById(id);

    if (!video) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const fileSize = video.fileSize || 0;
    const rangeHeader = request.headers.get('range');
    const contentType = video.mimeType || (video.mediaType === 'pdf' ? 'application/pdf' : 'video/mp4');

    let start = 0;
    let end = fileSize > 0 ? fileSize - 1 : 0;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10) || 0;

      // Clamp start offset so it never exceeds end of file
      if (fileSize > 0 && start >= fileSize) {
        start = Math.max(0, fileSize - 1);
      }

      if (parts[1] && parts[1].trim() !== '') {
        end = parseInt(parts[1], 10);
      } else {
        // If end omitted (e.g. bytes=0-), request up to 2MB chunk, strictly capped at fileSize - 1
        end = fileSize > 0 ? Math.min(start + 2097152 - 1, fileSize - 1) : start + 2097152 - 1;
      }
    }

    if (fileSize > 0 && end >= fileSize) {
      end = fileSize - 1;
    }

    if (end < start) {
      end = start;
    }

    const limitBytes = end - start + 1;

    const chunk = await downloadVideoChunk({
      sessionString: session.telegramSession,
      video,
      offsetBytes: start,
      limitBytes,
    });

    if (!chunk || chunk.length === 0) {
      // Prevent 416 player freeze on end of file by returning 206 Partial Content
      return new NextResponse(Buffer.alloc(0) as unknown as BodyInit, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${start}/${fileSize || start + 1}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': '0',
          'Content-Type': contentType,
        },
      });
    }

    const actualEnd = start + chunk.length - 1;
    const totalSize = fileSize > 0 ? fileSize : actualEnd + 1;

    return new NextResponse(chunk as unknown as BodyInit, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${actualEnd}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk.length.toString(),
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': `inline; filename="${encodeURIComponent(video.fileName || video.title)}"`,
      },
    });
  } catch (error: any) {
    console.error('Media streaming error:', error);
    return NextResponse.json({ error: error.message || 'Streaming error' }, { status: 500 });
  }
}
