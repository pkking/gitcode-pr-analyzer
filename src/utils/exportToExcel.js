import { percentile, getSuccessRate, getRunRepoKey, getRunPrNumber, getRunStageName } from './etlData.js';

const MAX_DAYS = 90;
const CONCURRENCY_LIMIT = 6;

const DETAIL_COLUMNS = [
  { key: 'date', label: '日期', type: String },
  { key: 'repo', label: '仓库', type: String },
  { key: 'prNumber', label: 'PR号', type: Number },
  { key: 'runName', label: 'Run名称', type: String },
  { key: 'stage', label: 'CI阶段', type: String },
  { key: 'conclusion', label: '状态', type: String },
  { key: 'totalDuration', label: '总耗时(秒)', type: Number },
  { key: 'queueDuration', label: '队列等待(秒)', type: Number },
  { key: 'execDuration', label: '执行耗时(秒)', type: Number },
  { key: 'jobName', label: 'Job名称', type: String },
  { key: 'jobCount', label: 'Job数量', type: Number },
  { key: 'createdAt', label: '创建时间', type: Date },
  { key: 'updatedAt', label: '更新时间', type: Date },
  { key: 'runUrl', label: 'Run链接', type: String },
];

const DEFINITION_COLUMNS = [
  { key: '指标名称', label: '指标名称', type: String },
  { key: '定义说明', label: '定义说明', type: String },
];

const SUMMARY_COLUMNS = [
  { key: 'repo', label: '仓库', type: String },
  { key: 'prE2EP50', label: 'PR E2E P50', type: Number },
  { key: 'prE2EP90', label: 'PR E2E P90', type: Number },
  { key: 'ciE2EP50', label: 'CI E2E P50', type: Number },
  { key: 'ciE2EP90', label: 'CI E2E P90', type: Number },
  { key: 'ciStartupP50', label: 'CI启动 P50', type: Number },
  { key: 'ciStartupP90', label: 'CI启动 P90', type: Number },
  { key: 'ciExecP50', label: 'CI执行 P50', type: Number },
  { key: 'ciExecP90', label: 'CI执行 P90', type: Number },
  { key: 'prReviewP50', label: 'PR检视 P50', type: Number },
  { key: 'prReviewP90', label: 'PR检视 P90', type: Number },
  { key: 'runCount', label: '运行次数', type: Number },
  { key: 'complianceRate', label: '达标率', type: Number },
];

const SUMMARY_DEFINITIONS = [
  { 指标名称: 'PR E2E P50/P90', 定义说明: '从 PR 创建到 Merge 的中位/90分位耗时（秒）。注：当前导出基于 CI run 数据，不含 PR 创建/Merge 时间戳，该列暂为空。' },
  { 指标名称: 'CI E2E P50/P90', 定义说明: '从 CI 触发到所有 Job 完成的中位/90分位耗时（秒）' },
  { 指标名称: 'CI启动 P50/P90', 定义说明: '从 CI 触发到第一个 Job 开始的中位/90分位等待时间（秒）' },
  { 指标名称: 'CI执行 P50/P90', 定义说明: '从 Job 开始到完成的中位/90分位执行时间（秒）' },
  { 指标名称: 'PR检视 P50/P90', 定义说明: '从 PR 创建到首次 Review 的中位/90分位耗时（秒）。注：当前导出基于 CI run 数据，不含 PR 创建/Merge 时间戳，该列暂为空。' },
  { 指标名称: '运行次数', 定义说明: '选定时间范围内的 CI Run 总数' },
  { 指标名称: '达标率', 定义说明: 'CI Run 中成功完成的比例（%）' },
];

