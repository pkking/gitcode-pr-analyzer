---
title: "feat: Add time-range Excel export on homepage"
type: feat
status: active
date: 2026-04-25
origin: docs/brainstorms/2026-04-25-homepage-excel-export-requirements.md
---

# Homepage Excel Export

## Overview

Add an export button to the homepage that opens a configuration panel, lets users select a time range and columns, then generates and downloads an Excel file with three sheets: 仓库汇总 (summary metrics), CI运行明细 (raw run data), and 指标说明 (metric definitions). Pure client-side implementation — no backend changes.

## Problem Frame

Users need to export CI metrics for offline analysis and reporting. Currently the homepage displays aggregated P50/P90 metrics per repository but offers no way to download this data. The ETL pipeline already produces daily JSON files (`public/data/YYYY-MM-DD.json`) containing all raw run data, which can be fetched client-side and aggregated into Excel format.

## Requirements Trace

- R1. Homepage quick time range selection: today, last 7 days, last 30 days, custom range
- R2. Default selection: "last 7 days"
- R3. Custom range via two date pickers, max span 90 days
- R4. Export entry button in table header, right side, inline with search box
- R5. Click opens config panel: time range, column selector (default all), confirm export button
- R6. Progress bar during export (loaded days / total days), auto-download on completion
- R7. Summary sheet columns match homepage table (13 columns)
- R8. Summary data recalculated from raw runs in selected time range
- R9. All numeric columns as Excel number format (sortable)
- R10. Third sheet "指标说明" with metric definitions
- R11. Detail sheet with 14 columns: 日期、仓库、PR号、Run名称、CI阶段、状态、总耗时(秒)、队列等待(秒)、执行耗时(秒)、Job名称、Job数量、创建时间、更新时间、Run链接
- R12. Column selector with non-persisted state
- R13. Each run's each job expanded to one row
- R14. Detail numeric columns as Excel number format
- R15. Detail column definitions in "指标说明" sheet
- R16. Time columns as `YYYY-MM-DD HH:MM:SS` Excel datetime format
- R17. Fetch `/data/YYYY-MM-DD.json` for each date in range
- R18. Missing day files (404) silently skipped
- R19. Streaming processing: merge each day file as it loads
- R20. Custom range capped at 90 days

## Scope Boundaries

- Homepage export only — no Repo detail page or PR analysis page export
- No ETL changes — pure frontend
- No backend service — static deployment preserved
- No column preference persistence

## Context & Research

### Relevant Code and Patterns

- **`src/pages/HomePage.jsx`** — existing homepage with table header layout (search box at line 320-333), `ProgressBar` usage, org filter pills pattern (line 291-307)
- **`src/components/ui.jsx`** — `ProgressBar`, `Badge`, `TableSkeleton`, `MetricValue` components; no dialog/modal exists
- **`src/utils/etlData.js`** — `percentile()`, `average()`, `getSuccessRate()`, `formatSeconds()`, `getRunRepoKey()`, `getRunPrNumber()`, `getRunStageName()` — all reusable for client-side aggregation
- **Day file structure** (verified): `{date, repo, runs: [{id, name, conclusion, created_at, updated_at, html_url, durationInSeconds, jobs: [{name, conclusion, durationInSeconds, queueDurationInSeconds, started_at, completed_at}]}]}`
- **`repo` field**: confirmed present at top level of every day file, BUT it reflects only the LAST ETL-processed repo and cannot be used to identify which repo a run belongs to. Day files accumulate runs from multiple repos via ETL merge. Use `getRunRepoKey(run)` (parses `html_url`) for detail sheet repo identification.

### Key Technical Decisions

