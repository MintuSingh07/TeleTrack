import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { VideoModel } from '@/models/Video';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDatabase();

    const video = await VideoModel.findById(id).select('thumbnailBuffer thumbnailMimeType').lean();
    if (!video || !video.thumbnailBuffer) {
      return NextResponse.json({ error: 'Thumbnail not available' }, { status: 404 });
    }

    return new NextResponse(video.thumbnailBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': video.thumbnailMimeType || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
