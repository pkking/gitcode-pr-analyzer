import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import RepoTreeNav from '../components/RepoTreeNav.jsx';

export default function AppShell({
  buildOrgHref,
  children,
  indexData,
  orgEntries,
  panelLoading,
  repoRunsByKey,
  selectedOrgOwner,
  selectedRepoKey,
}) {
  const [expandedOrgs, setExpandedOrgs] = useState({});

  const mergedExpandedOrgs = useMemo(() => (
    selectedOrgOwner ? { ...expandedOrgs, [selectedOrgOwner]: true } : expandedOrgs
  ), [expandedOrgs, selectedOrgOwner]);

  void repoRunsByKey;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[28px] border border-stone-800 bg-stone-950/85 px-6 py-6 text-stone-100 shadow-2xl shadow-stone-950/30 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">GitCode PR Analyzer</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">PR 与 CI 指标分析</h1>
              <p className="max-w-3xl text-sm text-stone-300">
                首页总览所有仓库指标，点击仓库进入 PR 列表，点击 PR 查看 CI 分析。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <nav className="flex flex-wrap items-center gap-2">
                <TopNavLink to="/" label="首页" />
              </nav>
              {indexData?.last_updated ? (
                <div className="rounded-2xl border border-stone-800 bg-stone-900/80 px-4 py-3 text-right">
                  <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">Last Updated</div>
                  <div className="mt-1 text-sm text-stone-200">{new Date(indexData.last_updated).toLocaleString()}</div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-stone-200 bg-white/85 p-4 shadow-lg shadow-stone-200/60 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-stone-500">Navigation</div>
                <div className="mt-1 text-lg font-semibold text-stone-900">组织 / 仓库</div>
              </div>
              {panelLoading ? <span className="text-xs text-amber-700">同步中...</span> : null}
            </div>

            <RepoTreeNav
              buildOrgHref={buildOrgHref}
              buildRepoHref={repo => `/repo/${repo.owner}/${repo.repo}`}
              expandedOrgs={mergedExpandedOrgs}
              onToggleOrg={owner => setExpandedOrgs(prev => ({ ...prev, [owner]: !(prev[owner] ?? owner === selectedOrgOwner) }))}
              orgEntries={orgEntries}
              repoRunsByKey={repoRunsByKey}
              selectedOrgOwner={selectedOrgOwner}
              selectedRepoKey={selectedRepoKey}
            />
          </aside>

          <main className="space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

function TopNavLink({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `rounded-full px-4 py-2 text-sm transition ${isActive ? 'bg-white text-stone-950' : 'bg-stone-900/70 text-stone-200 hover:bg-stone-800'}`}
    >
      {label}
    </NavLink>
  );
}
