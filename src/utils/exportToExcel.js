import { percentile, getSuccessRate, getRunRepoKey, getRunPrNumber, getRunStageName } from './etlData.js';

const MAX_DAYS = 90;
const CONCURRENCY_LIMIT = 6;

const DETAIL_COLUMNS = [
  { key: 'date', label: '日期', format: 'date' },
  { key: 'repo', label: '仓库', format: 'text' },
  { key: 'prNumber', label: 'PR号', format: 'number' },
  { key: 'runName', label: 'Run名称', format: 'text' },
  { key: 'stage', label: 'CI阶段', format: 'text' },
  { key: 'conclusion', label: '状态', format: 'text' },
  { key: 'totalDuration', label: '总耗时(秒)', format: 'number' },
  { key: 'queueDuration', label: '队列等待(秒)', format: 'number' },
  { key: 'execDuration', label: '执行耗时(秒)', format: 'number' },
  { key: 'jobName', label: 'Job名称', format: 'text' },
  { key: 'jobCount', label: 'Job数量', format: 'number' },
  { key: 'createdAt', label: '创建时间', format: 'datetime' },
  { key: 'updatedAt', label: '更新时间', format: 'datetime' },
  { key: 'runUrl', label: 'Run链接', format: 'text' },
];

const SUMMARY_COLUMNS = [
  { key: 'repo', label: '仓库', format: 'text' },
  { key: 'prE2EP50', label: 'PR E2E P50', format: 'number' },
  { key: 'prE2EP90', label: 'PR E2E P90', format: 'number' },
  { key: 'ciE2EP50', label: 'CI E2E P50', format: 'number' },
  { key: 'ciE2EP90', label: 'CI E2E P90', format: 'number' },
  { key: 'ciStartupP50', label: 'CI启动 P50', format: 'number' },
  { key: 'ciStartupP90', label: 'CI启动 P90', format: 'number' },
  { key: 'ciExecP50', label: 'CI执行 P50', format: 'number' },
  { key: 'ciExecP90', label: 'CI执行 P90', format: 'number' },
  { key: 'prReviewP50', label: 'PR检视 P50', format: 'number' },
  { key: 'prReviewP90', label: 'PR检视 P90', format: 'number' },
  { key: 'runCount', label: '运行次数', format: 'number' },
  { key: 'complianceRate', label: '达标率', format: 'number' },
];

