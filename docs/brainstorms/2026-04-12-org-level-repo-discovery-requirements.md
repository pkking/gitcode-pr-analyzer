---
date: 2026-04-12
topic: org-level-repo-discovery
status: historical
---

# Org-Level Repo Discovery

> Historical note: this requirements document captures decisions made before the legacy collector was removed. See `docs/current-architecture.md` for the current implementation.

## Problem Frame
当前 `etl/repos.yaml` 虽然支持按组织复用一组规则，但仍然要求在 `orgs[].repos` 中逐个列出 `owner/repo`。当一个组织下仓库较多或仓库列表经常变化时，这种配置方式维护成本高，也容易漏掉新仓库。需要让采集器支持“只配置组织名”时自动发现该组织下全部仓库，并继续允许少量仓库做例外处理。

## Requirements

**Configuration Semantics**
- R1. `etl/repos.yaml` 中的组织配置在未显式提供 `repos` 列表时，应被解释为“自动发现该组织下所有仓库并纳入分析”。
- R2. 组织级自动发现得到的仓库，应默认继承该组织配置中的 `rules`。
- R3. 组织配置应支持 `exclude`，用于排除自动发现结果中的少量仓库；排除项使用完整仓库标识，格式为 `owner/repo`。

**Compatibility**
- R4. 当前显式列出 `orgs[].repos` 的配置方式必须继续有效；当 `repos` 存在时，采集器只处理显式列出的仓库，不进行自动发现。
- R5. 当前顶层 `repos:` 配置方式必须继续有效，并可与组织级配置同时存在。
- R6. 如果某个仓库同时由顶层 `repos:`、组织自动发现、或组织显式 `repos` 命中，最终结果中该仓库只能被纳入一次。

**Overrides**
- R7. 在组织级默认规则基础上，应允许对个别仓库提供覆盖或补充规则，避免为了少数例外仓库放弃组织级配置。
- R8. 仓库级覆盖规则的语义必须清晰可预测：默认继承组织规则，并在声明覆盖时按文档定义的优先级生效。

**Operational Behavior**
- R9. 自动发现组织仓库时，应只纳入采集器有权限访问且 API 可正常返回的仓库；无法访问的仓库不应导致整个组织采集失败。
- R10. 当组织自动发现结果为空时，运行输出应明确提示，便于判断是组织下无仓库、权限不足，还是配置有误。
- R11. 生成的数据索引结构应继续兼容现有下游读取逻辑；新增组织级发现能力不应改变现有数据消费路径。

## Success Criteria
- 在 `etl/repos.yaml` 中仅配置组织名和规则时，采集器可以自动纳入该组织下全部仓库，无需再逐个维护仓库列表。
- 现有显式仓库配置不需要修改即可继续工作。
- 可以通过 `exclude` 排除不想分析的仓库，并对少数仓库定义例外规则。
- 同一仓库不会因为多种命中方式而重复分析或重复写入索引。

## Scope Boundaries
- 不要求在本次变更中改造旧版 `config/repositories.yml` / `scripts/collector.js` 的配置体系。
- 不要求在本次变更中设计复杂的组织发现缓存或增量同步策略。
- 不要求在本次变更中支持多层级组织继承或跨组织共享规则。

## Key Decisions
- 隐式发现优于显式开关：当组织配置未提供 `repos` 时，默认启用该组织下全部仓库自动发现，减少配置噪音。
- 保留显式 `repos` 优先语义：一旦组织配置写了 `repos`，就按该列表处理，避免旧配置行为变化。
- 组织级默认加仓库级例外：大多数仓库复用同一套规则，少数仓库通过覆盖或补充机制处理差异。
- 需要 `exclude`：组织级自动发现必须允许排除少数不需要分析的仓库，否则配置可控性不足。

## Dependencies / Assumptions
- 假设 GitCode API 提供可用于枚举某组织仓库列表的接口；若接口能力或权限模型有限，规划阶段需要确认具体调用方式。
- 假设当前 ETL 数据输出模型可以继续按 `owner/repo` 作为唯一仓库键使用，无需调整索引主键。

## Outstanding Questions

### Deferred to Planning
- [Affects R7][Technical] 仓库级覆盖配置的具体 YAML 结构应如何设计，才能兼顾可读性和兼容性。
- [Affects R9][Needs research] GitCode 组织仓库枚举接口的分页、权限失败和空结果语义是什么。
- [Affects R10][Technical] 运行日志与错误提示应如何区分“空组织”“权限不足”“API 失败”这几类情况。

## Next Steps
-> /ce:plan for structured implementation planning
