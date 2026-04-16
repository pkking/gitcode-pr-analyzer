---
date: 2026-04-17
topic: frontend-lint-gate
---

# Frontend Lint Gate

## Problem Frame

The repo currently has `npm test` but no checked-in frontend lint workflow. That leaves code quality checks inconsistent across contributors and easy to skip until review or runtime. The goal is to add a frontend-only lint gate that runs locally before commits and also serves as a reliable CI quality gate, without introducing more tooling complexity than the current project size justifies.

## Requirements

**Quality Gate**
- R1. The repo must define a frontend lint workflow for application code under `src/`.
- R2. The lint workflow must fail on violations rather than silently rewriting files.
- R3. The same lint policy must be runnable in CI so local checks and CI enforce the same standard.

**Contributor Workflow**
- R4. Contributors must be able to run the lint gate locally before pushing changes.
- R5. Commits that touch the frontend should be able to invoke the lint gate automatically through `pre-commit`.

**Tooling Shape**
- R6. The first version must keep tooling minimal and avoid a multi-layer setup unless each added layer has a clear, non-duplicative role.
- R7. `lintrunner` may be included only if it materially improves consistency, orchestration, or CI reuse beyond what a direct linter command plus `pre-commit` already provides.

## Success Criteria
- Frontend changes that violate the agreed lint rules fail locally before commit and also fail in CI.
- Contributors have one clear frontend lint command/workflow to rely on.
- The initial setup stays narrow enough that it does not create immediate maintenance burden for ETL code, generated data, or non-frontend files.

## Scope Boundaries
- Only frontend application code in `src/` is in scope for the first pass.
- ETL code under `etl/`, generated/static data under `public/data/`, and broad repo-wide policy enforcement are out of scope for this pass.
- Auto-fixing behavior is out of scope for the initial lint gate.

## Key Decisions
- Frontend-only first pass: Keeps the gate aligned to the user’s stated priority and avoids mixing app concerns with ETL or generated data.
- Fail-fast policy: Violations should be explicit and visible instead of being rewritten automatically.
- Minimal tooling bias: The default direction is to prefer the simplest enforceable workflow; `lintrunner` needs to justify itself rather than being included by default.

## Dependencies / Assumptions
- The repo will continue using Node-based frontend tooling as the primary execution environment for frontend quality checks.
- CI can run the same frontend lint command that contributors use locally.

## Alternatives Considered
- `pre-commit` as a thin trigger over one direct frontend lint command: lowest carrying cost, strongest fit for the current repo size.
- `pre-commit` plus `lintrunner` as the default stack: acceptable only if `lintrunner` becomes the single canonical frontend quality entrypoint rather than duplicating an existing command.
- Repo-wide linting from day one: rejected for now because it expands scope beyond the stated frontend-only goal.

## Outstanding Questions

### Deferred to Planning
- [Affects R1-R3][Technical] Which concrete frontend lint rule set and tools best fit the current React/Vite codebase with the least extra maintenance?
- [Affects R3-R5][Technical] How should CI invoke the lint gate so the developer-facing command and CI entrypoint stay aligned?
- [Affects R7][Needs research] Does `lintrunner` offer enough value in this repo to earn a place in the first version, or should it be deferred until the repo has multiple lint domains?

## Next Steps
-> /ce:plan for structured implementation planning
