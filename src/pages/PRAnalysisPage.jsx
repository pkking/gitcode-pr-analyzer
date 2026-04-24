import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { RunDetailView } from '../components/DashboardViews.jsx';
import {
  formatSeconds,
  getRunRepoKey,
  getSuccessRate,
  listRepoEntries,
} from '../utils/etlData.js';
import { buildRunTimeline } from '../utils/runTimeline.js';
import { StatCard, TableSkeleton } from '../components/ui.jsx';

export default function PRAnalysisPage() {
  const { owner, repo, prNumber } = useParams();
  const [searchParams] = useSearchParams();
  const repoKey = `${owner}/${repo}`;
  const prNum = Number(prNumber);
  const explicitRunId = searchParams.get('runId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runs, setRuns] = useState([]);
  const [detailByKey, setDetailByKey] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const indexRes = await fetch('/data/index.json');
        if (!indexRes.ok) throw new Error('Failed to load index');
        const index = await indexRes.json();

        const repoEntry = listRepoEntries(index).find(r => r.key === repoKey);
        if (!repoEntry) {
          if (!cancelled) setError(`Repository "${repoKey}" not found`);
          return;
        }

        const dayFiles = repoEntry.files || [];
        const dayFileResponses = await Promise.all(
          dayFiles.map(async file => {
            try {
              const res = await fetch(`/data/${file}`);
              if (!res.ok) return null;
              return res.json();
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        const allRuns = dayFileResponses
          .filter(Boolean)
          .flatMap(dayFile => dayFile.runs || [])
          .filter(run => {
            const runRepoKey = getRunRepoKey(run);
            const match = String(run.name || '').match(/PR\s+#(\d+)/i);
            const runPrNumber = match ? Number(match[1]) : null;
            return runRepoKey === repoKey && runPrNumber === prNum;
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setRuns(allRuns);

        const prDetailPaths = await fetch('/data/pr-details-index.json').then(r => r.ok ? r.json() : []);
        const matchingPaths = prDetailPaths.filter(p => {
          const m = p.toLowerCase().match(/^([^/]+)\/(.+)\/pr-(\d+)\.json$/);
          if (!m) return false;
          return `${m[1]}/${m[2]}` === repoKey.toLowerCase() && Number(m[3]) === prNum;
        });

        const detailResults = await Promise.all(
          matchingPaths.map(async p => {
            try {
              const res = await fetch(`/data/${p}`);
              if (!res.ok) return null;
              return res.json();
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        const details = {};
        for (const d of detailResults.filter(Boolean)) {
          const prNum = d.prNumber ?? d.prDetails?.number;
          const dOwner = d.owner ?? owner;
          const dRepo = d.repo ?? repo;
          const detailKey = `${dOwner}/${dRepo}#${prNum}`;
          details[detailKey] = d;
          break;
        }
        setDetailByKey(details);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [repoKey, prNum, owner, repo]);

  const selectedRun = useMemo(() => {
    if (explicitRunId) {
      const found = runs.find(r => String(r.id) === explicitRunId);
      if (found) return found;
    }
    return runs[0] || null;
  }, [runs, explicitRunId]);
  const detailKey = `${owner}/${repo}#${prNum}`;
  const runDetail = selectedRun ? detailByKey[detailKey] || null : null;
  const runTimeline = selectedRun ? buildRunTimeline(selectedRun, runDetail) : [];

  const prSummary = useMemo(() => {
    if (runs.length === 0) return null;
    const prE2E = runDetail?.prSubmitToMerge?.durationSeconds ?? null;
    const prMergeWait = runDetail?.lastCiRemovalToMerge?.durationSeconds ?? null;
    return {
      prNumber: prNum,
      runCount: runs.length,
      successRate: getSuccessRate(runs),
      avgDuration: runs.reduce((sum, r) => sum + (r.durationInSeconds || 0), 0) / runs.length,
      latestStatus: runs[0].conclusion,
      latestCreatedAt: runs[0].created_at,
      prE2E,
      prMergeWait,
    };
  }, [runs, prNum, runDetail]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="skeleton h-4 w-48 rounded mb-6" />
          <div className="rounded-2xl border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
            <div className="skeleton h-3 w-32 rounded" />
            <div className="skeleton mt-3 h-10 w-80 rounded" />
            <div className="skeleton mt-4 h-5 w-64 rounded" />
          </div>
          <TableSkeleton rows={4} />
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
        <nav className="page-enter flex items-center gap-2 text-sm text-stone-400 mb-6" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-stone-200 transition-colors">首页</Link>
          <svg className="w-3 h-3 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          <Link to={`/repo/${owner}/${repo}`} className="hover:text-stone-200 transition-colors">{owner} / {repo}</Link>
          <svg className="w-3 h-3 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          <a href={`https://gitcode.com/${owner}/${repo}/merge_requests/${prNumber}`} target="_blank" rel="noreferrer" className="text-stone-200 hover:text-amber-300 hover:underline transition-colors">
            PR #{prNumber}
          </a>
        </nav>

        {prSummary && (
          <header className="page-enter stagger-1 rounded-2xl border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80 font-medium">PR CI Analysis</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl font-display">
              <a href={`https://gitcode.com/${owner}/${repo}`} target="_blank" rel="noreferrer" className="hover:text-amber-300 hover:underline transition-colors">
                {owner} / {repo}
              </a>
              {' — '}PR #{prNumber}
            </h1>
            {selectedRun && (
              <div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {prSummary.runCount} 次运行
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  成功率 {(prSummary.successRate * 100).toFixed(1)}%
                </span>
                <span>平均耗时 {formatSeconds(prSummary.avgDuration)}</span>
                {prSummary.prE2E !== null && <span>PR E2E {formatSeconds(prSummary.prE2E)}</span>}
                {prSummary.prMergeWait !== null && <span>合入等待 {formatSeconds(prSummary.prMergeWait)}</span>}
                <span className="text-stone-500">{new Date(prSummary.latestCreatedAt).toLocaleString()}</span>
              </div>
            )}
          </header>
        )}

        {selectedRun && prSummary && (
          <section className="page-enter stagger-2 mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="运行次数" value={prSummary.runCount} tone="amber" />
            <StatCard label="成功率" value={`${(prSummary.successRate * 100).toFixed(1)}%`} tone={prSummary.successRate >= 0.8 ? 'green' : prSummary.successRate >= 0.5 ? 'amber' : 'stone'} />
            <StatCard label="平均耗时" value={formatSeconds(prSummary.avgDuration)} tone="blue" />
            {prSummary.prE2E !== null && <StatCard label="PR E2E" value={formatSeconds(prSummary.prE2E)} tone="green" />}
          </section>
        )}

        {!selectedRun ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
            <div className="text-lg font-medium text-stone-700 font-display">该 PR 没有可分析的 CI 运行记录</div>
            <div className="mt-3 text-sm text-stone-500">
              <Link to={`/repo/${owner}/${repo}`} className="text-amber-700 hover:text-amber-900 hover:underline">
                返回仓库 PR 列表
              </Link>
            </div>
          </div>
        ) : (
          <div className="page-enter stagger-3 mt-6">
            <RunDetailView
              run={selectedRun}
              timeline={runTimeline}
              prMergeWaitSeconds={prSummary.prMergeWait}
              recentRuns={runs.slice(0, 8)}
              buildAnalysisHref={run => `/repo/${owner}/${repo}/${prNumber}?runId=${run.id}`}
              missingRequestedRun={false}
            />
          </div>
        )}
      </div>
    </div>
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