- **SheetJS (xlsx) library**: browser-side Excel generation with number format support. Community edition (`xlsx` npm package) is sufficient — no pro features needed. **Use dynamic import** (`const XLSX = await import('xlsx')`) inside the export handler to defer ~500KB bundle until user triggers export, preserving initial page load.
- **Native `<dialog>` element**: zero-dependency modal with built-in focus trapping, Escape-to-close, and `aria-modal`. No new UI library needed.
- **Native `<input type="date">`**: for custom date range. No date picker library needed.
- **Concurrency limit of 6**: matches HTTP/1.1 browser default per-domain connection limit. Simple semaphore pattern.
- **Streaming merge**: process each day file as it arrives, update progress incrementally.

## Open Questions

### Resolved During Planning

- **Concurrent fetch strategy**: Cap at 6 concurrent fetches. Use a simple async semaphore. (Affects R17)
- **`repo` field availability**: Confirmed present at top level of all day files. No URL parsing needed. (Affects R11)
- **Dialog component**: Native `<dialog>` element. Zero dependency, built-in accessibility. (Affects R5)

### Deferred to Implementation

- **Exact SheetJS number format codes**: Will determine during implementation (e.g., `0` for integers, `0.0` for percentages).
- **Final column ordering in detail sheet**: Will match R11 order but may adjust based on SheetJS column width optimization.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
User clicks "导出" button
  → ExportPanel opens (<dialog>)
    → User selects time range (presets or custom dates)
    → User toggles columns (default: all checked)
    → User clicks "确认导出"
      → generateDatesInRange(start, end) → ['2026-04-18', ..., '2026-04-24']
      → fetchDayFiles(dates, concurrency=6)
          → for each date: fetch(`/data/${date}.json`)
          → 404 → skip, success → merge runs into accumulator
          → update progress: loadedCount / totalCount
      → buildSummarySheet(mergedRuns) → [{repo, prE2EP50, prE2EP90, ...}, ...]
      → buildDetailSheet(mergedRuns, selectedColumns) → [[date, repo, prNumber, ...], ...]
      → buildDefinitionsSheet() → [[columnName, definition], ...]
      → XLSX.utils.json_to_sheet() × 3 → workbook
      → XLSX.writeFile(workbook, `CI报表_${start}_${end}.xlsx`)
      → dialog closes
