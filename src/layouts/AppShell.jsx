import React, { useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import RepoTreeNav from '../components/RepoTreeNav.jsx';

export default function AppShell({
  buildOrgHref,
  buildRepoHref,
  children,
  currentSection,
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[28px] border border-stone-800 bg-stone-950/85 px-6 py-6 text-stone-100 shadow-2xl shadow-stone-950/30 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">GitCode PR Analyzer</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">组织维度的 CI 全景与独立分析页</h1>
              <p className="max-w-3xl text-sm text-stone-300">
                路由驱动的浏览与分析外壳。浏览页负责上下文探索，分析页负责单次 run 的独立拆解与切换。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <nav className="flex flex-wrap items-center gap-2">
                <TopNavLink to="/" label="Home" />
                <TopNavLink to="/browse" label="Browse" />
                <TopNavLink to="/analysis" label="Analysis" />
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
                <div className="mt-1 text-lg font-semibold text-stone-900">
                  {currentSection === 'analysis' ? '分析 / 仓库' : '组织 / 仓库'}
                </div>
              </div>
              {panelLoading ? <span className="text-xs text-amber-700">同步中...</span> : null}
            </div>

            <RepoTreeNav
              buildOrgHref={buildOrgHref}
              buildRepoHref={buildRepoHref}
              expandedOrgs={mergedExpandedOrgs}
              onToggleOrg={owner => setExpandedOrgs(prev => ({ ...prev, [owner]: !(prev[owner] ?? owner === selectedOrgOwner) }))}
              orgEntries={orgEntries}
              repoRunsByKey={repoRunsByKey}
              selectedOrgOwner={selectedOrgOwner}
              selectedRepoKey={selectedRepoKey}
            />

            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
              <div className="font-semibold text-stone-900">Current Area</div>
              <div className="mt-2">
                {currentSection === 'analysis'
                  ? '在独立分析页中仍可切换组织与仓库上下文。'
                  : '浏览页负责组织与仓库 drill-down。'}
              </div>
              <div className="mt-3">
                <Link className="text-amber-700 hover:text-amber-800" to={currentSection === 'analysis' ? '/browse' : '/analysis'}>
                  {currentSection === 'analysis' ? '前往 Browse' : '前往 Analysis'}
                </Link>
              </div>
            </div>
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
