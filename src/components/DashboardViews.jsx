import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  formatSeconds,
  getRunStageName,
} from '../utils/etlData.js';
import { Badge, StatCard } from '../components/ui.jsx';

export function RunDetailView({ run, timeline, prMergeWaitSeconds, recentRuns, buildAnalysisHref, missingRequestedRun }) {
  const navigate = useNavigate();
  const totalDuration = getRunTotalDuration(run, timeline);
  const hasTimeline = timeline.length > 0;
  const hasPrMergeWait = Number.isFinite(prMergeWaitSeconds);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60 card-hover">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 font-medium">Analysis</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight font-display">
              <a href={run.html_url} target="_blank" rel="noreferrer" className="hover:text-amber-700 hover:underline transition-colors">
                {run.name}
              </a>
            </h2>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-stone-500">
              <span>创建时间 {new Date(run.created_at).toLocaleString()}</span>
              <span>阶段 {getRunStageName(run)}</span>
              <span>总耗时 {formatSeconds(totalDuration)}</span>
            </div>
          </div>
          <a
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-stone-700 hover:shadow-lg hover:shadow-stone-900/20"
            href={run.html_url}
            target="_blank"
            rel="noreferrer"
          >
            打开 Merge Request
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
          </a>
        </div>
        {missingRequestedRun ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            未找到请求的 run，当前回退到该仓库最新的可用运行记录。
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 font-medium">Recent Runs</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight font-display">在分析页切换最近运行</h3>
          </div>
          <div className="text-xs text-stone-500">最近 {recentRuns.length} 条</div>
        </div>

        <div className="mt-5 grid gap-3">
          {recentRuns.map(candidate => (
            <div
              key={candidate.id}
              className={`rounded-xl border px-4 py-4 transition-all duration-200 ${
                candidate.id === run.id
                  ? 'border-stone-900 bg-stone-900 text-white shadow-md'
                  : 'border-stone-200 bg-stone-50 hover:bg-white hover:shadow-md hover:border-stone-300'
              }`}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 truncate">
                    <a
                      href={candidate.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-semibold font-display hover:underline"
                    >
                      {candidate.name}
                    </a>
                    <button
                      onClick={() => navigate(buildAnalysisHref(candidate))}
                      className={`shrink-0 rounded-lg p-1 transition-colors ${
                        candidate.id === run.id
                          ? 'text-stone-300 hover:text-white hover:bg-white/10'
                          : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                      }`}
                      title="Analyze this run"
                      aria-label={`Analyze run: ${candidate.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h9.75m4.5-4.5v12m0 0-3.75-3.75M17.25 21 21 17.25" />
                      </svg>
                    </button>
                  </div>
                  <div className={`mt-1 text-xs ${candidate.id === run.id ? 'text-stone-300' : 'text-stone-500'}`}>
                    {new Date(candidate.created_at).toLocaleString()} · {getRunStageName(candidate)}
                  </div>
                </div>
                <Badge
                  className={candidate.id === run.id ? '!bg-white/15 !text-white !ring-white/20' : ''}
                >
                  {candidate.conclusion || 'unknown'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500 font-medium">Timeline</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight font-display">{hasTimeline ? 'CI 执行过程两段式示意图' : 'CI 状态'}</h3>
          </div>
          {hasTimeline ? <div className="text-sm text-stone-500">已匹配到 PR 明细，CI 时间按触发、启动、完成节点展示。</div> : null}
        </div>

        {hasTimeline ? (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-950 px-5 py-6 text-white">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-stone-400">
              <span>CI触发</span>
              <span>CI启动</span>
              <span>CI完成</span>
            </div>

            <div className="mt-4 flex h-5 overflow-hidden rounded-full bg-stone-800">
              {timeline.map(phase => (
                <div
                  key={phase.key}
                  className={`${phase.barClass} h-full transition-all duration-700 ease-out`}
                  style={{ width: `${totalDuration > 0 ? (phase.seconds / totalDuration) * 100 : 0}%` }}
                  title={`${phase.label}: ${formatSeconds(phase.seconds)}`}
                />
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {timeline.map(phase => (
                <div key={phase.key} className="rounded-xl border border-stone-800 bg-stone-900/90 px-4 py-5 text-center">
                  <div className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">{phase.label}</div>
                  <div className="text-2xl font-semibold text-amber-300 font-display">{formatSeconds(phase.seconds)}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center text-stone-600">
            当前已识别到这次 CI 运行，但没有可用的 CI 拆解明细。
          </div>
        )}
      </section>

      {hasTimeline ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard label="CI启动时间" value={formatSeconds(timeline[0]?.seconds)} tone="amber" />
          <StatCard label="CI运行时间" value={formatSeconds(timeline[1]?.seconds)} tone="green" />
        </section>
      ) : null}

      {hasPrMergeWait ? (
        <section className="rounded-2xl border border-sky-100 bg-sky-50/80 p-6 shadow-lg shadow-sky-100/70">
          <div className="text-xs uppercase tracking-[0.3em] text-sky-700/70 font-medium">PR Level Metric</div>
          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-stone-900 font-display">PR合入等待时间</h3>
              <p className="mt-2 max-w-2xl text-sm text-stone-600">
                这是整个 PR 的一次性指标，表示最后一次 CI 完成后到 PR 合入之间的时间，不属于单次 CI 的执行过程。
              </p>
            </div>
            <div className="text-4xl font-semibold text-sky-800 font-display">{formatSeconds(prMergeWaitSeconds)}</div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white/90 shadow-lg shadow-stone-200/60">
        <div className="border-b border-stone-200 bg-stone-50/80 px-6 py-4">
          <div className="text-xs uppercase tracking-[0.3em] text-stone-500 font-medium">Jobs</div>
        </div>
        <div className="p-6">
          {run.jobs?.length ? (
            <ul className="space-y-3">
              {run.jobs.map(job => (
                <li key={job.id} className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 card-hover">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      {job.html_url ? (
                        <a href={job.html_url} target="_blank" rel="noreferrer" className="font-semibold text-stone-900 hover:text-amber-700 hover:underline font-display">
                          {job.name}
                        </a>
                      ) : (
                        <div className="font-semibold text-stone-900 font-display">{job.name}</div>
                      )}
                      <div className="mt-1 text-sm text-stone-500">
                        Queue {formatSeconds(job.queueDurationInSeconds)} · Run {formatSeconds(job.durationInSeconds)}
                      </div>
                    </div>
                    <Badge>{job.conclusion}</Badge>
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

function getRunTotalDuration(run, timeline) {
  if (Array.isArray(timeline) && timeline.length > 0) {
    return timeline.reduce((sum, phase) => sum + phase.seconds, 0);
  }

  return Math.max(0, run?.durationInSeconds || 0);
}
