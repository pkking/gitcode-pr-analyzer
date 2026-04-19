import React from 'react';
import { Link } from 'react-router-dom';
import {
  formatSeconds,
  getRunStageName,
} from '../utils/etlData.js';

export function RunDetailView({ run, timeline, recentRuns, buildAnalysisHref, missingRequestedRun }) {
  const totalDuration = getRunTotalDuration(run, timeline);
  const hasTimeline = timeline.length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Analysis</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              <a href={run.html_url} target="_blank" rel="noreferrer" className="hover:text-amber-700 hover:underline">
                {run.name}
              </a>
            </h2>
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
        {missingRequestedRun ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            未找到请求的 run，当前回退到该仓库最新的可用运行记录。
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Recent Runs</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">在分析页切换最近运行</h3>
          </div>
          <div className="text-xs text-stone-500">当前仓库最近 {recentRuns.length} 条</div>
        </div>

        <div className="mt-5 grid gap-3">
          {recentRuns.map(candidate => (
            <Link
              key={candidate.id}
              to={buildAnalysisHref(candidate)}
              className={`rounded-2xl border px-4 py-4 transition ${
                candidate.id === run.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-stone-50 hover:bg-white'
              }`}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    <a href={candidate.html_url} target="_blank" rel="noreferrer" className="hover:underline">
                      {candidate.name}
                      <span className="ml-1 text-[10px] opacity-50">↗</span>
                    </a>
                  </div>
                  <div className={`mt-1 text-xs ${candidate.id === run.id ? 'text-stone-300' : 'text-stone-500'}`}>
                    {new Date(candidate.created_at).toLocaleString()} · {getRunStageName(candidate)}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${candidate.id === run.id ? 'bg-white/10 text-white' : getConclusionBadgeClass(candidate.conclusion)}`}>
                  {candidate.conclusion || 'unknown'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Timeline</div>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight">{hasTimeline ? 'CI 全过程三段式示意图' : 'CI 状态'}</h3>
          </div>
          {hasTimeline ? <div className="text-sm text-stone-500">已匹配到 PR 明细，三段时间按真实节点展示。</div> : null}
        </div>

        {hasTimeline ? (
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
        ) : (
          <div className="mt-8 rounded-[28px] border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center text-stone-600">
            当前已识别到这次 CI 运行，但没有可用的三段拆解明细。
          </div>
        )}
      </section>

      {hasTimeline ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <SummaryCard label="CI启动时间" value={formatSeconds(timeline[0]?.seconds)} tone="amber" />
          <SummaryCard label="CI运行时间" value={formatSeconds(timeline[1]?.seconds)} tone="green" />
          <SummaryCard label="PR合入时间" value={formatSeconds(timeline[2]?.seconds)} tone="blue" />
        </section>
      ) : null}

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
                      {job.html_url ? (
                        <a href={job.html_url} target="_blank" rel="noreferrer" className="font-semibold text-stone-900 hover:text-amber-700 hover:underline">
                          {job.name}
                          <span className="ml-1 text-[10px] opacity-50">↗</span>
                        </a>
                      ) : (
                        <div className="font-semibold text-stone-900">{job.name}</div>
                      )}
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

export function SummaryCard({ label, value, sublabel, tone }) {
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

function getConclusionBadgeClass(conclusion) {
  if (conclusion === 'success') return 'bg-emerald-100 text-emerald-800';
  if (conclusion === 'failure') return 'bg-rose-100 text-rose-800';
  if (conclusion === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-stone-100 text-stone-700';
}

function getRunTotalDuration(run, timeline) {
  if (Array.isArray(timeline) && timeline.length > 0) {
    return timeline.reduce((sum, phase) => sum + phase.seconds, 0);
  }

  return Math.max(0, run?.durationInSeconds || 0);
}
