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
    let limitBytes = 2097152; // 2MB buffer per streaming chunk for smooth zero-buffering playback

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10) || 0;
      if (parts[1]) {
        const endReq = parseInt(parts[1], 10);
        limitBytes = Math.max(524288, endReq - start + 1);
      }
    }

    const chunk = await downloadVideoChunk({
      sessionString: session.telegramSession,
      video,
      offsetBytes: start,
      limitBytes,
    });

    if (!chunk || chunk.length === 0) {
      return new NextResponse(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
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
