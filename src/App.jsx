import React, { useEffect, useMemo, useState } from 'react';
import {
  average,
  buildRepoRunList,
  formatSeconds,
  getPrDetailEntry,
  getRunPrNumber,
  getRunRepoParts,
  getRunStageName,
  getSuccessRate,
  listOrgEntries,
  listOrgPrDetailEntries,
  summarizeRun,
} from './utils/etlData.js';

function App() {
  const [indexData, setIndexData] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [repoRunsByKey, setRepoRunsByKey] = useState({});
  const [loadedFiles, setLoadedFiles] = useState({});
  const [detailByKey, setDetailByKey] = useState({});
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/index.json')
      .then(res => {
        if (!res.ok) throw new Error('Data index not found. Run the collector first.');
        return res.json();
      })
      .then(data => {
        const orgEntries = listOrgEntries(data);
        setIndexData(data);
        if (orgEntries.length > 0) {
          setSelectedOrg(orgEntries[0]);
          setExpandedOrgs({ [orgEntries[0].owner]: true });
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const orgEntries = useMemo(() => listOrgEntries(indexData), [indexData]);

  async function fetchRepoRuns(repoEntry) {
    if (!repoEntry || repoRunsByKey[repoEntry.key]) return repoRunsByKey[repoEntry.key] || [];

    setPanelLoading(true);

    try {
      const dayFiles = await Promise.all(
        repoEntry.files.map(async filePath => {
          if (loadedFiles[filePath]) return loadedFiles[filePath];

          const res = await fetch(`/data/${filePath}`);
          if (!res.ok) {
            throw new Error(`Failed to load ${filePath}`);
          }

          const data = await res.json();
          setLoadedFiles(prev => ({ ...prev, [filePath]: data }));
          return data;
        })
      );

      const filteredRuns = buildRepoRunList(dayFiles, repoEntry.key);
      setRepoRunsByKey(prev => ({ ...prev, [repoEntry.key]: filteredRuns }));
      return filteredRuns;
    } finally {
      setPanelLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedOrg) return;

    Promise.all(selectedOrg.repos.map(fetchRepoRuns)).catch(err => setError(err.message));
  }, [selectedOrg]);

  useEffect(() => {
    if (!selectedRepo) return;
    fetchRepoRuns(selectedRepo).catch(err => setError(err.message));
  }, [selectedRepo]);

  useEffect(() => {
    if (!selectedOrg) return;

    const orgDetailEntries = listOrgPrDetailEntries(selectedOrg.owner);
    if (orgDetailEntries.length === 0) return;

    Promise.all(
      orgDetailEntries.map(async entry => {
        if (detailByKey[entry.detailKey] !== undefined) return;

        const res = await fetch(entry.publicPath);
        if (!res.ok) {
          throw new Error(`Failed to load detail ${entry.publicPath}`);
        }

        const detail = await res.json();
        setDetailByKey(prev => ({ ...prev, [entry.detailKey]: detail }));
      })
    ).catch(err => setError(err.message));
  }, [selectedOrg, detailByKey]);

  useEffect(() => {
    if (!selectedRun) return;

    const runRepo = getRunRepoParts(selectedRun);
    const prNumber = getRunPrNumber(selectedRun);
    if (!runRepo || !prNumber) return;

    const detailEntry = getPrDetailEntry(runRepo.owner, runRepo.repo, prNumber);
    if (!detailEntry || detailByKey[detailEntry.detailKey] !== undefined) return;

    fetch(detailEntry.publicPath)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load detail ${detailEntry.publicPath}`);
        return res.json();
      })
      .then(detail => {
        setDetailByKey(prev => ({ ...prev, [detailEntry.detailKey]: detail }));
      })
      .catch(err => setError(err.message));
  }, [selectedRun, detailByKey]);

  const selectedRepoRuns = selectedRepo ? repoRunsByKey[selectedRepo.key] || [] : [];
  const selectedOrgRuns = useMemo(() => {
    if (!selectedOrg) return [];
    return selectedOrg.repos.flatMap(repo => repoRunsByKey[repo.key] || []);
  }, [selectedOrg, repoRunsByKey]);

  const selectedRunDetail = useMemo(() => {
    if (!selectedRun) return null;
    const runRepo = getRunRepoParts(selectedRun);
    const prNumber = getRunPrNumber(selectedRun);
    if (!runRepo || !prNumber) return null;

    const detailEntry = getPrDetailEntry(runRepo.owner, runRepo.repo, prNumber);
    if (!detailEntry) return null;

    return detailByKey[detailEntry.detailKey] ?? null;
  }, [selectedRun, detailByKey]);

  const orgStageMetrics = useMemo(() => {
    const stageMap = new Map();

    for (const run of selectedOrgRuns) {
      const stage = getRunStageName(run);
      if (!stageMap.has(stage)) {
        stageMap.set(stage, {
          stage,
          runs: [],
        });
      }
      stageMap.get(stage).runs.push(run);
    }

    return Array.from(stageMap.values())
      .map(entry => ({
        stage: entry.stage,
        count: entry.runs.length,
        successRate: getSuccessRate(entry.runs),
        avgDuration: average(entry.runs.map(run => run.durationInSeconds)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [selectedOrgRuns]);

  const orgMergeDurations = useMemo(() => {
    if (!selectedOrg) return [];

    return listOrgPrDetailEntries(selectedOrg.owner)
      .map(entry => detailByKey[entry.detailKey]?.prSubmitToMerge?.durationSeconds)
      .filter(value => Number.isFinite(value));
  }, [detailByKey, selectedOrg]);

  const orgSummary = useMemo(() => ({
    totalRuns: selectedOrgRuns.length,
    successRate: getSuccessRate(selectedOrgRuns),
    avgCiDuration: average(selectedOrgRuns.map(run => run.durationInSeconds)),
    avgMergeDuration: average(orgMergeDurations),
  }), [selectedOrgRuns, orgMergeDurations]);

  const runTimeline = useMemo(() => buildRunTimeline(selectedRun, selectedRunDetail), [selectedRun, selectedRunDetail]);

  if (loading && !indexData) return <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">Loading index...</div>;
  if (error) return <div className="min-h-screen bg-stone-950 text-red-300 flex items-center justify-center px-6 text-center">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.12),_transparent_28%),linear-gradient(180deg,_#0c0a09_0%,_#171717_45%,_#fafaf9_45%,_#f5f5f4_100%)] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-[28px] border border-stone-800 bg-stone-950/85 px-6 py-6 text-stone-100 shadow-2xl shadow-stone-950/30 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">GitCode PR Analyzer</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">组织维度的 CI 全景与单次流程拆解</h1>
              <p className="max-w-3xl text-sm text-stone-300">
                左侧按组织与仓库展开。组织视图展示整体阶段统计，仓库视图展示具体 CI 列表，详情页用三段式示意图解释完整耗时。
              </p>
            </div>
            {indexData?.last_updated ? (
              <div className="rounded-2xl border border-stone-800 bg-stone-900/80 px-4 py-3 text-right">
                <div className="text-[11px] uppercase tracking-[0.25em] text-stone-500">Last Updated</div>
                <div className="mt-1 text-sm text-stone-200">{new Date(indexData.last_updated).toLocaleString()}</div>
              </div>
            ) : null}
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

            <nav className="space-y-3">
              {orgEntries.map(org => {
                const isExpanded = expandedOrgs[org.owner] ?? false;
                const isSelectedOrg = selectedOrg?.owner === org.owner && !selectedRepo;

                return (
                  <div key={org.owner} className="rounded-2xl border border-stone-200 bg-stone-50/80">
                    <button
                      onClick={() => {
                        setExpandedOrgs(prev => ({ ...prev, [org.owner]: !isExpanded }));
                        setSelectedOrg(org);
                        setSelectedRepo(null);
                        setSelectedRun(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                        isSelectedOrg ? 'bg-stone-900 text-white' : 'hover:bg-stone-100'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold">{org.owner}</div>
                        <div className={`text-xs ${isSelectedOrg ? 'text-stone-300' : 'text-stone-500'}`}>
                          {org.repos.length} repositories
                        </div>
                      </div>
                      <span className={`text-xs ${isSelectedOrg ? 'text-amber-300' : 'text-stone-500'}`}>
                        {isExpanded ? '收起' : '展开'}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="space-y-1 px-2 pb-2">
                        {org.repos.map(repo => {
                          const isActive = selectedRepo?.key === repo.key;
                          const repoRuns = repoRunsByKey[repo.key] || [];
                          return (
                            <button
                              key={repo.key}
                              onClick={() => {
                                setSelectedOrg(org);
                                setSelectedRepo(repo);
                                setSelectedRun(null);
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                isActive ? 'bg-amber-100 text-amber-950' : 'text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              <span className="truncate">{repo.repo}</span>
                              <span className={`ml-3 shrink-0 text-[11px] ${isActive ? 'text-amber-700' : 'text-stone-400'}`}>
                                {repoRuns.length || repo.files.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>
          </aside>

          <main className="space-y-6">
            {selectedRun ? (
              <RunDetailView
                run={selectedRun}
                detail={selectedRunDetail}
                timeline={runTimeline}
                onBack={() => setSelectedRun(null)}
              />
            ) : selectedRepo ? (
              <RepoView
                repo={selectedRepo}
                runs={selectedRepoRuns}
                onSelectRun={setSelectedRun}
              />
            ) : selectedOrg ? (
              <OrgView org={selectedOrg} summary={orgSummary} stageMetrics={orgStageMetrics} repoRunsByKey={repoRunsByKey} />
            ) : (
              <EmptyState />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function OrgView({ org, summary, stageMetrics, repoRunsByKey }) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Organization Overview</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{org.owner}</h2>
            <p className="mt-2 text-sm text-stone-600">点击左侧仓库可以继续下钻到具体 run，再进入单次 CI 的三段流程视图。</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="CI 总次数" value={String(summary.totalRuns)} tone="stone" />
          <SummaryCard label="整体成功率" value={formatPercent(summary.successRate)} tone="green" />
          <SummaryCard label="CI 平均运行耗时" value={formatSeconds(summary.avgCiDuration)} tone="amber" />
          <SummaryCard
            label="CI 合入平均耗时"
            value={summary.avgMergeDuration ? formatSeconds(summary.avgMergeDuration) : '--'}
            sublabel={summary.avgMergeDuration ? '基于当前组织已索引的 PR 明细计算' : '当前组织没有可用的 PR 明细样本'}
            tone="blue"
          />
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Stage Breakdown</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">组织内各阶段统计</h3>
          </div>
          <div className="text-xs text-stone-500">按 run 的主 job 名称聚合</div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {stageMetrics.map(metric => (
            <div key={metric.stage} className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-stone-900">{metric.stage}</div>
                  <div className="mt-1 text-xs text-stone-500">{metric.count} 次运行</div>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700">
                  平均 {formatSeconds(metric.avgDuration)}
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${metric.successRate * 100}%` }} />
              </div>
              <div className="mt-2 text-xs text-stone-600">成功率 {formatPercent(metric.successRate)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Repositories</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {org.repos.map(repo => {
            const runs = repoRunsByKey[repo.key] || [];
            return (
              <div key={repo.key} className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-4">
                <div className="text-lg font-semibold text-stone-900">{repo.repo}</div>
                <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                  <span>{runs.length} runs</span>
                  <span>{formatPercent(getSuccessRate(runs))} success</span>
                </div>
                <div className="mt-2 text-sm text-stone-500">平均运行耗时 {formatSeconds(average(runs.map(run => run.durationInSeconds)))}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RepoView({ repo, runs, onSelectRun }) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Repository</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{repo.owner} / {repo.repo}</h2>
            <p className="mt-2 text-sm text-stone-600">按最近 run 倒序展示。点击任意一条进入 CI 三段流程详情页。</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            共 {runs.length} 次 CI
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white/90 shadow-lg shadow-stone-200/60">
        <div className="border-b border-stone-200 bg-stone-50/80 px-6 py-4">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Runs</div>
        </div>
        <ul className="divide-y divide-stone-200">
          {runs.map(run => {
            const summary = summarizeRun(run);
            return (
              <li key={run.id}>
                <button
                  onClick={() => onSelectRun(run)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-stone-900">{summary.title}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-500">
                      <span>{new Date(summary.createdAt).toLocaleString()}</span>
                      <span>{getRunStageName(run)}</span>
                      <span>{summary.durationText}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${getConclusionBadgeClass(run.conclusion)}`}>
                      {run.conclusion || 'unknown'}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">View</span>
                  </div>
                </button>
              </li>
            );
          })}
          {runs.length === 0 ? (
            <li className="px-6 py-10 text-center text-sm text-stone-500">当前仓库暂无可展示的 CI runs。</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function RunDetailView({ run, detail, timeline, onBack }) {
  const totalDuration = timeline.reduce((sum, phase) => sum + phase.seconds, 0);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center rounded-full border border-stone-300 bg-white/90 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-50">
        返回仓库列表
      </button>

      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">CI Detail</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{run.name}</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-stone-500">
              <span>创建时间 {new Date(run.created_at).toLocaleString()}</span>
              <span>阶段 {getRunStageName(run)}</span>
              <span>总耗时 {formatSeconds(totalDuration)}</span>
            </div>
          </div>
          <a
            className="inline-flex items-center rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            href={run.html_url}
            target="_blank"
            rel="noreferrer"
          >
            打开 Merge Request
          </a>
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Timeline</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">CI 全过程三段式示意图</h3>
          </div>
          <div className="text-sm text-stone-500">
            {detail ? '已匹配到 PR 明细，三段时间按真实节点展示。' : '未找到 PR 明细，已降级为使用当前 run 的队列 / 执行 / 总耗时推导。'}
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-stone-200 bg-stone-950 px-5 py-6 text-white">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-stone-400">
            <span>CI触发</span>
            <span>CI启动</span>
            <span>CI完成</span>
            <span>PR合入</span>
          </div>

          <div className="mt-4 flex h-5 overflow-hidden rounded-full bg-stone-800">
            {timeline.map(phase => (
              <div
                key={phase.key}
                className={`${phase.barClass} h-full transition-all`}
                style={{ width: `${totalDuration > 0 ? (phase.seconds / totalDuration) * 100 : 0}%` }}
                title={`${phase.label}: ${formatSeconds(phase.seconds)}`}
              />
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {timeline.map(phase => (
              <div key={phase.key} className="rounded-3xl border border-stone-800 bg-stone-900/90 px-4 py-6">
                <div className="text-center text-2xl font-semibold text-amber-300">{formatSeconds(phase.seconds)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard label="CI启动时间" value={formatSeconds(timeline[0]?.seconds)} tone="amber" />
        <SummaryCard label="CI运行时间" value={formatSeconds(timeline[1]?.seconds)} tone="green" />
        <SummaryCard label="PR合入时间" value={formatSeconds(timeline[2]?.seconds)} tone="blue" />
      </section>

      <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white/90 shadow-lg shadow-stone-200/60">
        <div className="border-b border-stone-200 bg-stone-50/80 px-6 py-4">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Jobs</div>
        </div>
        <div className="p-6">
          {run.jobs?.length ? (
            <ul className="space-y-3">
              {run.jobs.map(job => (
                <li key={job.id} className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold text-stone-900">{job.name}</div>
                      <div className="mt-1 text-sm text-stone-500">
                        Queue {formatSeconds(job.queueDurationInSeconds)} · Run {formatSeconds(job.durationInSeconds)}
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getConclusionBadgeClass(job.conclusion)}`}>
                      {job.conclusion}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-stone-500">No jobs found.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, sublabel, tone }) {
  const toneClass = {
    stone: 'bg-stone-100 text-stone-900',
    green: 'bg-emerald-100 text-emerald-950',
    amber: 'bg-amber-100 text-amber-950',
    blue: 'bg-sky-100 text-sky-950',
  }[tone || 'stone'];

  return (
    <div className={`rounded-3xl px-5 py-5 ${toneClass}`}>
      <div className="text-xs uppercase tracking-[0.24em] opacity-70">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {sublabel ? <div className="mt-2 text-sm opacity-75">{sublabel}</div> : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/80 px-6 py-20 text-center text-stone-500">
      从左侧选择一个组织或仓库开始浏览。
    </div>
  );
}

function buildRunTimeline(run, detail) {
  if (!run) return [];

  const primaryJob = Array.isArray(run.jobs) && run.jobs.length > 0 ? run.jobs[0] : null;
  const fallbackPhaseOne = primaryJob?.queueDurationInSeconds || 0;
  const fallbackPhaseTwo = primaryJob?.durationInSeconds || Math.max(0, (run.durationInSeconds || 0) - fallbackPhaseOne);
  const fallbackPhaseThree = 0;

  if (!detail) {
    return [
      {
        key: 'comment_to_label',
        eyebrow: 'Phase 1',
        label: 'CI启动时间',
        seconds: fallbackPhaseOne,
        description: '',
        barClass: 'bg-amber-400',
      },
      {
        key: 'label_to_remove',
        eyebrow: 'Phase 2',
        label: 'CI运行时间',
        seconds: fallbackPhaseTwo,
        description: '',
        barClass: 'bg-emerald-400',
      },
      {
        key: 'remove_to_merge',
        eyebrow: 'Phase 3',
        label: 'PR合入时间',
        seconds: fallbackPhaseThree,
        description: '',
        barClass: 'bg-sky-400',
      },
    ];
  }

  const matchedCycle = matchCycleToRun(run, detail.compileToCiCycles || []);
  const phaseOne = matchedCycle
    ? Math.max(0, (new Date(matchedCycle.compileTime).getTime() - new Date(run.created_at).getTime()) / 1000)
    : fallbackPhaseOne;
  const phaseTwo = matchedCycle?.durationSeconds ?? fallbackPhaseTwo;
  const phaseThree = detail.lastCiRemovalToMerge?.durationSeconds ?? fallbackPhaseThree;

  return [
    {
      key: 'comment_to_label',
      eyebrow: 'Phase 1',
      label: 'CI启动时间',
      seconds: phaseOne,
      description: '',
      barClass: 'bg-amber-400',
    },
    {
      key: 'label_to_remove',
      eyebrow: 'Phase 2',
      label: 'CI运行时间',
      seconds: phaseTwo,
      description: '',
      barClass: 'bg-emerald-400',
    },
    {
      key: 'remove_to_merge',
      eyebrow: 'Phase 3',
      label: 'PR合入时间',
      seconds: phaseThree,
      description: '',
      barClass: 'bg-sky-400',
    },
  ];
}

function matchCycleToRun(run, cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) return null;

  const primaryJob = Array.isArray(run.jobs) && run.jobs.length > 0 ? run.jobs[0] : null;
  const startedAt = primaryJob?.started_at ? new Date(primaryJob.started_at).getTime() : new Date(run.created_at).getTime();

  return cycles.reduce((best, cycle) => {
    const diff = Math.abs(new Date(cycle.compileTime).getTime() - startedAt);
    if (!best || diff < best.diff) {
      return { diff, cycle };
    }
    return best;
  }, null)?.cycle || null;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '--';
  return `${(value * 100).toFixed(1)}%`;
}

function getConclusionBadgeClass(conclusion) {
  if (conclusion === 'success') return 'bg-emerald-100 text-emerald-800';
  if (conclusion === 'failure') return 'bg-rose-100 text-rose-800';
  if (conclusion === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-stone-100 text-stone-700';
}

export default App;
