import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAllPrDetails,
  formatSeconds,
  getRunRepoKey,
  listOrgEntries,
  listRepoEntries,
  percentile,
} from '../utils/etlData.js';

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indexData, setIndexData] = useState(null);
  const [allRuns, setAllRuns] = useState([]);
  const [allPrDetails, setAllPrDetails] = useState({});

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
      const key = getRunRepoKey(run);
      if (!key) continue;
      if (!runsByRepo.has(key)) runsByRepo.set(key, []);
      runsByRepo.get(key).push(run);
    }

    const prDetailsByRepo = new Map();
    for (const [detailKey, detail] of Object.entries(allPrDetails)) {
      const repoKeyMatch = detailKey.match(/^(.+\/.+?)#/);
      if (!repoKeyMatch) continue;
      const repoKey = repoKeyMatch[1];
      if (!prDetailsByRepo.has(repoKey)) prDetailsByRepo.set(repoKey, []);
      prDetailsByRepo.get(repoKey).push(detail);
    }

    const repoEntries = listRepoEntries(indexData);

    return repoEntries.map(repoEntry => {
      const runs = runsByRepo.get(repoEntry.key) || [];
      const details = prDetailsByRepo.get(repoEntry.key) || [];

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

  const orgGroups = useMemo(() => {
    if (!indexData) return [];
    const orgEntries = listOrgEntries(indexData);
    const metricsByKey = new Map(repoMetrics.map(m => [m.key, m]));

    return orgEntries.map(org => ({
      owner: org.owner,
      repos: org.repos
        .map(repo => metricsByKey.get(repo.key))
        .filter(Boolean),
    })).filter(org => org.repos.length > 0);
  }, [indexData, repoMetrics]);

  if (loading) {
    return <FullScreenMessage tone="stone">Loading overview data...</FullScreenMessage>;
  }

  if (error) {
    return <FullScreenMessage tone="error">Error: {error}</FullScreenMessage>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-[32px] border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">GitCode PR Analyzer</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">仓库总览</h1>
          <p className="mt-4 max-w-3xl text-sm text-stone-300 sm:text-base">
            所有仓库的 PR 与 CI 核心指标一览。点击仓库名称查看该仓库的所有 PR 详情。
          </p>
        </header>

        <section className="mt-8 overflow-hidden rounded-[28px] border border-stone-200 bg-white/90 shadow-lg shadow-stone-200/60">
          <div className="border-b border-stone-200 bg-stone-50/80 px-6 py-4">
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">All Repositories</div>
            <div className="mt-1 text-lg font-semibold text-stone-900">
              {orgGroups.length} 个组织 · {repoMetrics.length} 个仓库 · {allRuns.length} 次运行
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 text-xs uppercase tracking-[0.24em] text-stone-500">
                  <th className="px-6 py-4 font-medium">组织</th>
                  <th className="px-6 py-4 font-medium">仓库</th>
                  <th className="px-6 py-4 font-medium">PR E2E时长</th>
                  <th className="px-6 py-4 font-medium">CI E2E时长</th>
                  <th className="px-6 py-4 font-medium">CI启动时间</th>
                  <th className="px-6 py-4 font-medium">CI执行时间</th>
                  <th className="px-6 py-4 font-medium">PR检视时间</th>
                  <th className="px-6 py-4 font-medium">CI E2E达标率</th>
                </tr>
              </thead>
              <tbody>
                {orgGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-sm text-stone-500">
                      暂无数据。请确保 ETL 已采集并生成 index.json 与每日数据文件。
                    </td>
                  </tr>
                ) : orgGroups.map(org => (
                  <React.Fragment key={org.owner}>
                    <tr className="bg-stone-100">
                      <td colSpan={8} className="px-6 py-3 text-sm font-semibold text-stone-700">
                        {org.owner}
                      </td>
                    </tr>
                    {org.repos.map((m, idx) => (
                      <tr key={m.key} className="border-b border-stone-100 hover:bg-stone-50/50">
                        <td className="px-6 py-4 text-sm text-stone-500">
                          {idx === 0 ? org.owner : ''}
                        </td>
                        <td className="px-6 py-4">
                          <Link to={`/repo/${m.owner}/${m.repo}`} className="text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline">
                            {m.repo}
                          </Link>
                          <span className="ml-2 text-xs text-stone-400">{m.runCount} runs</span>
                        </td>
                        <MetricCell p50={m.prE2EP50} p90={m.prE2EP90} />
                        <MetricCell p50={m.ciE2EP50} p90={m.ciE2EP90} />
                        <MetricCell p50={m.ciStartupP50} p90={m.ciStartupP90} />
                        <MetricCell p50={m.ciExecP50} p90={m.ciExecP90} />
                        <MetricCell p50={m.prReviewP50} p90={m.prReviewP90} />
                        <td className="px-6 py-4">
                          {m.ciComplianceRate !== null ? (
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getComplianceBadgeClass(m.ciComplianceRate)}`}>
                              {m.ciComplianceRate.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-sm text-stone-400">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCell({ p50, p90 }) {
  if (p50 === null && p90 === null) {
    return <td className="px-6 py-4 text-sm text-stone-400">--</td>;
  }
  return (
    <td className="px-6 py-4">
      <div className="text-sm text-stone-900">
        {formatSeconds(p50)} <span className="text-stone-400">/</span> {formatSeconds(p90)}
      </div>
    </td>
  );
}

function getComplianceBadgeClass(rate) {
  if (rate >= 90) return 'bg-emerald-100 text-emerald-800';
  if (rate >= 70) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}

function FullScreenMessage({ children, tone }) {
  const textClass = tone === 'error' ? 'text-red-300' : 'text-stone-100';
  return <div className={`flex min-h-screen items-center justify-center bg-stone-950 px-6 text-center ${textClass}`}>{children}</div>;
}
