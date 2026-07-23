'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/ui/Navbar';
import { User, Radio, RefreshCw, Trash2, ArrowLeft, Calendar, FileVideo, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const [authData, setAuthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');

  const fetchAuthInfo = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setAuthData(data);
    } catch (err) {
      console.error('Error fetching settings auth info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthInfo();
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncStatusMessage('Synchronizing channel videos...');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      setSyncStatusMessage(`Sync complete! ${data.newCount} new videos imported.`);
      await fetchAuthInfo();
    } catch (err: any) {
      setSyncStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectChannel = async () => {
    if (!confirm('Are you sure you want to disconnect this channel? This will remove all imported video progress data.')) {
      return;
    }
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/channel/change', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to disconnect channel');
      router.push('/setup');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const user = authData?.user;
  const channel = authData?.channel;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar user={user} channel={channel} onSync={handleManualSync} isSyncing={isSyncing} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard Settings</h1>
            <p className="text-xs text-slate-400">Manage your connected Telegram account and channel setup</p>
          </div>
        </div>

        {syncStatusMessage && (
          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
            {syncStatusMessage}
          </div>
        )}

        {/* Telegram Account Section */}
        <section className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Connected Telegram Account</h2>
              <p className="text-xs text-slate-400">Server-authenticated MTProto Session</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase">User Name</span>
              <span className="text-slate-200 font-semibold mt-1 block">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase">Telegram Handle</span>
              <span className="text-cyan-400 font-semibold mt-1 block">
                {user?.username ? `@${user.username}` : 'N/A'}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase">Phone Number</span>
              <span className="text-slate-200 font-semibold mt-1 block">{user?.phone || 'Hidden'}</span>
            </div>
          </div>
        </section>

        {/* Connected Channel Section */}
        <section className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Connected Channel</h2>
                <p className="text-xs text-slate-400">Private educational video repository</p>
              </div>
            </div>

            <button
              onClick={handleDisconnectChannel}
              disabled={isDisconnecting}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect Channel</span>
            </button>
          </div>

          {channel ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white text-base">{channel.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ID: {channel.telegramChatId}
                  </span>
                </div>
                <p className="text-xs font-mono text-cyan-400 mt-2 truncate">{channel.inviteLink}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Last Sync Time</span>
                    <span className="text-slate-200 font-medium">
                      {channel.lastSyncAt ? new Date(channel.lastSyncAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center gap-3">
                  <FileVideo className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Channel Sync Control</span>
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="text-xs text-cyan-400 font-semibold hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      Trigger Manual Sync
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-slate-400 mb-3">No Telegram channel is currently connected.</p>
              <Link
                href="/setup"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors"
              >
                Connect Channel Now
              </Link>
            </div>
          )}
        </section>

        {/* Security & System Info */}
        <section className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Security & Data Compliance</span>
          </div>
          <p>
            All MTProto operations execute strictly on the server-side. No Telegram API keys, API hash, or raw sessions are ever exposed to the client browser.
          </p>
        </section>
      </main>
    </div>
  );
}
