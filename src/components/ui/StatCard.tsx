'use client';

import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  colorVariant?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan';
}

const COLOR_MAPS = {
  blue: {
    bg: 'from-blue-500/10 to-indigo-500/5',
    border: 'border-blue-500/20',
    iconBg: 'bg-blue-500/20 text-blue-400',
  },
  emerald: {
    bg: 'from-emerald-500/10 to-teal-500/5',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
  },
  amber: {
    bg: 'from-amber-500/10 to-orange-500/5',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/20 text-amber-400',
  },
  purple: {
    bg: 'from-purple-500/10 to-pink-500/5',
    border: 'border-purple-500/20',
    iconBg: 'bg-purple-500/20 text-purple-400',
  },
  rose: {
    bg: 'from-rose-500/10 to-red-500/5',
    border: 'border-rose-500/20',
    iconBg: 'bg-rose-500/20 text-rose-400',
  },
  cyan: {
    bg: 'from-cyan-500/10 to-blue-500/5',
    border: 'border-cyan-500/20',
    iconBg: 'bg-cyan-500/20 text-cyan-400',
  },
};

export function StatCard({ label, value, subtext, icon: Icon, colorVariant = 'blue' }: StatCardProps) {
  const styles = COLOR_MAPS[colorVariant];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`p-4 rounded-xl bg-gradient-to-br ${styles.bg} border ${styles.border} backdrop-blur-md shadow-sm flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${styles.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-2">
        <span className="text-2xl font-extrabold text-white">{value}</span>
        {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
      </div>
    </motion.div>
  );
}
