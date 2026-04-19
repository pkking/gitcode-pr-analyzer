import React from 'react';
import { Link } from 'react-router-dom';
import { formatSeconds } from '../utils/etlData.js';

const BADGE_CLASS = {
  success: 'badge badge-success',
  failure: 'badge badge-error',
  pending: 'badge badge-warning',
  neutral: 'badge badge-neutral',
  info: 'badge badge-info',
};

const TONE_MAP = {
  stone: 'bg-stone-50 text-stone-900 ring-1 ring-stone-200/60',
  green: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/60',
  amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/60',
  blue: 'bg-sky-50 text-sky-900 ring-1 ring-sky-200/60',
};

export function Badge({ children, variant = 'neutral', className = '' }) {
  const cls = BADGE_CLASS[variant] || BADGE_CLASS.neutral;
  return (
    <span className={`${cls} ${className}`}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, sublabel, tone = 'stone', className = '' }) {
  const bg = TONE_MAP[tone] || TONE_MAP.stone;

  return (
    <div className={`rounded-xl px-5 py-4 ${bg} card-hover ${className}`}>
      <div className="text-[11px] uppercase tracking-[0.24em] opacity-60 font-medium">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight font-display">{value}</div>
      {sublabel && <div className="mt-1 text-xs opacity-60">{sublabel}</div>}
    </div>
  );
}

export function EmptyState({ title, description, actionLabel, actionHref, actionInternal = false }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
      <div className="text-lg font-medium text-stone-700 font-display">{title}</div>
      {description && <div className="mt-2 text-sm text-stone-500">{description}</div>}
      {actionLabel && actionHref && (
        <div className="mt-4">
          {actionInternal ? (
            <Link to={actionHref} className="text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline">
              {actionLabel}
            </Link>
          ) : (
            <a href={actionHref} target="_blank" rel="noreferrer" className="text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline">
              {actionLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function LoadingSkeleton({ lines = 5 }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white/90 shadow-lg shadow-stone-200/60">
      <div className="border-b border-stone-200 bg-stone-50/80 px-6 py-4">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton mt-2 h-5 w-48 rounded" />
      </div>
      <div className="p-6 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white/90 shadow-lg shadow-stone-200/60">
      <div className="border-b border-stone-200 bg-stone-50/80 px-6 py-4">
        <div className="skeleton h-4 w-32 rounded" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-stone-50 text-xs uppercase tracking-[0.24em] text-stone-500">
              <th className="px-6 py-4 font-medium"><div className="skeleton h-3 w-16 rounded" /></th>
              <th className="px-6 py-4 font-medium"><div className="skeleton h-3 w-20 rounded" /></th>
              <th className="px-6 py-4 font-medium"><div className="skeleton h-3 w-20 rounded" /></th>
              <th className="px-6 py-4 font-medium"><div className="skeleton h-3 w-16 rounded" /></th>
              <th className="px-6 py-4 font-medium"><div className="skeleton h-3 w-16 rounded" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-stone-100">
                <td className="px-6 py-4"><div className="skeleton h-4 w-28 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-20 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-16 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-12 rounded" /></td>
                <td className="px-6 py-4"><div className="skeleton h-4 w-24 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MetricValue({ p50, p90, className = '' }) {
  if (p50 === null && p90 === null) {
    return <span className={`text-sm text-stone-400 ${className}`}>--</span>;
  }
  return (
    <span className={`text-sm text-stone-900 ${className}`}>
      {formatSeconds(p50)} <span className="text-stone-400">/</span> {formatSeconds(p90)}
    </span>
  );
}