```

## Implementation Units

- [ ] **Unit 1: Add xlsx dependency and export utility module**

**Goal:** Install SheetJS library and create the core export utility with data loading, aggregation, and Excel generation functions.

**Requirements:** R7, R8, R9, R10, R11, R13, R14, R15, R16, R17, R18, R19, R20

**Dependencies:** None

**Files:**
- Modify: `package.json` (add `xlsx` dependency)
- Create: `src/utils/exportToExcel.js`
- Test: `test/export-to-excel.test.js`

**Approach:**
1. Add `xlsx` to `dependencies` in `package.json`
2. Create `src/utils/exportToExcel.js` with these exported functions:
   - `generateDateRange(startDate, endDate, maxDays=90)` → array of `YYYY-MM-DD` strings
   - `fetchDayFiles(dates, concurrency=6)` → fetches day files with concurrency limit, skips 404s, returns `{runs, loadedCount, skippedDates}`
   - `buildSummaryData(runs)` → groups runs by repo, computes P50/P90 for each metric, returns array matching R7 columns
   - `buildDetailData(runs, columns)` → flattens runs×jobs into rows, filters by selected columns, returns array of arrays. Uses `getRunRepoKey(run)` to extract repo from each run's `html_url` (the day file's top-level `repo` field is unreliable as it reflects only the last ETL-processed repo).
   - `buildDefinitionsData()` → returns array of `{指标名称, 定义说明}` for both summary and detail columns
   - `generateExcel(summaryData, detailData, definitionsData, selectedDetailColumns)` → creates XLSX workbook with 3 sheets, applies number formats, triggers download
3. Reuse `percentile()`, `average()`, `getSuccessRate()` from `src/utils/etlData.js` for aggregation
4. Reuse `getRunRepoKey()`, `getRunPrNumber()`, `getRunStageName()` from `src/utils/etlData.js` for detail data extraction
5. Apply Excel number formats:
   - Summary numeric columns (P50/P90 durations, 运行次数, 达标率): integer format `'0'`
   - Detail numeric columns (PR号, 总耗时, 队列等待, 执行耗时, Job数量): integer format `'0'`
   - Datetime columns (创建时间, 更新时间): convert ISO strings to Excel serial dates, format `'yyyy-mm-dd hh:mm:ss'`
6. Build definitions sheet with two columns (`指标名称`, `定义说明`) covering all 13 summary + 14 detail columns
7. Set column widths via `!cols` property for readability

**Execution note:** Implement test-first for the pure utility functions (date range generation, data aggregation). The fetch function requires mocking.

**Patterns to follow:**
- `src/utils/etlData.js` — existing utility module pattern, pure functions with named exports
- `src/utils/etlData.js` `percentile()` — reuse for P50/P90 computation

**Test scenarios:**
- Happy path: `generateDateRange` with 7-day range returns 7 dates in YYYY-MM-DD format
- Happy path: `buildSummaryData` with runs from 2 repos returns 2 summary rows with correct P50/P90 values
- Happy path: `buildDetailData` with 2 runs (3 jobs total) returns 3 detail rows
- Edge case: `generateDateRange` with maxDays=90 caps at 90 days
- Edge case: `generateDateRange` with start > end returns empty array
- Edge case: `buildSummaryData` with empty runs returns empty array
- Edge case: `buildDetailData` with run that has 0 jobs produces 0 rows for that run
- Error path: `fetchDayFiles` with all 404s returns `{runs: [], loadedCount: 0, skippedDates: [...]}`
- Error path: `fetchDayFiles` with mixed 404/success skips missing dates and merges available data
- Happy path: exported summary sheet has numeric values (not text) for P50/P90 columns
- Happy path: exported detail sheet has numeric values for duration columns
- Happy path: datetime columns are Excel serial dates with correct format code
- Happy path: "指标说明" sheet contains definitions for all 27 columns (13 summary + 14 detail)

**Verification:**
- `npm test` passes for all export utility tests
- Utility functions are pure (no DOM or side effects except `generateExcel` which triggers download)

- [ ] **Unit 2: Create ExportPanel component**

**Goal:** Build the export configuration dialog with time range selection, column selector, progress display, and export trigger.

**Requirements:** R1, R2, R3, R5, R6, R12

**Dependencies:** Unit 1 (export utility module)

**Files:**
- Create: `src/components/ExportPanel.jsx`
- Test: `test/export-panel.test.js`

**Approach:**
1. Create `ExportPanel` component using native `<dialog ref={dialogRef}>` element
2. Expose `{open, close}` API via `useImperativeHandle` or simple ref pattern — parent calls `panelRef.current.open()`
3. Internal state:
   - `timePreset`: 'today' | '7days' | '30days' | 'custom' (default: '7days')
   - `customStart`, `customEnd`: Date objects for custom range
   - `selectedColumns`: Set of column keys (default: all 14 columns from R11)
   - `exporting`: boolean
   - `progress`: {loaded, total, status: 'loading' | 'generating' | 'done' | 'error'}
4. Time range UI:
   - Preset buttons styled like existing org filter pills (rounded-full, stone/amber palette from HomePage.jsx line 291-307)
   - When 'custom' selected, show two `<input type="date">` fields with max 90-day validation
5. Column selector:
   - Vertical list of checkboxes (14 items) with "全选/全不选" toggle
   - Grouped logically: 时间/仓库 | 运行信息 | 耗时指标 | 时间戳 | 链接
6. Export button triggers `handleExport()`:
   - Calls `fetchDayFiles()` from Unit 1 with progress callback
   - On progress: update `progress.loaded/total`
   - On success: calls `generateExcel()`, closes dialog
   - On error: shows error message inline, keeps dialog open
7. Empty state: after time range selection, show "预计 X 天数据" count. If 0 days available, disable export button.
8. Error state: if fetch fails for some dates, show warning "X 天数据缺失，已导出 Y 天数据"
9. Cancel support: during export, show "取消" button that aborts in-flight fetches via `AbortController`

**Patterns to follow:**
- HomePage.jsx org filter pills (line 291-307) for time preset button styling
- HomePage.jsx ProgressBar usage for progress display
- Existing stone/amber color palette, rounded-2xl borders, uppercase tracking-wide labels

**Test scenarios:**
- Happy path: opens dialog, selects preset, clicks export, calls export utility with correct date range
- Happy path: column selector defaults to all 14 columns checked
- Happy path: clicking "全不选" unchecks all columns, export passes filtered columns
- Edge case: custom range > 90 days shows validation error, export button disabled
- Edge case: custom range with start > end shows validation error
- Error path: all day files 404 → shows "选定时间范围内无数据" message, export button disabled
- Error path: partial 404 → shows warning with count of skipped days after export completes

**Verification:**
- Dialog opens/closes correctly with Escape key and backdrop click
- Time presets correctly compute date ranges
- Column selector state correctly maps to export utility column filter

- [ ] **Unit 3: Integrate ExportPanel into HomePage**

**Goal:** Add the export entry button to the HomePage table header and wire up the ExportPanel.

**Requirements:** R4

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/pages/HomePage.jsx`

