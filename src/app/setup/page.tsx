'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Radio, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SetupPage() {
  const router = useRouter();
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteLink.trim()) return;

    setLoading(true);
    setError('');
    setStatusMessage('Validating Telegram channel access and joining if needed...');

    try {
      const res = await fetch('/api/channel/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteLink: inviteLink.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect channel');

      setStatusMessage(data.message || 'Channel connected successfully!');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 blur-[140px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl relative z-10"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Channel Setup</h1>
            <p className="text-xs text-slate-400">Connect your private Telegram learning channel</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Connection Error</span>
              {error}
            </div>
          </div>
        )}

        {statusMessage && !error && (
          <div className="mb-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
            <div>{statusMessage}</div>
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
              Telegram Channel Invite Link
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                placeholder="https://t.me/+MuEd5ZMJiggxNWY1"
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                required
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl py-3.5 pl-10 pr-4 text-xs font-mono text-slate-100 placeholder-slate-600 outline-none transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Paste the private Telegram channel invite link. Your Telegram account must have permission to view the channel.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? 'Connecting & Syncing Videos...' : 'Connect Channel'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
