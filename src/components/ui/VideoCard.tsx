'use client';

import Link from 'next/link';
import { Play, Star, Clock, Calendar, CheckCircle2, Eye, FileText, Download, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { IVideo } from '@/types';
import { useState } from 'react';

interface VideoCardProps {
  video: IVideo;
  onFavoriteToggle?: (videoId: string, isFav: boolean) => void;
}

export function VideoCard({ video, onFavoriteToggle }: VideoCardProps) {
  const progress = video.progress || {
    status: 'not_started',
    watchPercentage: 0,
    isFavorite: false,
  };

  const [isFavorite, setIsFavorite] = useState(progress.isFavorite);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextFav = !isFavorite;
    setIsFavorite(nextFav);
    if (onFavoriteToggle) {
      onFavoriteToggle(video._id, nextFav);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const mediaType = video.mediaType || 'video';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 p-5 shadow-lg flex flex-col justify-between space-y-4 transition-all"
    >
      {/* Top Row: Title + Favorite Star */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/video/${video._id}`} className="flex items-start gap-2.5 group-hover:text-cyan-400 transition-colors flex-1 min-w-0">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0 mt-0.5">
              {mediaType === 'video' ? (
                <PlayCircle className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4 text-rose-400" />
              )}
            </div>

            <h3 className="font-semibold text-sm text-slate-100 line-clamp-2 leading-snug tracking-tight">
              {video.title}
            </h3>
          </Link>

          {/* Favorite Toggle Star */}
          <button
            onClick={handleFavoriteClick}
            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
            title={isFavorite ? 'Remove favorite' : 'Add favorite'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Metadata Pills: Status, Date, Duration / Size */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono pt-1">
          {progress.status === 'completed' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" /> Completed
            </span>
          )}
          {progress.status === 'watching' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Eye className="w-3 h-3" /> Watching
            </span>
          )}

          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
            <Calendar className="w-3 h-3 text-slate-500" />
            {formatDate(video.uploadDate)}
          </span>

          {video.duration > 0 ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-cyan-400">
              <Clock className="w-3 h-3" />
              {formatDuration(video.duration)}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
              {formatFileSize(video.fileSize)}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Row: Watch Progress Bar + Direct Action Link */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-slate-400">Progress</span>
          <span className="font-semibold text-cyan-400">{progress.watchPercentage}%</span>
        </div>

        <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              progress.status === 'completed'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-cyan-500 to-blue-500'
            }`}
            style={{ width: `${progress.watchPercentage}%` }}
          />
        </div>

        <Link
          href={`/video/${video._id}`}
          className="mt-2 w-full py-2 rounded-xl bg-slate-950 hover:bg-cyan-500/10 text-cyan-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
        >
          {mediaType === 'video' ? (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Watch Video</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Open PDF</span>
            </>
          )}
        </Link>
      </div>
    </motion.div>
  );
}
