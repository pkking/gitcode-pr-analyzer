import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAllPrDetails,
  getPrDetailRepoKey,
  getRunRepoKey,
  listOrgEntries,
  listRepoEntries,
  normalizeRepoKey,
  percentile,
} from '../utils/etlData.js';
import { TableSkeleton, MetricValue, Badge } from '../components/ui.jsx';

const SORT_KEYS = {
  runCount: 'runCount',
  prE2E: 'prE2EP50',
  ciE2E: 'ciE2EP50',
  ciStartup: 'ciStartupP50',
  ciExec: 'ciExecP50',
  prReview: 'prReviewP50',
  compliance: 'ciComplianceRate',
};

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indexData, setIndexData] = useState(null);
  const [allRuns, setAllRuns] = useState([]);
  const [allPrDetails, setAllPrDetails] = useState({});
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [activeOrg, setActiveOrg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [indexRes, prDetails] = await Promise.all([
          fetch('/data/index.json'),
          fetchAllPrDetails(),
        ]);

        if (!indexRes.ok) throw new Error('Failed to load index.json');
        const index = await indexRes.json();
        if (cancelled) return;

        setIndexData(index);
        setAllPrDetails(prDetails);

        const repoEntries = listRepoEntries(index);
        const dayFileUrls = new Set();
        for (const repo of repoEntries) {
          for (const file of repo.files || []) {
            dayFileUrls.add(`/data/${file}`);
          }
        }

        const dayFileResponses = await Promise.all(
          Array.from(dayFileUrls).map(async url => {
            try {
              const res = await fetch(url);
              if (!res.ok) return null;
              return res.json();
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        const runs = dayFileResponses
          .filter(Boolean)
          .flatMap(dayFile => dayFile.runs || []);
        setAllRuns(runs);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  const repoMetrics = useMemo(() => {
    if (!indexData) return [];

    const runsByRepo = new Map();
    for (const run of allRuns) {
      const key = normalizeRepoKey(getRunRepoKey(run));
      if (!key) continue;
      if (!runsByRepo.has(key)) runsByRepo.set(key, []);
      runsByRepo.get(key).push(run);
    }

    const prDetailsByRepo = new Map();
    for (const [detailKey, detail] of Object.entries(allPrDetails)) {
      const repoKey = normalizeRepoKey(getPrDetailRepoKey(detailKey));
      if (!repoKey) continue;
      if (!prDetailsByRepo.has(repoKey)) prDetailsByRepo.set(repoKey, []);
      prDetailsByRepo.get(repoKey).push(detail);
    }

    const repoEntries = listRepoEntries(indexData);

    return repoEntries.map(repoEntry => {
      const repoKey = normalizeRepoKey(repoEntry.key);
      const runs = runsByRepo.get(repoKey) || [];
      const details = prDetailsByRepo.get(repoKey) || [];

      const prE2EDurations = details
        .map(d => d?.prSubmitToMerge?.durationSeconds)
        .filter(v => Number.isFinite(v));
      const prE2EP50 = percentile(prE2EDurations, 50);
      const prE2EP90 = percentile(prE2EDurations, 90);

      const ciE2EDurations = runs.map(r => r.durationInSeconds).filter(v => Number.isFinite(v));
      const ciE2EP50 = percentile(ciE2EDurations, 50);
      const ciE2EP90 = percentile(ciE2EDurations, 90);

      const ciStartupDurations = runs
        .map(r => r.jobs?.[0]?.queueDurationInSeconds)
        .filter(v => Number.isFinite(v));
      const ciStartupP50 = percentile(ciStartupDurations, 50);
      const ciStartupP90 = percentile(ciStartupDurations, 90);

      const ciExecDurations = runs
        .map(r => r.jobs?.[0]?.durationInSeconds)
        .filter(v => Number.isFinite(v));
      const ciExecP50 = percentile(ciExecDurations, 50);
      const ciExecP90 = percentile(ciExecDurations, 90);

      const prReviewDurations = details
        .map(d => d?.lastCiRemovalToMerge?.durationSeconds)
        .filter(v => Number.isFinite(v));
      const prReviewP50 = percentile(prReviewDurations, 50);
      const prReviewP90 = percentile(prReviewDurations, 90);

      const ciCompliantCount = runs.filter(r => r.durationInSeconds <= 3600).length;
      const ciComplianceRate = runs.length > 0 ? (ciCompliantCount / runs.length) * 100 : null;

      return {
        key: repoEntry.key,
        owner: repoEntry.owner,
        repo: repoEntry.repo,
        prE2EP50,
        prE2EP90,
        ciE2EP50,
        ciE2EP90,
        ciStartupP50,
        ciStartupP90,
        ciExecP50,
        ciExecP90,
        prReviewP50,
        prReviewP90,
        ciComplianceRate,
        runCount: runs.length,
        prDetailCount: details.length,
      };
    });
  }, [indexData, allRuns, allPrDetails]);

  const orgNames = useMemo(() => {
    if (!indexData) return [];
    return listOrgEntries(indexData).map(o => o.owner);
  }, [indexData]);

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
    let result = activeOrg ? sortedRepos.filter(r => r.owner === activeOrg) : sortedRepos;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.repo.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sortedRepos, activeOrg, searchQuery]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const handleOrgToggle = useCallback((org) => {
    setActiveOrg(prev => (prev === org ? null : org));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
            <div className="skeleton h-3 w-40 rounded" />
            <div className="skeleton mt-4 h-10 w-48 rounded" />
            <div className="skeleton mt-3 h-5 w-96 rounded" />
          </div>
          <TableSkeleton rows={8} />
        </div>
      </div>
    );
  }

  if (error) {
    return <FullScreenMessage tone="error">Error: {error}</FullScreenMessage>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="page-enter rounded-2xl border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80 font-medium">GitCode PR Analyzer</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">仓库总览</h1>
          <p className="mt-4 max-w-3xl text-sm text-stone-300 sm:text-base">
            所有仓库的 PR 与 CI 核心指标一览。点击仓库名称查看该仓库的所有 PR 详情。
          </p>

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-stone-500 font-medium">All Repositories</div>
                <div className="mt-1 text-lg font-semibold text-stone-900 font-display">
                  {orgNames.length} 个组织 · {repoMetrics.length} 个仓库 · {allRuns.length} 次运行
                  {activeOrg && <span className="ml-2 text-sm font-normal text-amber-700">（筛选：{activeOrg}）</span>}
                </div>
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  placeholder="搜索仓库..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm rounded-xl border border-stone-200 bg-white/80 placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition-all duration-200"
                  aria-label="Search repositories"
                />
              </div>
            </div>
          </div>

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
                      {searchQuery ? `没有找到匹配 "${searchQuery}" 的仓库` : '暂无数据。请确保 ETL 已采集并生成 index.json 与每日数据文件。'}
                    </td>
                  </tr>
                ) : filteredRepos.map((m, idx) => (
                  <tr
                    key={m.key}
                    className="border-b border-stone-100 table-row-hover"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <td className="px-6 py-4">
                      <Link to={`/repo/${m.owner}/${m.repo}`} className="text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline font-display">
                        {m.repo}
                      </Link>
                      <span className="ml-2 text-xs text-stone-400">{m.runCount} runs</span>
                    </td>
                    <td className="px-6 py-4"><MetricValue p50={m.prE2EP50} p90={m.prE2EP90} /></td>
                    <td className="px-6 py-4"><MetricValue p50={m.ciE2EP50} p90={m.ciE2EP90} /></td>
                    <td className="px-6 py-4"><MetricValue p50={m.ciStartupP50} p90={m.ciStartupP90} /></td>
                    <td className="px-6 py-4"><MetricValue p50={m.ciExecP50} p90={m.ciExecP90} /></td>
                    <td className="px-6 py-4"><MetricValue p50={m.prReviewP50} p90={m.prReviewP90} /></td>
                    <td className="px-6 py-4 text-sm text-stone-600 font-mono">{m.runCount}</td>
                    <td className="px-6 py-4">
                      {m.ciComplianceRate !== null ? (
                        <Badge variant={m.ciComplianceRate >= 90 ? 'success' : m.ciComplianceRate >= 70 ? 'warning' : 'error'}>
                          {m.ciComplianceRate.toFixed(1)}%
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
        </section>
      </div>
    </div>
  );
}

function SortableTh({ label, hint, sortKey, activeKey, dir, onSort }) {
  const isActive = activeKey === sortKey;
  return (
    <th
      className="px-4 py-4 font-medium cursor-pointer select-none hover:text-stone-700 transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
      role="columnheader"
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {hint && <span className="text-[10px] text-stone-400 font-normal normal-case tracking-normal">({hint})</span>}
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
          <svg className="mx-auto mb-4 w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        )}
        {children}
      </div>
    </div>
  );
}
