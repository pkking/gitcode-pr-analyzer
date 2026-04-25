---
date: 2026-04-25
topic: homepage-excel-export
---

# 首页按时间导出 Excel

## Problem Frame

当前首页展示仓库级 CI 指标汇总（PR E2E、CI E2E 等 P50/P90 指标），但用户无法将这些数据导出为 Excel 进行离线分析或汇报。用户需要按自定义时间范围，同时导出汇总指标和原始 CI 运行明细，且导出的文件需满足 Excel 原生排序和可读性要求。

## Requirements

### 时间范围选择

- R1. 首页提供快捷时间段选择：今天、近 7 天、近 30 天、自定义范围。
- R2. 默认选中"近 7 天"。
- R3. 自定义范围通过两个日期选择器输入起止日期，最大跨度不超过 90 天。

### 导出入口与交互

- R4. 导出入口按钮位于首页表格标题栏右侧，与搜索框同行。
- R5. 点击导出入口按钮弹出配置面板，包含：时间段选择、明细列勾选器（默认全选）、确认导出按钮。
- R6. 导出过程中显示进度条（已加载天数/总天数），导出完成后自动触发浏览器下载。

### 汇总 Sheet（Sheet 名："仓库汇总"）

- R7. 汇总 Sheet 的列与首页表格一致：仓库、PR E2E P50、PR E2E P90、CI E2E P50、CI E2E P90、CI启动 P50、CI启动 P90、CI执行 P50、CI执行 P90、PR检视 P50、PR检视 P90、运行次数、达标率。
- R8. 汇总数据按选定时间范围内的 run 数据重新计算（非直接取 `home-overview.json` 预聚合值）。
- R9. 所有数值列为 Excel 数值格式（非文本），支持 Excel 原生排序。
- R10. 新增第三个 Sheet（Sheet 名："指标说明"），列出所有指标列的名称和定义，避免在数据行之间插入注释行破坏 Excel 排序功能。

### 明细 Sheet（Sheet 名："CI运行明细"）

- R11. 明细 Sheet 默认导出全部可用列：日期、仓库(owner/repo)、PR号、Run名称、CI阶段、状态、总耗时(秒)、队列等待(秒)、执行耗时(秒)、Job名称、Job数量、创建时间、更新时间、Run链接。
- R12. 用户可通过列勾选器取消不需要的列，勾选状态不持久化（每次导出重新选择）。
- R13. 每条 run 的每个 job 展开为一行（即一个 run 有 N 个 job 则产生 N 行明细）。
- R14. 所有数值列为 Excel 数值格式，支持排序。
- R15. 明细列的定义也记录在"指标说明" Sheet 中，与汇总指标统一维护。
- R16. 时间列格式为 `YYYY-MM-DD HH:MM:SS`（Excel 日期时间格式）。

### 数据加载与性能

- R17. 根据选定时间范围，逐个 `fetch` 对应的 `/data/YYYY-MM-DD.json` 文件。
- R18. 对选定范围内的日期文件逐个 fetch，缺失的日期文件（404）自动跳过，不中断导出流程。
- R19. 使用流式处理：每加载完一个 day file 即合并到结果中，不等待全部完成。
- R20. 自定义范围上限 90 天，防止浏览器内存溢出。

## Success Criteria

- 用户能在首页通过 1 次点击打开导出面板，选择时间范围后下载 Excel 文件。
- 下载的 Excel 文件包含三个 Sheet：仓库汇总、CI运行明细、指标说明，数值列可在 Excel 中直接排序。
- 每个指标列有清晰的定义注释。
- 30 天范围的导出在 10 秒内完成（在典型数据量下）。

## Scope Boundaries

- 本次仅支持首页导出，不支持 Repo 详情页和 PR 分析页的导出（可后续扩展）。
- 不修改 ETL 采集逻辑或数据结构，纯前端实现。
- 不引入后端服务，保持静态部署架构。
- 不持久化用户的列选择偏好。

## Key Decisions

- **纯客户端导出**：数据源为静态 JSON 文件，无需后端参与，与现有架构一致。
- **汇总数据重新计算**：`home-overview.json` 是全量预聚合值，不支持按时间范围切片，因此需在客户端按选定日期范围的 day files 重新计算聚合指标。
- **SheetJS (xlsx) 库**：支持数值格式、多 Sheet 导出，是浏览器端最成熟的 Excel 生成方案。
- **指标说明独立 Sheet**：指标定义不以内联注释行形式插入数据区，而是放在独立的"指标说明" Sheet 中，避免破坏 Excel 排序功能。
- **明细按 job 展开**：每个 run 的每个 job 独立一行，便于在 Excel 中按 job 维度筛选和聚合。

## Dependencies / Assumptions

- `public/data/YYYY-MM-DD.json` 文件按天存在，且文件名格式稳定。
- day file 中 `runs` 数组的结构稳定（包含 `id`, `name`, `conclusion`, `created_at`, `updated_at`, `html_url`, `durationInSeconds`, `jobs` 等字段）。
- `src/utils/etlData.js` 中的 `percentile()` 函数可复用于客户端聚合计算。
- 浏览器支持 `fetch` 并发请求多个 JSON 文件。

## Outstanding Questions

### Deferred to Planning

- [Affects R17][Technical] 30 个并发 fetch 是否需要限流（如最多 5 个并发）以避免浏览器连接数限制？
- [Affects R11][Needs research] day file 中 `repo` 字段是否始终存在？还是需要从 `html_url` 解析？需验证多个 day file 的数据一致性。
- [Affects R5][Technical] 列勾选器用原生 `<dialog>` 还是自定义 popover 组件？需评估现有 UI 组件库。

## Next Steps

-> /ce:plan for structured implementation planning
