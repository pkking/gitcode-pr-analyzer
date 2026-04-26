import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ProgressBar } from './ui.jsx';
import {
  generateDateRange,
  fetchDayFiles,
  fetchPrDetailsForRuns,
  buildSummaryData,
  buildDetailData,
  buildDefinitionsData,
  generateExcel,
} from '../utils/exportToExcel.js';

const TIME_PRESETS = [
  { key: 'today', label: '今天' },
  { key: '7days', label: '近 7 天' },
  { key: '30days', label: '近 30 天' },
  { key: 'custom', label: '自定义' },
];

const DETAIL_COLUMN_GROUPS = [
  {
    label: '时间/仓库',
    columns: [
      { key: 'date', label: '日期' },
      { key: 'repo', label: '仓库' },
    ],
  },
  {
    label: '运行信息',
    columns: [
      { key: 'prNumber', label: 'PR号' },
      { key: 'runName', label: 'Run名称' },
      { key: 'stage', label: 'CI阶段' },
      { key: 'conclusion', label: '状态' },
    ],
  },
  {
    label: '耗时指标',
    columns: [
      { key: 'totalDuration', label: '总耗时(秒)' },
      { key: 'queueDuration', label: '队列等待(秒)' },
      { key: 'execDuration', label: '执行耗时(秒)' },
      { key: 'jobName', label: 'Job名称' },
      { key: 'jobCount', label: 'Job数量' },
    ],
  },
  {
    label: '时间戳',
    columns: [
      { key: 'createdAt', label: '创建时间' },
      { key: 'updatedAt', label: '更新时间' },
    ],
  },
  {
    label: '链接',
    columns: [
      { key: 'runUrl', label: 'Run链接' },
    ],
  },
];

const ALL_COLUMN_KEYS = DETAIL_COLUMN_GROUPS.flatMap(g => g.columns.map(c => c.key));

function getDateRangeForPreset(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = today;

  switch (preset) {
    case 'today':
      return { start: today, end };
    case '7days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start, end };
    }
    case '30days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { start, end };
    }
    default:
      return { start: null, end: null };
  }
}