const DETAIL_DEFINITIONS = [
  { 指标名称: '日期', 定义说明: 'CI Run 所属日期（YYYY-MM-DD）' },
  { 指标名称: '仓库', 定义说明: 'Run 所属仓库（owner/repo）' },
  { 指标名称: 'PR号', 定义说明: '关联的 Merge Request 编号' },
  { 指标名称: 'Run名称', 定义说明: 'CI Run 的完整名称' },
  { 指标名称: 'CI阶段', 定义说明: 'CI 阶段标识（如 compile、docs-ci）' },
  { 指标名称: '状态', 定义说明: 'Run 或 Job 的最终结论（success、failure、cancelled 等）' },
  { 指标名称: '总耗时(秒)', 定义说明: 'Run 从创建到完成的总秒数' },
  { 指标名称: '队列等待(秒)', 定义说明: 'Job 从创建到开始执行的排队等待秒数' },
  { 指标名称: '执行耗时(秒)', 定义说明: 'Job 从开始执行到完成的秒数' },
  { 指标名称: 'Job名称', 定义说明: 'CI Job 的名称' },
  { 指标名称: 'Job数量', 定义说明: '该 Run 包含的 Job 总数' },
  { 指标名称: '创建时间', 定义说明: 'Run 或 Job 的创建时间（YYYY-MM-DD HH:MM:SS）' },
  { 指标名称: '更新时间', 定义说明: 'Run 或 Job 的最后更新时间（YYYY-MM-DD HH:MM:SS）' },
  { 指标名称: 'Run链接', 定义说明: '指向 GitCode 上该 Run 的 URL' },
];

export function generateDateRange(startDate, endDate, maxDays = MAX_DAYS) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  if (start > end) return [];

  const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const cappedDays = Math.min(diffDays, maxDays);

  const dates = [];
  for (let i = 0; i < cappedDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export async function fetchDayFiles(dates, concurrency = CONCURRENCY_LIMIT, onProgress, signal) {
  const results = { runs: [], loadedCount: 0, skippedDates: [] };
  let index = 0;

  async function worker() {
    while (index < dates.length) {
      if (signal?.aborted) return;
      const date = dates[index++];
      try {
        const res = await fetch(`/data/${date}.json`, { signal });
        if (!res.ok) {
          results.skippedDates.push(date);
        } else {
          const data = await res.json();
          if (data?.runs && Array.isArray(data.runs)) {
            results.runs.push(...data.runs);
          }
          results.loadedCount++;
        }
      } catch {
        if (signal?.aborted) return;
        results.skippedDates.push(date);
      }
      if (onProgress) onProgress(results.loadedCount + results.skippedDates.length, dates.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, dates.length) }, () => worker()));
  return results;
}

export function buildSummaryData(runs) {
  if (!runs || runs.length === 0) return [];

  const byRepo = new Map();
  for (const run of runs) {
    const repoKey = getRunRepoKey(run);
    if (!repoKey) continue;
    if (!byRepo.has(repoKey)) {
      byRepo.set(repoKey, { runs: [], repoKey });
    }
    byRepo.get(repoKey).runs.push(run);
  }

  const summary = [];
  for (const [repoKey, group] of byRepo) {
    const [owner, repoName] = repoKey.split('/');
    const runCount = group.runs.length;

    const ciDurations = group.runs.map(r => r.durationInSeconds).filter(v => typeof v === 'number' && Number.isFinite(v));
    const ciStartupDurations = [];
    const ciExecDurations = [];

    for (const run of group.runs) {
      const jobs = Array.isArray(run.jobs) ? run.jobs : [];
      const runCreated = toTimestamp(run.created_at);
      const jobStarts = jobs
        .map(job => toTimestamp(job.started_at))
        .filter(time => time !== null);

      if (runCreated !== null && jobStarts.length > 0) {
        const startup = (Math.min(...jobStarts) - runCreated) / 1000;
        if (Number.isFinite(startup)) ciStartupDurations.push(startup);
      }

      for (const job of jobs) {
        if (typeof job.durationInSeconds === 'number' && Number.isFinite(job.durationInSeconds)) {
          ciExecDurations.push(job.durationInSeconds);
        }
      }
    }

    summary.push({
      repo: `${owner}/${repoName}`,
      repoKey,
      owner,
      repoName,
      prE2EP50: null,
      prE2EP90: null,
      ciE2EP50: percentile(ciDurations, 50),
      ciE2EP90: percentile(ciDurations, 90),
      ciStartupP50: percentile(ciStartupDurations, 50),
      ciStartupP90: percentile(ciStartupDurations, 90),
      ciExecP50: percentile(ciExecDurations, 50),
      ciExecP90: percentile(ciExecDurations, 90),
      prReviewP50: null,
      prReviewP90: null,
      runCount,
      complianceRate: getSuccessRate(group.runs) * 100,
    });
  }

  return summary.sort((a, b) => a.repoKey.localeCompare(b.repoKey));
}

