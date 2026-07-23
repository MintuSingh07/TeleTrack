'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlayCircle, RefreshCw, Settings, LogOut, Radio, User } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
  user?: { firstName?: string; username?: string; phone?: string } | null;
  channel?: { title?: string; telegramChatId?: string } | null;
  onSync?: () => Promise<void>;
  isSyncing?: boolean;
}

export function Navbar({ user, channel, onSync, isSyncing }: NavbarProps) {
  const router = useRouter();
  const [loadingLogout, setLoadingLogout] = useState(false);

  const handleLogout = async () => {
    setLoadingLogout(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoadingLogout(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <PlayCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              TeleTrack
            </span>
            <span className="text-xs block text-cyan-400 font-mono">Video Progress Hub</span>
          </div>
        </Link>

        {/* Center: Connected Channel status */}
        {channel ? (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-medium truncate max-w-[200px]">{channel.title}</span>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {onSync && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold shadow-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Videos'}</span>
            </button>
          )}

          <Link
            href="/settings"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800 text-xs">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold">
                {user.firstName ? user.firstName[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
              <span className="hidden sm:inline font-medium text-slate-300">
                {user.firstName || user.username || 'User'}
              </span>

              <button
                onClick={handleLogout}
                disabled={loadingLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
