import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db/mongodb';
import { VideoModel } from '@/models/Video';
import { ProgressModel } from '@/models/Progress';
import { cleanExpiredVideoCaches } from '@/lib/telegram/pipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getEffectiveMediaType(v: any): 'video' | 'pdf' | 'audio' | 'image' | 'document' | 'other' {
  const mime = (v.mimeType || '').toLowerCase();
  const title = (v.title || '').toLowerCase();
  const fileName = (v.fileName || '').toLowerCase();

  const isVideoExt = /\.(mp4|mkv|mov|webm|avi|flv|m4v)$/i.test(title) || /\.(mp4|mkv|mov|webm|avi|flv|m4v)$/i.test(fileName);
  const isPdfExt = /\.pdf$/i.test(title) || /\.pdf$/i.test(fileName);

  if (v.duration > 0 || mime.startsWith('video/') || isVideoExt) return 'video';
  if (mime === 'application/pdf' || isPdfExt) return 'pdf';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  if (v.mediaType && ['video', 'pdf', 'audio', 'image', 'document', 'other'].includes(v.mediaType)) {
    return v.mediaType;
  }
  return 'other';
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();

    // Trigger 5-hour expired video cache cleanup
    cleanExpiredVideoCaches().catch(() => {});

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all | watching | completed | not_started | favorites
    const mediaType = searchParams.get('mediaType') || 'video'; // video (default) | pdf | other
    const sort = searchParams.get('sort') || 'upload_asc'; // upload_asc | upload_desc

    const itemQuery: any = {};

    if (search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      itemQuery.$or = [
        { title: searchRegex },
        { caption: searchRegex },
        { fileName: searchRegex },
      ];
    }

    let sortOption: any = { uploadDate: 1, telegramMessageId: 1 };
    if (sort === 'upload_desc' || filter === 'recently_added') {
      sortOption = { uploadDate: -1, telegramMessageId: -1 };
    }

    const items = await VideoModel.find(itemQuery).sort(sortOption).lean();

    // Fetch progress map across all user progress records
    const allProgressList = await ProgressModel.find().lean();
    const globalProgressMap = new Map();
    allProgressList.forEach((p) => {
      globalProgressMap.set(p.videoId.toString(), p);
    });

    let combined = items.map((v: any) => {
      const prog = globalProgressMap.get(v._id.toString()) || {
        status: 'not_started',
        watchPercentage: 0,
        lastPosition: 0,
        notes: '',
        rating: 0,
        isFavorite: false,
      };

      const computedMediaType = getEffectiveMediaType(v);
      const isCompleted = prog.status === 'completed';

      return {
        _id: v._id.toString(),
        telegramChatId: v.telegramChatId,
        telegramMessageId: v.telegramMessageId,
        mediaType: computedMediaType,
        title: v.title,
        caption: v.caption,
        uploadDate: v.uploadDate,
        duration: v.duration || 0,
        fileSize: v.fileSize || 0,
        mimeType: v.mimeType,
        fileName: v.fileName || '',
        thumbnailUrl: v.thumbnailBuffer ? `/api/videos/${v._id}/thumbnail` : null,
        progress: {
          status: prog.status,
          watchPercentage: isCompleted ? 100 : (prog.watchPercentage || 0),
          lastPosition: prog.lastPosition,
          lastWatchedAt: prog.lastWatchedAt,
          notes: prog.notes,
          rating: prog.rating,
          isFavorite: prog.isFavorite,
        },
      };
    });

    // Strictly separate items by section type
    if (mediaType === 'video') {
      combined = combined.filter((item) => item.mediaType === 'video');
    } else if (mediaType === 'pdf') {
      combined = combined.filter((item) => item.mediaType === 'pdf');
    } else if (mediaType === 'other') {
      combined = combined.filter((item) => item.mediaType !== 'video' && item.mediaType !== 'pdf');
    }

    // Apply progress-specific filters
    if (filter === 'watching') {
      combined = combined.filter((item) => item.progress.status === 'watching');
    } else if (filter === 'completed') {
      combined = combined.filter((item) => item.progress.status === 'completed');
    } else if (filter === 'not_started') {
      combined = combined.filter((item) => item.progress.status === 'not_started');
    } else if (filter === 'favorites') {
      combined = combined.filter((item) => item.progress.isFavorite);
    }

    // Calculate Global Statistics across all items in DB
    const allItems = await VideoModel.find({}, '_id mediaType mimeType title fileName duration').lean();

    let totalVideosCount = 0;
    let totalPdfsCount = 0;
    let totalOthersCount = 0;

    allItems.forEach((i: any) => {
      const type = getEffectiveMediaType(i);
      if (type === 'video') totalVideosCount++;
      else if (type === 'pdf') totalPdfsCount++;
      else totalOthersCount++;
    });

    let completedCount = 0;
    let watchingCount = 0;
    let favoritesCount = 0;
    let totalWatchedSeconds = 0;

    allProgressList.forEach((p: any) => {
      if (p.status === 'completed') completedCount++;
      if (p.status === 'watching') watchingCount++;
      if (p.isFavorite) favoritesCount++;
    });

    allItems.forEach((v: any) => {
      const p = globalProgressMap.get(v._id.toString());
      if (p) {
        const pct = p.status === 'completed' ? 100 : (p.watchPercentage || 0);
        if (v.duration && v.duration > 0) {
          totalWatchedSeconds += (v.duration * pct) / 100;
        }
      }
    });

    const totalItemsCount = allItems.length;
    const remainingCount = Math.max(0, totalItemsCount - completedCount);

    // Format completion percentage to 1 decimal place if < 1%, or rounded integer
    const rawPct = totalItemsCount > 0 ? (completedCount / totalItemsCount) * 100 : 0;
    const completionPercentage = rawPct > 0 && rawPct < 1 ? parseFloat(rawPct.toFixed(1)) : Math.round(rawPct);
    const totalHoursWatched = parseFloat((totalWatchedSeconds / 3600).toFixed(1));

    const stats = {
      totalVideos: totalVideosCount,
      totalPdfs: totalPdfsCount,
      totalOthers: totalOthersCount,
      completedVideos: completedCount,
      watchingVideos: watchingCount,
      remainingVideos: remainingCount,
      completionPercentage,
      totalHoursWatched,
      favoriteVideosCount: favoritesCount,
    };

    return NextResponse.json({
      videos: combined,
      stats,
    });
  } catch (error: any) {
    console.error('Fetch videos error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch media items' }, { status: 500 });
  }
}
