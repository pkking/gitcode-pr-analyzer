import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOrgEntries, listRepoEntries } from '../utils/etlData.js';
import { TableSkeleton, MetricValue, Badge, ProgressBar } from '../components/ui.jsx';
import ExportPanel from '../components/ExportPanel.jsx';

const SORT_KEYS = {
  runCount: 'runCount',
  prE2E: 'prE2EP50',
  ciE2E: 'ciE2EP50',
  ciStartup: 'ciStartupP50',
  ciExec: 'ciExecP50',
  prReview: 'prReviewP50',
  compliance: 'ciComplianceRate',
};

const HOME_OVERVIEW_CACHE_KEY = 'gitcode-pr-analyzer:home-overview:v1';

const EMPTY_SUMMARY = {
  repoCount: 0,
  totalRuns: 0,
  totalPrDetails: 0,
  lastUpdated: '',
};

function readCachedOverview() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(HOME_OVERVIEW_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedOverview(overview) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(HOME_OVERVIEW_CACHE_KEY, JSON.stringify(overview));
  } catch {
    // Ignore storage failures and rely on network fetch.
  }
}

function buildSummaryMeta(overview) {
  const repos = Array.isArray(overview?.repos) ? overview.repos : [];
  return {
    repoCount: overview?.summary?.repoCount ?? repos.length,
    totalRuns: overview?.summary?.totalRuns ?? repos.reduce((sum, repo) => sum + (repo.runCount || 0), 0),
    totalPrDetails: overview?.summary?.totalPrDetails ?? repos.reduce((sum, repo) => sum + (repo.prDetailCount || 0), 0),
    lastUpdated: overview?.source_last_updated || overview?.generated_at || '',
  };
}