const SUMMARY_DEFINITIONS = [
  { 指标名称: 'PR E2E P50/P90', 定义说明: '从 PR 创建到 Merge 的中位/90分位耗时（秒）' },
  { 指标名称: 'CI E2E P50/P90', 定义说明: '从 CI 触发到所有 Job 完成的中位/90分位耗时（秒）' },
  { 指标名称: 'CI启动 P50/P90', 定义说明: '从 CI 触发到第一个 Job 开始的中位/90分位等待时间（秒）' },
  { 指标名称: 'CI执行 P50/P90', 定义说明: '从 Job 开始到完成的中位/90分位执行时间（秒）' },
  { 指标名称: 'PR检视 P50/P90', 定义说明: '从 PR 创建到首次 Review 的中位/90分位耗时（秒）' },
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

export async function fetchDayFiles(dates, concurrency = CONCURRENCY_LIMIT, onProgress) {
  const results = { runs: [], loadedCount: 0, skippedDates: [] };
  const semaphore = Array(concurrency).fill(null);

  async function fetchOne(date) {
    try {
      const res = await fetch(`/data/${date}.json`);
      if (!res.ok) {
        results.skippedDates.push(date);
        return;
      }
      const data = await res.json();
      if (data?.runs && Array.isArray(data.runs)) {
        results.runs.push(...data.runs);
      }
      results.loadedCount++;
    } catch {
      results.skippedDates.push(date);
    }
    if (onProgress) onProgress(results.loadedCount + results.skippedDates.length, dates.length);
  }

  for (let i = 0; i < dates.length; i++) {
    const slot = semaphore.indexOf(null);
    if (slot === -1) {
      await Promise.race(semaphore.filter(Boolean));
      const freeSlot = semaphore.indexOf(null);
      semaphore[freeSlot] = fetchOne(dates[i]);
    } else {
      semaphore[slot] = fetchOne(dates[i]);
    }
  }

  await Promise.all(semaphore.filter(Boolean));
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

    const ciDurations = group.runs.map(r => r.durationInSeconds || 0).filter(v => Number.isFinite(v));
    const ciStartupDurations = [];
    const ciExecDurations = [];

    for (const run of group.runs) {
      if (Array.isArray(run.jobs) && run.jobs.length > 0) {
        const job = run.jobs[0];
        if (job.started_at && run.created_at) {
          const startup = (new Date(job.started_at) - new Date(run.created_at)) / 1000;
          if (Number.isFinite(startup)) ciStartupDurations.push(startup);
        }
        if (Number.isFinite(job.durationInSeconds)) ciExecDurations.push(job.durationInSeconds);
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

function isoToExcelSerial(isoString) {
  if (!isoString) return 0;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 0;
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  return (date - excelEpoch) / (1000 * 60 * 60 * 24);
}

export async function generateExcel(summaryData, detailData, definitionsData, selectedDetailColumns) {
  const XLSX = await import('xlsx');

  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryHeaders = SUMMARY_COLUMNS.map(c => c.label);
  const summaryRows = summaryData.map(s =>
    SUMMARY_COLUMNS.map(col => {
      const val = s[col.key];
      return val !== null && val !== undefined ? val : '';
    })
  );
  const summarySheetData = [summaryHeaders, ...summaryRows];
  const summaryWs = XLSX.utils.aoa_to_sheet(summarySheetData);

  // Apply number formats to summary sheet
  for (let r = 1; r <= summaryRows.length; r++) {
    for (let c = 0; c < SUMMARY_COLUMNS.length; c++) {
      const col = SUMMARY_COLUMNS[c];
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (summaryWs[cellRef] && col.format === 'number') {
        summaryWs[cellRef].z = '0';
        summaryWs[cellRef].t = 'n';
      }
    }
  }
  summaryWs['!cols'] = SUMMARY_COLUMNS.map(col => ({
    wch: Math.max(col.label.length, 12),
  }));
  XLSX.utils.book_append_sheet(wb, summaryWs, '仓库汇总');

  // Detail sheet
  const detailCols = DETAIL_COLUMNS.filter(c =>
    !selectedDetailColumns || selectedDetailColumns.includes(c.key)
  );
  const detailHeaders = detailCols.map(c => c.label);
  const detailRows = detailData.map(row =>
    detailCols.map(col => {
      const val = row[col.key];
      if (col.format === 'datetime' && val) return isoToExcelSerial(val);
      if (col.format === 'number') return val !== null && val !== undefined ? val : 0;
      return val !== null && val !== undefined ? val : '';
    })
  );
  const detailSheetData = [detailHeaders, ...detailRows];
  const detailWs = XLSX.utils.aoa_to_sheet(detailSheetData);

  // Apply number formats to detail sheet
  for (let r = 1; r <= detailRows.length; r++) {
    for (let c = 0; c < detailCols.length; c++) {
      const col = detailCols[c];
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (detailWs[cellRef]) {
        if (col.format === 'number') {
          detailWs[cellRef].z = '0';
          detailWs[cellRef].t = 'n';
        } else if (col.format === 'datetime') {
          detailWs[cellRef].z = 'yyyy-mm-dd hh:mm:ss';
          detailWs[cellRef].t = 'n';
        }
      }
    }
  }
  detailWs['!cols'] = detailCols.map(col => ({
    wch: Math.max(col.label.length, 15),
  }));
  XLSX.utils.book_append_sheet(wb, detailWs, 'CI运行明细');

  // Definitions sheet
  const defHeaders = ['指标名称', '定义说明'];
  const defRows = definitionsData.map(d => [d['指标名称'], d['定义说明']]);
  const defSheetData = [defHeaders, ...defRows];
  const defWs = XLSX.utils.aoa_to_sheet(defSheetData);
  defWs['!cols'] = [{ wch: 20 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, defWs, '指标说明');

  // Trigger download
  XLSX.writeFile(wb, `CI报表_${new Date().toISOString().split('T')[0]}.xlsx`);
}
