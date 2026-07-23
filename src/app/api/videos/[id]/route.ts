import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db/mongodb';
import { VideoModel } from '@/models/Video';
import { ProgressModel } from '@/models/Progress';
import { startVideoDownloadPipeline } from '@/lib/telegram/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    await connectToDatabase();

    const video = await VideoModel.findById(id);
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Instantly trigger aggressive background segment pipeline on video click
    if (session?.isLoggedIn && session.telegramSession) {
      startVideoDownloadPipeline(session.telegramSession, video).catch(() => {});
    }

    const progress = await ProgressModel.findOne({ videoId: video._id }).lean();

    return NextResponse.json({
      _id: video._id.toString(),
      telegramChatId: video.telegramChatId,
      telegramMessageId: video.telegramMessageId,
      mediaType: video.mediaType || 'video',
      title: video.title,
      caption: video.caption,
      uploadDate: video.uploadDate,
      duration: video.duration,
      fileSize: video.fileSize,
      mimeType: video.mimeType,
      fileName: video.fileName || '',
      streamUrl: `/api/videos/${video._id}/stream`,
      thumbnailUrl: video.thumbnailBuffer ? `/api/videos/${video._id}/thumbnail` : null,
      progress: {
        status: progress?.status || 'not_started',
        watchPercentage: progress?.watchPercentage || 0,
        lastPosition: progress?.lastPosition || 0,
        lastWatchedAt: progress?.lastWatchedAt,
        notes: progress?.notes || '',
        rating: progress?.rating || 0,
        isFavorite: progress?.isFavorite || false,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch video details' }, { status: 500 });
  }
}
