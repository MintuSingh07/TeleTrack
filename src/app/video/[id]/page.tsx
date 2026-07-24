'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Clock,
  Calendar,
  CheckCircle2,
  Save,
  FileText,
  Download,
  Eye,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
} from 'lucide-react';
import { Navbar } from '@/components/ui/Navbar';
import { IVideo } from '@/types';

export default function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [video, setVideo] = useState<IVideo | null>(null);
  const [authData, setAuthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isEnded, setIsEnded] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState('');

  // Local state for interactive controls
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [watchPercentage, setWatchPercentage] = useState(0);
  const [status, setStatus] = useState<'not_started' | 'watching' | 'completed'>('not_started');

  // Visual feedback state for keyboard shortcuts (+5s, -5s, Play, Pause)
  const [feedback, setFeedback] = useState<{
    type: 'forward' | 'rewind' | 'play' | 'pause';
    id: number;
  } | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerFeedback = (type: 'forward' | 'rewind' | 'play' | 'pause') => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ type, id: Date.now() });
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
    }, 700);
  };

  const isPdf = video?.mediaType === 'pdf' || video?.mimeType === 'application/pdf';

  const fetchVideoDetails = async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      if (authRes.status === 401) {
        router.push('/login');
        return;
      }
      const authInfo = await authRes.json();
      setAuthData(authInfo);

      const videoRes = await fetch(`/api/videos/${id}`);
      if (!videoRes.ok) throw new Error('Resource not found');
      const data: IVideo = await videoRes.json();

      setVideo(data);
      if (data.progress) {
        setNotes(data.progress.notes || '');
        setRating(data.progress.rating || 0);
        setIsFavorite(data.progress.isFavorite || false);
        setWatchPercentage(data.progress.watchPercentage || 0);
        setStatus(data.progress.status || 'not_started');
      }
    } catch (err) {
      console.error('Error loading video page:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideoDetails();
  }, [id]);

  // Global Keyboard Shortcuts Listener:
  // Right Arrow: +5s | Left Arrow: -5s | Space: Pause/Play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when user is typing in text inputs or textareas
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (!videoRef.current || isPdf) return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
          triggerFeedback('play');
        } else {
          videoRef.current.pause();
          triggerFeedback('pause');
        }
      } else if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
        e.preventDefault();
        const duration = videoRef.current.duration || video?.duration || 0;
        videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
        triggerFeedback('forward');
      } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
        e.preventDefault();
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
        triggerFeedback('rewind');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [video, isPdf]);

  // Automatically attempt playback when video element and data are ready
  const handleVideoLoaded = () => {
    setIsVideoLoading(false);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  };

  // Handle video timeupdate: progress automatically increases in line with actual video playback time
  const handleTimeUpdate = () => {
    if (!videoRef.current || !video?.duration) return;
    const currentTime = videoRef.current.currentTime;
    const pct = Math.min(100, Math.round((currentTime / video.duration) * 100));

    setWatchPercentage(pct);

    let nextStatus = status;
    if (pct >= 90) {
      nextStatus = 'completed';
    } else if (pct > 0 && status === 'not_started') {
      nextStatus = 'watching';
    }
    setStatus(nextStatus);
  };

  // Save progress changes to API
  const saveProgress = async (fields: Record<string, any>) => {
    try {
      const res = await fetch(`/api/progress/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.progress) {
        setStatus(data.progress.status);
        setWatchPercentage(data.progress.watchPercentage);
      }
    } catch (err) {
      console.error('Save progress error:', err);
    }
  };

  const handlePause = () => {
    if (!videoRef.current) return;
    saveProgress({
      watchPercentage,
      lastPosition: Math.round(videoRef.current.currentTime),
      status,
    });
  };

  const handleVideoEnded = () => {
    setIsEnded(true);
    setIsVideoLoading(false);
    setStatus('completed');
    setWatchPercentage(100);
    saveProgress({
      watchPercentage: 100,
      status: 'completed',
      lastPosition: video?.duration || 0,
    });
  };

  const handleReplay = () => {
    setIsEnded(false);
    setIsVideoLoading(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handlePlayEvent = () => {
    setIsEnded(false);
    setIsVideoLoading(false);
    // If video ended or near end, restart from beginning
    if (videoRef.current && video?.duration && videoRef.current.currentTime >= video.duration - 1) {
      videoRef.current.currentTime = 0;
    }
  };

  // Explicit Toggle "Mark as Complete" Action
  const handleToggleComplete = () => {
    const isComp = status === 'completed';
    const nextStatus = isComp ? 'not_started' : 'completed';
    const nextPct = isComp ? 0 : 100;
    setStatus(nextStatus);
    setWatchPercentage(nextPct);
    saveProgress({ status: nextStatus, watchPercentage: nextPct });
  };

  const handleRatingClick = (newRating: number) => {
    setRating(newRating);
    saveProgress({ rating: newRating });
  };

  const handleFavoriteToggle = () => {
    const nextFav = !isFavorite;
    setIsFavorite(nextFav);
    saveProgress({ isFavorite: nextFav });
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    setNotesMessage('');
    await saveProgress({ notes });
    setSavingNotes(false);
    setNotesMessage('Notes saved!');
    setTimeout(() => setNotesMessage(''), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <p className="text-sm text-slate-400 mb-4">Resource details could not be loaded.</p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar user={authData?.user} channel={authData?.channel} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Back Link & Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          {/* Status Badge & Mark as Complete Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleComplete}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-md ${
                status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/20'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{status === 'completed' ? 'Marked as Complete' : 'Mark as Complete'}</span>
            </button>

            {status === 'completed' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Completed
              </span>
            )}
            {status === 'watching' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Eye className="w-3.5 h-3.5" /> In Progress ({watchPercentage}%)
              </span>
            )}
            {status === 'not_started' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                Not Started
              </span>
            )}
          </div>
        </div>

        {/* Main Media Streaming Container (Video Player or PDF Viewer) */}
        <div className="rounded-3xl bg-slate-950 border border-slate-800/80 overflow-hidden shadow-2xl relative">
          {isPdf ? (
            <div className="flex flex-col items-center justify-center p-8 bg-slate-900/60 min-h-[450px]">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white mb-1 text-center">{video.title}</h2>
              <p className="text-xs text-slate-400 font-mono mb-6">
                PDF Document • {(video.fileSize / (1024 * 1024)).toFixed(2)} MB
              </p>

              <div className="flex items-center gap-3">
                <a
                  href={`/api/videos/${video._id}/stream`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all"
                >
                  <Eye className="w-4 h-4" />
                  <span>Open & Read PDF</span>
                </a>

                <a
                  href={`/api/videos/${video._id}/stream`}
                  download={video.fileName || `${video.title}.pdf`}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 transition-all"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <span>Download File</span>
                </a>
              </div>

              {/* Embedded PDF iframe preview */}
              <iframe
                src={`/api/videos/${video._id}/stream`}
                className="w-full h-[500px] mt-6 rounded-2xl border border-slate-800 bg-white"
                title={video.title}
              />
            </div>
          ) : (
            <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden group">
              {/* Simple & Minimal Video Loading Overlay */}
              {isVideoLoading && !isEnded && watchPercentage < 95 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/75 backdrop-blur-sm transition-opacity duration-300">
                  <div className="w-10 h-10 rounded-full border-3 border-cyan-500/20 border-t-cyan-400 animate-spin mb-2" />
                  <span className="text-xs font-medium text-slate-300 tracking-wide">Loading video...</span>
                </div>
              )}

              {/* Keyboard Action Feedback Overlay Visualizations */}
              {feedback && (
                <div className="absolute inset-0 z-25 pointer-events-none flex items-center justify-center">
                  {feedback.type === 'forward' && (
                    <div className="absolute right-12 flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 text-cyan-400 shadow-2xl animate-bounce">
                      <FastForward className="w-6 h-6 fill-cyan-400/20" />
                      <span className="text-sm font-bold font-mono tracking-wider">+5s</span>
                    </div>
                  )}

                  {feedback.type === 'rewind' && (
                    <div className="absolute left-12 flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 text-cyan-400 shadow-2xl animate-bounce">
                      <Rewind className="w-6 h-6 fill-cyan-400/20" />
                      <span className="text-sm font-bold font-mono tracking-wider">-5s</span>
                    </div>
                  )}

                  {feedback.type === 'play' && (
                    <div className="p-5 rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 text-cyan-400 shadow-2xl animate-ping">
                      <Play className="w-8 h-8 fill-current" />
                    </div>
                  )}

                  {feedback.type === 'pause' && (
                    <div className="p-5 rounded-full bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 text-cyan-400 shadow-2xl">
                      <Pause className="w-8 h-8 fill-current" />
                    </div>
                  )}
                </div>
              )}

              {/* Video Replay Overlay */}
              {isEnded && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md">
                  <div className="p-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 mb-3">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Video Completed!</h3>
                  <p className="text-xs text-slate-400 mb-5">You have finished watching this video.</p>
                  <button
                    onClick={handleReplay}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/25 flex items-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Watch Again (Replay)</span>
                  </button>
                </div>
              )}

              <video
                ref={videoRef}
                src={`/api/videos/${video._id}/stream`}
                controls
                autoPlay
                onLoadStart={() => {
                  if (watchPercentage < 95 && !isEnded) setIsVideoLoading(true);
                }}
                onWaiting={() => {
                  if (watchPercentage < 95 && !isEnded) setIsVideoLoading(true);
                }}
                onCanPlay={() => setIsVideoLoading(false)}
                onPlaying={handlePlayEvent}
                onPlay={handlePlayEvent}
                onLoadedData={handleVideoLoaded}
                onTimeUpdate={handleTimeUpdate}
                onPause={handlePause}
                onEnded={handleVideoEnded}
                poster={video.thumbnailUrl || undefined}
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Details & Control Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Metadata & Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-xl font-bold text-white leading-snug">{video.title}</h1>

                {/* Favorite Toggle */}
                <button
                  onClick={handleFavoriteToggle}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isFavorite
                      ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-amber-400'
                  }`}
                  title="Favorite item"
                >
                  <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
              </div>

              {/* Metadata Pills */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  {new Date(video.uploadDate).toLocaleDateString()}
                </span>

                {video.duration > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    {formatDuration(video.duration)}
                  </span>
                )}

                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                  {(video.fileSize / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>

              {/* Keyboard Shortcuts Hint */}
              <div className="pt-3 flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-800/60">
                <span className="font-semibold text-slate-300">Shortcuts:</span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-mono text-[10px]">
                    ←
                  </kbd>{' '}
                  -5s
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-mono text-[10px]">
                    →
                  </kbd>{' '}
                  +5s
                </span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-mono text-[10px]">
                    Space
                  </kbd>{' '}
                  Play / Pause
                </span>
              </div>

              {/* Caption Description */}
              {video.caption && (
                <div className="pt-3 border-t border-slate-800 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {video.caption}
                </div>
              )}
            </div>

            {/* Non-draggable Progress Bar Indicator & Mark as Complete Action */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <span>{isPdf ? 'Reading Progress' : 'Watch Progress'}</span>
                <span className="text-cyan-400 font-mono text-sm">{watchPercentage}%</span>
              </div>

              {/* Read-only Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800/80 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    status === 'completed'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                  style={{ width: `${watchPercentage}%` }}
                />
              </div>

              {/* Mark as Complete Action Button */}
              <button
                onClick={handleToggleComplete}
                className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  status === 'completed'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/20'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{status === 'completed' ? 'Marked as Complete (Click to undo)' : 'Mark as Complete'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Rating & Personal Notes */}
          <div className="space-y-6">
            {/* Star Rating Card */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Your Rating</h2>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRatingClick(star)}
                    className="p-1 text-slate-600 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Personal Notes Card */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Personal Notes</span>
                </h2>
                {notesMessage && <span className="text-[11px] text-emerald-400 font-mono">{notesMessage}</span>}
              </div>

              <textarea
                rows={8}
                placeholder="Add your key takeaways, timestamps, or summary notes here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed"
              />

              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-cyan-400" />
                <span>{savingNotes ? 'Saving...' : 'Save Notes'}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
