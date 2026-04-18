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
          return `${m[1]}/${m[2]}` === repoKey && Number(m[3]) === prNum;
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
          details[`pr-${prNum}`] = d;
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
  }, [repoKey, prNum]);

  const selectedRun = useMemo(() => {
    if (explicitRunId) {
      const found = runs.find(r => String(r.id) === explicitRunId);
      if (found) return found;
    }
    return runs[0] || null;
  }, [runs, explicitRunId]);
  const runDetail = selectedRun ? detailByKey[`pr-${prNum}`] || null : null;
  const runTimeline = selectedRun ? buildRunTimeline(selectedRun, runDetail) : [];

  const prSummary = useMemo(() => {
    if (runs.length === 0) return null;
    return {
      prNumber: prNum,
      runCount: runs.length,
      successRate: getSuccessRate(runs),
      avgDuration: runs.reduce((sum, r) => sum + (r.durationInSeconds || 0), 0) / runs.length,
      latestStatus: runs[0].conclusion,
      latestCreatedAt: runs[0].created_at,
    };
  }, [runs, prNum]);

  if (loading) {
    return <FullScreenMessage tone="stone">Loading PR analysis...</FullScreenMessage>;
  }

  if (error) {
    return <FullScreenMessage tone="error">Error: {error}</FullScreenMessage>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-3 text-sm text-stone-400 mb-6">
          <Link to="/" className="hover:text-stone-200">首页</Link>
          <span>/</span>
          <Link to={`/repo/${owner}/${repo}`} className="hover:text-stone-200">{owner} / {repo}</Link>
          <span>/</span>
          <span className="text-stone-200">PR #{prNumber}</span>
        </nav>

        {prSummary && (
          <header className="rounded-[32px] border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">PR CI Analysis</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              {owner} / {repo} — PR #{prNumber}
            </h1>
            {selectedRun && (
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-stone-300">
                <span>共 {prSummary.runCount} 次运行</span>
                <span>成功率 {(prSummary.successRate * 100).toFixed(1)}%</span>
                <span>平均耗时 {formatSeconds(prSummary.avgDuration)}</span>
                <span>最新 {new Date(prSummary.latestCreatedAt).toLocaleString()}</span>
              </div>
            )}
          </header>
        )}

        {!selectedRun ? (
          <div className="mt-8 rounded-[28px] border border-dashed border-stone-300 bg-white/80 px-6 py-20 text-center text-stone-500">
            <div className="text-lg font-medium text-stone-700">该 PR 没有可分析的 CI 运行记录</div>
            <div className="mt-3 text-sm text-stone-500">
              <Link to={`/repo/${owner}/${repo}`} className="text-amber-700 hover:text-amber-900 hover:underline">
                返回仓库 PR 列表
              </Link>
            </div>
          </div>
        ) : (
          <RunDetailView
            run={selectedRun}
            timeline={runTimeline}
            recentRuns={runs.slice(0, 8)}
            buildAnalysisHref={run => `/repo/${owner}/${repo}/${prNumber}?runId=${run.id}`}
            missingRequestedRun={false}
          />
        )}
      </div>
    </div>
  );
}

function FullScreenMessage({ children, tone }) {
  const textClass = tone === 'error' ? 'text-red-300' : 'text-stone-100';
  return <div className={`flex min-h-screen items-center justify-center bg-stone-950 px-6 text-center ${textClass}`}>{children}</div>;
}