const ExportPanel = forwardRef(function ExportPanel(props, ref) {
  const dialogRef = useRef(null);
  const abortRef = useRef(null);
  const closeTimerRef = useRef(null);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    dialogRef.current?.close();
  }, []);

  useImperativeHandle(ref, () => ({ open, close }), [open, close]);

  const [timePreset, setTimePreset] = useState('7days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedColumns, setSelectedColumns] = useState(new Set(ALL_COLUMN_KEYS));
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, status: 'idle' });
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [estimatedDays, setEstimatedDays] = useState(7);

  const handleCancelExport = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setExporting(false);
    setProgress({ loaded: 0, total: 0, status: 'idle' });
  }, []);

  useEffect(() => {
    let startDate, endDate;
    if (timePreset === 'custom') {
      if (customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
      }
    } else {
      const range = getDateRangeForPreset(timePreset);
      startDate = range.start;
      endDate = range.end;
    }

    if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      const dates = generateDateRange(startDate, endDate);
      setEstimatedDays(dates.length);
    } else {
      setEstimatedDays(0);
    }
  }, [timePreset, customStart, customEnd]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e) => {
      if (exporting) {
        e.preventDefault();
        handleCancelExport();
      }
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [exporting, handleCancelExport]);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handlePresetChange = useCallback((preset) => {
    setTimePreset(preset);
    setError(null);
    setWarning(null);
  }, []);

  const handleCustomDateChange = useCallback((field, value) => {
    if (field === 'start') setCustomStart(value);
    else setCustomEnd(value);
    setError(null);
    setWarning(null);
  }, []);

  const toggleColumn = useCallback((key) => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllColumns = useCallback(() => {
    setSelectedColumns(prev => {
      if (prev.size === ALL_COLUMN_KEYS.length) return new Set();
      return new Set(ALL_COLUMN_KEYS);
    });
  }, []);

  const allSelected = selectedColumns.size === ALL_COLUMN_KEYS.length;

  const handleExport = useCallback(async () => {
    let startDate, endDate;

    if (timePreset === 'custom') {
      if (!customStart || !customEnd) {
        setError('请选择起止日期');
        return;
      }
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      if (startDate > endDate) {
        setError('起始日期不能晚于结束日期');
        return;
      }
      const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      if (dayDiff > 90) {
        setError('自定义范围不能超过 90 天');
        return;
      }
    } else {
      const range = getDateRangeForPreset(timePreset);
      startDate = range.start;
      endDate = range.end;
    }

    setExporting(true);
    setError(null);
    setWarning(null);
    setProgress({ loaded: 0, total: 0, status: 'loading' });

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const dates = generateDateRange(startDate, endDate);
      if (dates.length === 0) {
        setError('选定时间范围内无数据');
        setExporting(false);
        return;
      }

      setProgress({ loaded: 0, total: dates.length, status: 'loading' });

      const result = await fetchDayFiles(dates, 6, (loaded, total) => {
        setProgress({ loaded, total, status: 'loading' });
      }, abortController.signal);

      if (abortController.signal.aborted) return;

      if (result.runs.length === 0) {
        setError('选定时间范围内无 CI 运行数据');
        setExporting(false);
        return;
      }

      if (result.skippedDates.length > 0) {
        setWarning(`${result.skippedDates.length} 天数据缺失，已导出 ${result.loadedCount} 天数据`);
      }

      setProgress({ loaded: result.loadedCount, total: dates.length, status: 'generating' });

      setProgress({ loaded: 0, total: 1, status: 'fetching-pr' });

      const prDetails = await fetchPrDetailsForRuns(result.runs, 6, (loaded, total) => {
        setProgress({ loaded, total, status: 'fetching-pr' });
      }, abortController.signal);
      if (abortController.signal.aborted) return;

      const summaryData = buildSummaryData(result.runs, prDetails);
      const detailData = buildDetailData(result.runs, [...selectedColumns]);
      const definitionsData = buildDefinitionsData();

      await generateExcel(summaryData, detailData, definitionsData, [...selectedColumns]);

      setProgress({ loaded: result.loadedCount, total: dates.length, status: 'done' });
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        close();
      }, 500);
    } catch (err) {
      if (abortController.signal.aborted) return;
      setError(`导出失败：${err.message}`);
      setProgress({ loaded: 0, total: 0, status: 'error' });
    } finally {
      setExporting(false);
      abortRef.current = null;
    }
  }, [timePreset, customStart, customEnd, selectedColumns, close]);

  const isExportDisabled = exporting || estimatedDays === 0 || selectedColumns.size === 0;

  return (
    <dialog
      ref={dialogRef}
      className="rounded-2xl border border-stone-200 bg-white p-0 shadow-2xl backdrop:bg-stone-900/50 max-w-lg w-full max-h-[90vh] overflow-y-auto"
      aria-label="导出 Excel 报表"
    >
      <div className="px-6 py-5 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-600 font-medium">Export</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900 font-display">导出 CI 报表</h2>
          </div>
          <button
            onClick={close}
            disabled={exporting}
            className="rounded-lg p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-40"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Time Range */}
        <div>
          <label className="text-xs uppercase tracking-[0.24em] text-stone-500 font-medium">时间范围</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIME_PRESETS.map(preset => (
              <button
                key={preset.key}
                onClick={() => handlePresetChange(preset.key)}
                disabled={exporting}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer disabled:opacity-40 ${
                  timePreset === preset.key
                    ? 'bg-amber-400 text-stone-900 shadow-md shadow-amber-400/20'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {timePreset === 'custom' && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="date"
                value={customStart}
                onChange={e => handleCustomDateChange('start', e.target.value)}
                disabled={exporting}
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-40"
                aria-label="起始日期"
              />
              <span className="text-stone-400 text-sm">至</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => handleCustomDateChange('end', e.target.value)}
                disabled={exporting}
                className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-40"
                aria-label="结束日期"
              />
            </div>
          )}

          {timePreset !== 'custom' && (
            <p className="mt-2 text-xs text-stone-400">预计 {estimatedDays} 天数据</p>
          )}
        </div>

        {/* Column Selector */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-[0.24em] text-stone-500 font-medium">明细列</label>
            <button
              onClick={toggleAllColumns}
              disabled={exporting}
              className="text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-40"
            >
              {allSelected ? '全不选' : '全选'}
            </button>
          </div>
          <div className="mt-2 space-y-3 max-h-48 overflow-y-auto">
            {DETAIL_COLUMN_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 mb-1">{group.label}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {group.columns.map(col => (
                    <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedColumns.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        disabled={exporting}
                        className="rounded border-stone-300 text-amber-500 focus:ring-amber-400/20 disabled:opacity-40"
                      />
                      <span className="text-sm text-stone-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress */}
        {progress.status !== 'idle' && (
          <ProgressBar
            value={progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0}
            label={
              progress.status === 'loading' ? `加载数据 ${progress.loaded}/${progress.total}` :
              progress.status === 'fetching-pr' ? `获取 PR 明细 ${progress.loaded}/${progress.total}` :
              '生成 Excel 文件...'
            }
            detail={progress.status === 'error' ? error : undefined}
          />
        )}

        {/* Error */}
        {error && !exporting && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Warning */}
        {warning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {warning}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-end gap-3">
        {exporting ? (
          <button
            onClick={handleCancelExport}
            className="rounded-xl px-5 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
          >
            取消
          </button>
        ) : (
          <button
            onClick={close}
            className="rounded-xl px-5 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
          >
            关闭
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={isExportDisabled}
          className="rounded-xl px-5 py-2 text-sm font-medium bg-amber-400 text-stone-900 hover:bg-amber-500 shadow-md shadow-amber-400/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? '导出中...' : '确认导出'}
        </button>
      </div>
    </dialog>
  );
});

export default ExportPanel;