**Approach:**
1. Import `ExportPanel` component and `useRef`
2. Add export entry button in the table header section (alongside search box, line 312-334):
   - Position: right side of the header, before or after the search input
   - Style: small button with download icon, matching existing stone/amber design language
   - Label: "导出" with `aria-label="导出Excel报表"`
3. Create `exportPanelRef` and wire `onClick` to `exportPanelRef.current.open()`
4. Render `<ExportPanel ref={exportPanelRef} />` at the bottom of HomePage (outside the main layout flow)
5. Responsive: on mobile (below `sm` breakpoint), the header stacks vertically per existing `flex-col sm:flex-row` pattern — export button stays in the header row

**Patterns to follow:**
- HomePage.jsx table header layout (line 310-335) — add button within the existing `flex` container
- Existing button styles from org filter pills (line 297-301)

**Test scenarios:**
- Happy path: clicking export button opens the ExportPanel dialog
- Integration: HomePage renders without errors with ExportPanel added

**Verification:**
- `npm run lint` passes on modified HomePage.jsx
- Export button visible and clickable in browser

## System-Wide Impact

- **Interaction graph:** Adds one new dialog pattern to the app. No existing callbacks, middleware, or observers affected.
- **Error propagation:** Export failures are contained within the ExportPanel — no impact on homepage data display.
- **State lifecycle risks:** None — export is stateless per invocation. AbortController cleans up in-flight fetches on cancel or dialog close.
- **API surface parity:** None — no existing APIs changed.
- **Unchanged invariants:** ETL pipeline, data file structure, homepage data loading, and all existing routes remain unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Large time ranges (90 days) cause browser memory pressure | 90-day cap (R20), streaming merge, concurrency limit of 6 |
| SheetJS community edition bundle size (~500KB minified) | Acceptable for a new feature; can code-split via dynamic `import('xlsx')` if needed |
| Day file structure changes break export | Add basic validation in `fetchDayFiles` — skip files missing expected fields |
| Browser download blocked by popup blocker | Native `XLSX.writeFile` uses blob URL + anchor click, which is generally allowed for user-initiated actions |
| Native `<dialog>` not supported in older browsers | Polyfill not needed — target browsers for this app already support `<dialog>` (Chrome 37+, Firefox 98+, Safari 15.4+) |

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-25-homepage-excel-export-requirements.md`
- Related code: `src/pages/HomePage.jsx`, `src/utils/etlData.js`, `src/components/ui.jsx`
- SheetJS docs: https://docs.sheetjs.com/docs/
