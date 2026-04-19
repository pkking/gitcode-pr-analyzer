import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  formatSeconds,
  getSuccessRate,
  listRepoEntries,
} from '../utils/etlData.js';
import { TableSkeleton, Badge, MetricValue } from '../components/ui.jsx';

async function fetchPrE2EForRepo(repoKey) {
  try {
    const res = await fetch('/data/pr-details-index.json');
    if (!res.ok) return {};
    const paths = await res.json();
    const matchingPaths = paths.filter(p => {
      const m = p.toLowerCase().match(/^([^/]+)\/(.+)\/pr-(\d+)\.json$/);
      if (!m) return false;
      return `${m[1]}/${m[2]}` === repoKey.toLowerCase();
    });

    const results = await Promise.all(
      matchingPaths.map(async p => {
        try {
          const detailRes = await fetch(`/data/${p}`);
          if (!detailRes.ok) return null;
          return detailRes.json();
        } catch {
          return null;
        }
      })
    );

    const e2eMap = {};
    for (const d of results.filter(Boolean)) {
      const prNum = d.prNumber ?? d.prDetails?.number;
      if (prNum != null && d.prSubmitToMerge?.durationSeconds != null) {
        e2eMap[prNum] = d.prSubmitToMerge.durationSeconds;
      }
    }
    return e2eMap;
  } catch {
    return {};
  }
}

export default function RepoDetailPage() {
  const { owner, repo } = useParams();
  const repoKey = `${owner}/${repo}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runs, setRuns] = useState([]);
  const [prE2EMap, setPrE2EMap] = useState({});

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
            const url = new URL(run.html_url || '');
            const segments = url.pathname.split('/').filter(Boolean);
            const mrIdx = segments.findIndex(s => s === 'merge_requests');
            if (mrIdx < 2) return false;
            const runOwner = segments[mrIdx - 2];
            const runRepo = segments[mrIdx - 1];
            return `${runOwner}/${runRepo}` === repoKey;
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setRuns(allRuns);

        const e2eMap = await fetchPrE2EForRepo(repoKey);
        if (!cancelled) setPrE2EMap(e2eMap);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [repoKey]);

  const prGroups = useMemo(() => {
    const prMap = new Map();

    for (const run of runs) {
      const match = String(run.name || '').match(/PR\s+#(\d+)/i);
      const prNumber = match ? Number(match[1]) : null;
      if (prNumber === null) continue;

      if (!prMap.has(prNumber)) {
        prMap.set(prNumber, { prNumber, runs: [], title: run.name.replace(/PR\s+#\d+\s+\S+\s+-\s*/, '').substring(0, 80) });
      }
      prMap.get(prNumber).runs.push(run);
    }

    return Array.from(prMap.values())
      .map(pr => {
        const latestRun = pr.runs[0];
        return {
          ...pr,
          runCount: pr.runs.length,
          latestStatus: latestRun.conclusion,
          latestDuration: latestRun.durationInSeconds,
          latestCreatedAt: latestRun.created_at,
          successRate: getSuccessRate(pr.runs),
          avgDuration: pr.runs.reduce((sum, r) => sum + (r.durationInSeconds || 0), 0) / pr.runs.length,
          prE2E: prE2EMap[pr.prNumber] ?? null,
        };
      })
      .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());
  }, [runs, prE2EMap]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton mt-3 h-10 w-64 rounded" />
            <div className="skeleton mt-3 h-5 w-80 rounded" />
          </div>
          <TableSkeleton rows={6} />
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
          <a href={`https://gitcode.com/${owner}/${repo}`} target="_blank" rel="noreferrer" className="text-stone-200 hover:text-amber-300 hover:underline transition-colors">
            {owner} / {repo}
          </a>
        </nav>

        <header className="page-enter stagger-1 rounded-2xl border border-stone-800 bg-stone-950/90 px-8 py-10 text-stone-100 shadow-2xl shadow-stone-950/30">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl font-display">
            <a href={`https://gitcode.com/${owner}/${repo}`} target="_blank" rel="noreferrer" className="hover:text-amber-300 hover:underline transition-colors">
              {owner} / {repo}
            </a>
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-stone-300 sm:text-base">
            该仓库共 {prGroups.length} 个 PR，{runs.length} 次 CI 运行。点击 PR 进入 CI 分析页面。
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {prGroups.length} 个 PR
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {runs.length} 次运行
            </span>
          </div>
        </header>

        <section className="page-enter stagger-2 mt-8 overflow-hidden rounded-2xl border border-stone-200 bg-white/90 shadow-lg shadow-stone-200/60">
          <div className="border-b border-stone-200 bg-stone-50/80 px-6 py-4">
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 font-medium">Pull Requests</div>
            <div className="mt-1 text-lg font-semibold text-stone-900 font-display">
              {prGroups.length} 个 PR · {runs.length} 次运行
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 text-xs uppercase tracking-[0.24em] text-stone-500">
                  <th className="px-6 py-4 font-medium">PR</th>
                  <th className="px-6 py-4 font-medium">标题</th>
                  <th className="px-6 py-4 font-medium">PR E2E</th>
                  <th className="px-6 py-4 font-medium">次数</th>
                  <th className="px-6 py-4 font-medium">状态</th>
                  <th className="px-6 py-4 font-medium">最新耗时</th>
                  <th className="px-6 py-4 font-medium">平均耗时</th>
                  <th className="px-6 py-4 font-medium">成功率</th>
                  <th className="px-6 py-4 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {prGroups.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-sm text-stone-500">
                      暂无 PR 数据。
                    </td>
                  </tr>
                ) : prGroups.map((pr, idx) => (
                  <tr
                    key={pr.prNumber}
                    className="border-b border-stone-100 table-row-hover"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <td className="px-6 py-4">
                      <Link to={`/repo/${owner}/${repo}/${pr.prNumber}`} className="text-sm font-medium text-amber-700 hover:text-amber-900 hover:underline font-display">
                        #{pr.prNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <a
                        href={`https://gitcode.com/${owner}/${repo}/merge_requests/${pr.prNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-stone-900 hover:text-amber-700 hover:underline truncate block"
                        title={pr.title}
                      >
                        {pr.title}
                      </a>
                    </td>
                    <td className="px-6 py-4"><MetricValue p50={pr.prE2E} p90={null} /></td>
                    <td className="px-6 py-4 text-sm text-stone-600 font-mono">{pr.runCount}</td>
                    <td className="px-6 py-4">
                      <Badge>{pr.latestStatus}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-900">{formatSeconds(pr.latestDuration)}</td>
                    <td className="px-6 py-4 text-sm text-stone-900">{formatSeconds(pr.avgDuration)}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{(pr.successRate * 100).toFixed(1)}%</td>
                    <td className="px-6 py-4 text-xs text-stone-500 whitespace-nowrap">{new Date(pr.latestCreatedAt).toLocaleString()}</td>
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