export function buildDetailData(runs, columns) {
  if (!runs || runs.length === 0) return [];

  const colSet = new Set(columns || DETAIL_COLUMNS.map(c => c.key));
  const rows = [];

  for (const run of runs) {
    const repoKey = getRunRepoKey(run);
    const prNumber = getRunPrNumber(run);
    const stage = getRunStageName(run);
    const jobs = Array.isArray(run.jobs) ? run.jobs : [];

    if (jobs.length === 0) continue;

    for (const job of jobs) {
      const row = {};

      if (colSet.has('date')) row.date = run.created_at ? run.created_at.split('T')[0] : '';
      if (colSet.has('repo')) row.repo = repoKey;
      if (colSet.has('prNumber')) row.prNumber = prNumber;
      if (colSet.has('runName')) row.runName = run.name || '';
      if (colSet.has('stage')) row.stage = stage;
      if (colSet.has('conclusion')) row.conclusion = job.conclusion || run.conclusion || '';
      if (colSet.has('totalDuration')) row.totalDuration = run.durationInSeconds || 0;
      if (colSet.has('queueDuration')) row.queueDuration = job.queueDurationInSeconds ?? 0;
      if (colSet.has('execDuration')) row.execDuration = job.durationInSeconds ?? 0;
      if (colSet.has('jobName')) row.jobName = job.name || '';
      if (colSet.has('jobCount')) row.jobCount = jobs.length;
      if (colSet.has('createdAt')) row.createdAt = job.created_at || run.created_at || '';
      if (colSet.has('updatedAt')) row.updatedAt = job.completed_at || run.updated_at || '';
      if (colSet.has('runUrl')) row.runUrl = run.html_url || '';

      rows.push(row);
    }
  }

  return rows;
}

export function buildDefinitionsData() {
  return [...SUMMARY_DEFINITIONS, ...DETAIL_DEFINITIONS];
}

function toTimestamp(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function cell(value, type) {
  if (value === null || value === undefined || value === '') return { value: '', type: String };
  if (type === Date && typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? { value: '', type: String } : { value: d, type: Date, format: 'yyyy-mm-dd hh:mm:ss' };
  }
  if (type === Number) {
    return typeof value === 'number' && Number.isFinite(value) ? { value, type: Number, format: '0.0' } : { value: '', type: String };
  }
  return { value, type: type || String };
}

export async function generateExcel(summaryData, detailData, definitionsData, selectedDetailColumns) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');

  const detailCols = DETAIL_COLUMNS.filter(c =>
    !selectedDetailColumns || selectedDetailColumns.includes(c.key)
  );

  function buildRows(data, columns) {
    const headerRow = columns.map(col => ({ value: col.label, type: String, fontWeight: 'bold' }));
    const dataRows = data.map(row =>
      columns.map(col => cell(row[col.key], col.type))
    );
    return [headerRow, ...dataRows];
  }

  function buildColumns(columns) {
    return columns.map(col => ({ header: col.label, width: Math.max(col.label.length * 2, 12) }));
  }

  const sheets = [
    {
      data: buildRows(summaryData, SUMMARY_COLUMNS),
      sheet: '仓库汇总',
      columns: buildColumns(SUMMARY_COLUMNS),
    },
    {
      data: buildRows(detailData, detailCols),
      sheet: 'CI运行明细',
      columns: buildColumns(detailCols),
    },
    {
      data: buildRows(definitionsData, DEFINITION_COLUMNS),
      sheet: '指标说明',
      columns: buildColumns(DEFINITION_COLUMNS),
    },
  ];

  const blob = await writeExcelFile(sheets).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CI报表_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