function buildFallbackOverview(indexData) {
  const repos = listRepoEntries(indexData).map(repoEntry => ({
    key: repoEntry.key,
    owner: repoEntry.owner,
    repo: repoEntry.repo,
    prE2EP50: null,
    prE2EP90: null,
    ciE2EP50: null,
    ciE2EP90: null,
    ciStartupP50: null,
    ciStartupP90: null,
    ciExecP50: null,
    ciExecP90: null,
    prReviewP50: null,
    prReviewP90: null,
    ciComplianceRate: null,
    runCount: 0,
    prDetailCount: 0,
  }));

  return {
    repos,
    orgs: listOrgEntries(indexData).map(org => org.owner),
    summary: {
      repoCount: repos.length,
      totalRuns: 0,
      totalPrDetails: 0,
    },
    source_last_updated: indexData?.last_updated || '',
  };
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(8);
  const [loadingLabel, setLoadingLabel] = useState('读取首页摘要');
  const [loadingDetail, setLoadingDetail] = useState('仅加载首页所需聚合指标，避免首屏全量扫描。');
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [repoMetrics, setRepoMetrics] = useState([]);
  const [orgNames, setOrgNames] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [activeOrg, setActiveOrg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const exportPanelRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let cachedOverview = null;

    const updateLoading = (progress, label, detail) => {
      if (cancelled) return;
      setLoadingProgress(progress);
      setLoadingLabel(label);
      setLoadingDetail(detail);
    };

    const applyOverview = overview => {
      if (cancelled) return;
      setRepoMetrics(Array.isArray(overview?.repos) ? overview.repos : []);
      setOrgNames(Array.isArray(overview?.orgs) ? overview.orgs : []);
      setSummary(buildSummaryMeta(overview));
    };

    async function loadData() {
      try {
        setError(null);
        setWarning(null);

        cachedOverview = readCachedOverview();
        if (cachedOverview) {
          updateLoading(42, '命中本地缓存', '先使用本次会话的首页摘要，再静默检查最新文件。');
          applyOverview(cachedOverview);
          setLoading(false);
          setIsRefreshing(true);
        } else {
          setLoading(true);
          setIsRefreshing(false);
        }

        updateLoading(cachedOverview ? 56 : 16, '请求首页摘要', '正在读取 home-overview.json。');
        const res = await fetch('/data/home-overview.json', { cache: 'no-cache' });

        if (!res.ok) {
          throw new Error(`Failed to load home overview: ${res.status}`);
        }

        updateLoading(78, '解析首页摘要', '准备仓库指标和组织筛选。');
        const overview = await res.json();
        if (cancelled) return;

        applyOverview(overview);
        writeCachedOverview(overview);

        updateLoading(96, '渲染首页', '首屏指标已就绪。');
        setLoading(false);
        setIsRefreshing(false);
        setLoadingProgress(100);
        setLoadingLabel('首页加载完成');
        setLoadingDetail('首页已使用预聚合指标完成渲染。');
      } catch (overviewErr) {
        if (cachedOverview) {
          if (!cancelled) {
            console.error('Overview refresh failed:', overviewErr);
            setWarning('首页摘要刷新失败，当前显示的是缓存数据。');
            setLoading(false);
            setIsRefreshing(false);
            setLoadingProgress(100);
            setLoadingLabel('使用缓存数据');
            setLoadingDetail('当前会话缓存仍在显示，最新摘要刷新失败。');
          }
          return;
        }

        try {
          updateLoading(48, '回退到索引文件', '首页摘要不存在时，仅展示仓库列表并保留交互。');
          const indexRes = await fetch('/data/index.json', { cache: 'no-cache' });
          if (!indexRes.ok) throw new Error('Failed to load index.json');

          const index = await indexRes.json();
          if (cancelled) return;

          const fallbackOverview = buildFallbackOverview(index);
          applyOverview(fallbackOverview);
          setWarning('首页摘要文件不可用，当前只展示仓库列表，指标列未预聚合。建议重新运行 ETL 生成 home-overview.json。');
          setLoading(false);
          setIsRefreshing(false);
          setLoadingProgress(100);
          setLoadingLabel('已使用兼容模式');
          setLoadingDetail('基础仓库列表已展示。');
        } catch (fallbackErr) {
          if (!cancelled) {
            console.error('Overview load failed:', overviewErr, 'Fallback failed:', fallbackErr);
            setError('无法加载数据。请检查网络连接或确保 ETL 任务已运行。');
            setLoading(false);
            setIsRefreshing(false);
          }
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedRepos = useMemo(() => {
    if (!sortKey) return repoMetrics;
    const sorted = [...repoMetrics];
    sorted.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [repoMetrics, sortKey, sortDir]);

  const filteredRepos = useMemo(() => {
    let result = activeOrg ? sortedRepos.filter(repo => repo.owner === activeOrg) : sortedRepos;
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(repo =>
        repo.repo.toLowerCase().includes(q) ||
        repo.owner.toLowerCase().includes(q) ||
        repo.key.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sortedRepos, activeOrg, deferredSearchQuery]);

  const handleOrgToggle = useCallback((org) => {
    setActiveOrg(prev => (prev === org ? null : org));
  }, []);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  }

  if (error) {
    return <FullScreenMessage tone="error">Error: {error}</FullScreenMessage>;
  }

  const isBootstrapping = loading && repoMetrics.length === 0;
  const showProgress = isBootstrapping || isRefreshing;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="page-enter rounded-2xl border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80 font-medium">GitCode PR Analyzer</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">仓库总览</h1>
          <p className="mt-4 max-w-3xl text-sm text-stone-300 sm:text-base">
            首页仅读取预聚合摘要，先把仓库级指标快速呈现，再进入明细页按需加载。
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard label="组织数" value={orgNames.length} />
              <SummaryCard label="仓库数" value={summary.repoCount} />
              <SummaryCard label="运行数" value={summary.totalRuns} />
            </div>
            <div className="rounded-2xl border border-stone-800 bg-stone-900/80 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-stone-500">加载策略</div>
              <div className="mt-2 text-sm text-stone-200">首页摘要直出</div>
              <div className="mt-1 text-xs text-stone-400">
                历史 PR 明细和按天 run 数据不再阻塞首屏。
              </div>
            </div>
          </div>

          {showProgress && (
            <ProgressBar
              value={loadingProgress}
              label={loadingLabel}
              detail={loadingDetail}
              className="mt-6"
            />
          )}

          {warning && (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {warning}
            </div>
          )}

          {orgNames.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {orgNames.map(org => (
                <button
                  key={org}
                  onClick={() => handleOrgToggle(org)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                    activeOrg === org
                      ? 'bg-amber-400 text-stone-900 shadow-md shadow-amber-400/20 scale-105'
                      : 'bg-stone-800 text-stone-300 hover:bg-stone-700 hover:text-stone-100'
                  }`}
                >
                  {org}
                </button>
              ))}
            </div>
          )}
        </header>

        <section className="page-enter stagger-2 mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white/90 shadow-lg shadow-stone-200/60">
          <div className="border-b border-stone-200 bg-stone-50/80 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-stone-500 font-medium">All Repositories</div>
                <div className="mt-1 text-lg font-semibold text-stone-900 font-display">
                  {orgNames.length} 个组织 · {summary.repoCount} 个仓库 · {summary.totalRuns} 次运行
                  {activeOrg && <span className="ml-2 text-sm font-normal text-amber-700">（筛选：{activeOrg}）</span>}
                </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => exportPanelRef.current?.open?.()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white/80 px-3.5 py-2 text-sm font-medium text-stone-600 hover:text-amber-700 hover:border-amber-300 transition-colors"
                  aria-label="导出Excel报表"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  导出
                </button>
                <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  placeholder="搜索仓库..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white/80 py-2 pl-9 pr-4 text-sm placeholder:text-stone-400 outline-none transition-all duration-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 sm:w-64"
                  aria-label="Search repositories"
                />
              </div>
            </div>
          </div>

          {isBootstrapping ? (
            <TableSkeleton rows={8} />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50 text-xs uppercase tracking-[0.24em] text-stone-500">
                    <th className="px-6 py-4 font-medium">仓库</th>
                    <SortableTh label="PR E2E" hint="P50/P90" sortKey={SORT_KEYS.prE2E} activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableTh label="CI E2E" hint="P50/P90" sortKey={SORT_KEYS.ciE2E} activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableTh label="CI启动" hint="P50/P90" sortKey={SORT_KEYS.ciStartup} activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableTh label="CI执行" hint="P50/P90" sortKey={SORT_KEYS.ciExec} activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableTh label="PR检视" hint="P50/P90" sortKey={SORT_KEYS.prReview} activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableTh label="次数" sortKey={SORT_KEYS.runCount} activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortableTh label="达标率" sortKey={SORT_KEYS.compliance} activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredRepos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-sm text-stone-500">
                        {deferredSearchQuery ? `没有找到匹配 "${deferredSearchQuery}" 的仓库` : '暂无数据。请确保 ETL 已采集并生成首页摘要。'}
                      </td>
                    </tr>
                  ) : filteredRepos.map((repo, idx) => (
                    <tr
                      key={repo.key}
                      className="table-row-hover border-b border-stone-100"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <td className="px-6 py-4">
                        <Link to={`/repo/${repo.owner}/${repo.repo}`} className="font-display text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline">
                          {repo.repo}
                        </Link>
                        <span className="ml-2 text-xs text-stone-400">{repo.runCount} runs</span>
                      </td>
                      <td className="px-6 py-4"><MetricValue p50={repo.prE2EP50} p90={repo.prE2EP90} /></td>
                      <td className="px-6 py-4"><MetricValue p50={repo.ciE2EP50} p90={repo.ciE2EP90} /></td>
                      <td className="px-6 py-4"><MetricValue p50={repo.ciStartupP50} p90={repo.ciStartupP90} /></td>
                      <td className="px-6 py-4"><MetricValue p50={repo.ciExecP50} p90={repo.ciExecP90} /></td>
                      <td className="px-6 py-4"><MetricValue p50={repo.prReviewP50} p90={repo.prReviewP90} /></td>
                      <td className="px-6 py-4 font-mono text-sm text-stone-600">{repo.runCount}</td>
                      <td className="px-6 py-4">
                        {repo.ciComplianceRate !== null ? (
                          <Badge variant={repo.ciComplianceRate >= 90 ? 'success' : repo.ciComplianceRate >= 70 ? 'warning' : 'error'}>
                            {repo.ciComplianceRate.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-sm text-stone-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <ExportPanel ref={exportPanelRef} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-900/80 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-stone-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-stone-100 font-display">
        {Number.isFinite(value) ? value.toLocaleString() : '--'}
      </div>
    </div>
  );
}

function SortableTh({ label, hint, sortKey, activeKey, dir, onSort }) {
  const isActive = activeKey === sortKey;
  return (
    <th
      className="cursor-pointer whitespace-nowrap px-4 py-4 font-medium select-none transition-colors hover:text-stone-700"
      onClick={() => onSort(sortKey)}
      role="columnheader"
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {hint && <span className="text-[10px] font-normal tracking-normal text-stone-400 normal-case">({hint})</span>}
        <span className={`ml-0.5 transition-transform ${isActive ? 'text-amber-600' : 'text-stone-400'}`}>
          {isActive ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </div>
    </th>
  );
}

function FullScreenMessage({ children, tone }) {
  const textClass = tone === 'error' ? 'text-red-300' : 'text-stone-100';
  return (
    <div className={`flex min-h-screen items-center justify-center bg-stone-950 px-6 text-center ${textClass}`}>
      <div className="animate-fade-in-up">
        {tone === 'error' && (
          <svg className="mx-auto mb-4 h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        )}
        {children}
      </div>
    </div>
  );
}
