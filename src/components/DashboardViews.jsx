import React from 'react';
import { Link } from 'react-router-dom';
import {
  average,
  formatSeconds,
  getSuccessRate,
  getRunStageName,
  summarizeRun,
} from '../utils/etlData.js';

export function OrgView({ org, summary, stageMetrics, repoRunsByKey, buildBrowseHref }) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Organization Overview</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{org.owner}</h2>
            <p className="mt-2 text-sm text-stone-600">点击左侧仓库可以继续下钻到具体 run，再进入单次分析视图。</p>
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
              <Link
                key={repo.key}
                to={buildBrowseHref(repo)}
                className="rounded-3xl border border-stone-200 bg-stone-50 px-5 py-4 transition hover:border-stone-300 hover:bg-white"
              >
                <div className="text-lg font-semibold text-stone-900">{repo.repo}</div>
                <div className="mt-3 flex items-center justify-between text-sm text-stone-600">
                  <span>{runs.length} runs</span>
                  <span>{formatPercent(getSuccessRate(runs))} success</span>
                </div>
                <div className="mt-2 text-sm text-stone-500">平均运行耗时 {formatSeconds(average(runs.map(run => run.durationInSeconds)))}</div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function RepoView({ repo, runs, buildAnalysisHref }) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Repository</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{repo.owner} / {repo.repo}</h2>
            <p className="mt-2 text-sm text-stone-600">按最近 run 倒序展示。点击任意一条进入独立分析页。</p>
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
                <Link
                  to={buildAnalysisHref(run)}
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
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Analyze</span>
                  </div>
                </Link>
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

export function RunDetailView({ run, detail, timeline, recentRuns, buildAnalysisHref, missingRequestedRun }) {
  const totalDuration = getRunTotalDuration(run, timeline);
  const hasTimeline = timeline.length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-lg shadow-stone-200/60">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-stone-500">Analysis</div>
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
                  <div className="truncate text-sm font-semibold">{candidate.name}</div>
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

export function EmptyState({ title = '从左侧选择一个组织或仓库开始浏览。', body }) {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/80 px-6 py-20 text-center text-stone-500">
      <div className="text-lg font-medium text-stone-700">{title}</div>
      {body ? <div className="mt-3 text-sm text-stone-500">{body}</div> : null}
    </div>
  );
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

function getRunTotalDuration(run, timeline) {
  if (Array.isArray(timeline) && timeline.length > 0) {
    return timeline.reduce((sum, phase) => sum + phase.seconds, 0);
  }

  return Math.max(0, run?.durationInSeconds || 0);
}
