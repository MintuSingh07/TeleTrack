'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/ui/Navbar';
import { StatCard } from '@/components/ui/StatCard';
import { VideoCard } from '@/components/ui/VideoCard';
import {
  Search,
  Video,
  CheckCircle,
  Clock,
  Star,
  Percent,
  ListFilter,
  RefreshCw,
  FileText,
  ArrowDownUp,
  Layers,
  Grid,
} from 'lucide-react';
import { IVideo, IDashboardStats } from '@/types';

export default function DashboardPage() {
  const router = useRouter();

  const [authData, setAuthData] = useState<any>(null);
  const [videos, setVideos] = useState<IVideo[]>([]);
  const [stats, setStats] = useState<IDashboardStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSection, setActiveSection] = useState<'video' | 'pdf'>('video'); // Only Videos and PDFs
  const [sortOrder, setSortOrder] = useState<'upload_asc' | 'upload_desc'>('upload_asc'); // upload_asc = Upload Order (#1, #2...)
  const [groupByModule, setGroupByModule] = useState(true); // Group items by 01_... module sequences

  const loadDashboardData = async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      if (authRes.status === 401) {
        router.push('/login');
        return;
      }
      const authInfo = await authRes.json();
      setAuthData(authInfo);

      if (!authInfo.hasChannel) {
        router.push('/setup');
        return;
      }

      // Fetch items & stats
      const queryParams = new URLSearchParams();
      if (search) queryParams.set('search', search);
      if (activeFilter) queryParams.set('filter', activeFilter);
      if (activeSection) queryParams.set('mediaType', activeSection);
      if (sortOrder) queryParams.set('sort', sortOrder);

      const videosRes = await fetch(`/api/videos?${queryParams.toString()}`);
      const data = await videosRes.json();

      setVideos(data.videos || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [search, activeFilter, activeSection, sortOrder]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      await loadDashboardData();
    } catch (err) {
      console.error('Manual sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFavoriteToggle = async (videoId: string, isFav: boolean) => {
    try {
      await fetch(`/api/progress/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: isFav }),
      });
      loadDashboardData();
    } catch (err) {
      console.error('Favorite toggle error:', err);
    }
  };

  // Dynamically group items into course modules whenever a title starts with "01_" or "01 "
  const groupedModules = useMemo(() => {
    if (!groupByModule || videos.length === 0) return [];

    const modules: { id: number; title: string; videos: IVideo[] }[] = [];
    let currentModule: { id: number; title: string; videos: IVideo[] } | null = null;
    let moduleCounter = 1;

    for (const item of videos) {
      // Check if video title starts with "01_", "01 -", "01.", or "01 "
      const isNewModuleStart = /^01[_\s\.\-]/i.test(item.title) || item.title.startsWith('01_');

      if (isNewModuleStart || !currentModule) {
        // Format clean module title from first video title
        const cleanTopic = item.title
          .replace(/^01[_\s\.\-]+/i, '')
          .replace(/_/g, ' ')
          .trim();

        const moduleTitle = cleanTopic ? `Module ${moduleCounter}: ${cleanTopic}` : `Module ${moduleCounter}`;

        currentModule = {
          id: moduleCounter,
          title: moduleTitle,
          videos: [item],
        };
        modules.push(currentModule);
        moduleCounter++;
      } else {
        currentModule.videos.push(item);
      }
    }

    return modules;
  }, [videos, groupByModule]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mb-3" />
        <span className="text-xs font-mono text-slate-400">Loading TeleTrack Dashboard...</span>
      </div>
    );
  }

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'watching', label: 'Watching' },
    { id: 'completed', label: 'Completed' },
    { id: 'not_started', label: 'Not Started' },
    { id: 'favorites', label: 'Favorites' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        user={authData?.user}
        channel={authData?.channel}
        onSync={handleSync}
        isSyncing={isSyncing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Statistics Header Section */}
        {stats && (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Videos"
              value={stats.totalVideos}
              icon={Video}
              colorVariant="blue"
            />
            <StatCard
              label="PDFs & Docs"
              value={stats.totalPdfs}
              icon={FileText}
              colorVariant="rose"
            />
            <StatCard
              label="Completed"
              value={stats.completedVideos}
              icon={CheckCircle}
              colorVariant="emerald"
            />
            <StatCard
              label="Completion"
              value={`${stats.completionPercentage}%`}
              icon={Percent}
              colorVariant="cyan"
            />
            <StatCard
              label="Hours Watched"
              value={`${stats.totalHoursWatched}h`}
              icon={Clock}
              colorVariant="amber"
            />
            <StatCard
              label="Favorites"
              value={stats.favoriteVideosCount}
              icon={Star}
              colorVariant="purple"
            />
          </section>
        )}

        {/* Section Navigation Tabs: ONLY Videos and PDFs & Docs */}
        <section className="border-b border-slate-800/80 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
              {/* Videos Tab */}
              <button
                onClick={() => setActiveSection('video')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeSection === 'video'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Videos</span>
                {stats && <span className="text-[10px] opacity-75 font-mono">({stats.totalVideos})</span>}
              </button>

              {/* PDFs & Docs Tab */}
              <button
                onClick={() => setActiveSection('pdf')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeSection === 'pdf'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>PDFs & Docs</span>
                {stats && <span className="text-[10px] opacity-75 font-mono">({stats.totalPdfs})</span>}
              </button>
            </div>

            {/* Controls: Group by Module (01_...) & Sort Order */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Group By Module Toggle */}
              <button
                onClick={() => setGroupByModule(!groupByModule)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  groupByModule
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Separate course modules starting with 01"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{groupByModule ? 'Module Sections (By 01)' : 'Flat Grid'}</span>
              </button>

              {/* Sort Order Toggle */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
                <ArrowDownUp className="w-3.5 h-3.5 text-cyan-400" />
                <button
                  onClick={() => setSortOrder(sortOrder === 'upload_asc' ? 'upload_desc' : 'upload_asc')}
                  className="font-semibold text-cyan-400 hover:underline cursor-pointer"
                >
                  {sortOrder === 'upload_asc' ? 'Upload Order (#1, #2...)' : 'Newest First'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Toolbar: Search & Progress Filter Pills */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search ${activeSection === 'video' ? 'videos' : 'PDFs'} by title or caption...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>

            {/* Progress Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              <ListFilter className="w-3.5 h-3.5 text-slate-500 mr-1 shrink-0" />
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    activeFilter === f.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Section Header Title */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <span>
              {activeSection === 'video' && '📹 Channel Videos'}
              {activeSection === 'pdf' && '📄 PDFs & Documents'}
            </span>
            <span className="text-xs font-mono text-cyan-400 font-normal">
              ({videos.length} items • {groupedModules.length} module sections)
            </span>
          </h2>
        </div>

        {/* Media Grid Section (Rendered as Module Sections or Flat Grid) */}
        <section className="space-y-10">
          {videos.length > 0 ? (
            groupByModule && groupedModules.length > 0 ? (
              /* Grouped Module Sections: Separating each 01-XX course part cleanly */
              groupedModules.map((mod) => (
                <div key={mod.id} className="space-y-4 pt-2 first:pt-0">
                  {/* Module Section Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-mono font-bold text-xs text-cyan-400">
                        {String(mod.id).padStart(2, '0')}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-wide">{mod.title}</h3>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {mod.videos.length} {mod.videos.length === 1 ? 'item' : 'items'} •{' '}
                          {mod.videos.filter((v) => v.progress?.status === 'completed').length} completed
                        </p>
                      </div>
                    </div>

                    <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent mx-6 hidden md:block" />
                  </div>

                  {/* Module Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {mod.videos.map((item) => (
                      <VideoCard key={item._id} video={item} onFavoriteToggle={handleFavoriteToggle} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              /* Flat Grid View */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {videos.map((item) => (
                  <VideoCard key={item._id} video={item} onFavoriteToggle={handleFavoriteToggle} />
                ))}
              </div>
            )
          ) : (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                {activeSection === 'video' ? <Video className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">No {activeSection}s found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {search || activeFilter !== 'all'
                    ? `No ${activeSection} items matched your active search or filter.`
                    : `No ${activeSection} items were found in the connected Telegram channel.`}
                </p>
              </div>

              {!search && activeFilter === 'all' && (
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync Channel Items</span>
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
