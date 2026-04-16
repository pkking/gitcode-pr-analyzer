---
title: Declarative Routing App Shell Plan
type: refactor
status: completed
date: 2026-04-17
origin: docs/brainstorms/2026-04-17-declarative-routing-app-shell-requirements.md
---

# Declarative Routing App Shell Plan

## Overview

Refactor the frontend from a single stateful `src/App.jsx` view switcher into a route-driven shell with three top-level destinations: home, browsing, and analysis. The plan keeps the current org -> repo -> run workflow intact, but moves it behind declarative routes and shared layout primitives so future pages can be added without growing one monolithic component. (see origin: `docs/brainstorms/2026-04-17-declarative-routing-app-shell-requirements.md`)

## Problem Frame

Today the app's navigation model is encoded in local React state (`selectedOrg`, `selectedRepo`, `selectedRun`) inside `src/App.jsx`. That makes the current dashboard workable, but it couples page identity, data loading, layout, and drill-down behavior into one component tree. The main goal is architectural: give the app a durable shell and route contract that can support additional analysis views later without another structural rewrite. (see origin: `docs/brainstorms/2026-04-17-declarative-routing-app-shell-requirements.md`)

## Requirements Trace

- R1. Introduce a declarative route-based app shell.
- R2. Expose home, browsing, and analysis as routed destinations.
- R3. Make `/` a lightweight home/orientation page.
- R4. Keep the route model extensible for future top-level views.
- R5. Preserve the current browsing drill-down workflow.
- R6. Make analysis a first-class page, not only an in-memory detail state.
- R7. Add an analysis-local recent-runs selection flow.
- R8. Support direct run-specific URLs into analysis.
- R9. Keep browsing and analysis inside a consistent shell.
- R10. Reuse the org/repo tree or equivalent shared sidebar model across both pages.
- R11. Represent major navigation changes as route changes.

## Scope Boundaries

- No ETL or static data format redesign is planned for this pass; existing `public/data/index.json`, day files, and PR detail files are sufficient for the target behavior.
- No new analytics are planned beyond current single-run detail plus an analysis-local recent-runs chooser.
- No browser-history routing rollout is planned in this pass unless deployment constraints are explicitly validated during implementation; the initial route contract should work with the repo's current static Vite setup.

## Context & Research

### Relevant Code and Patterns

- `src/App.jsx` currently owns all page identity, sidebar interaction, data loading, and drill-down rendering.
- `src/utils/etlData.js` already provides the core pure helpers for repo grouping, run listing, PR detail lookup, and stage labeling; route-aware pages should reuse these helpers rather than re-derive the same logic in components.
- `src/utils/runTimeline.js` already isolates timeline derivation for a selected run; the new analysis page should continue to consume it as a pure function.
- `src/main.jsx` is minimal today, which makes it the natural entry point for router setup.
- The repo already uses lightweight `node:test` tests for pure utility behavior in `test/etl-data.test.js` and `test/run-timeline.test.js`. There is no existing browser or DOM test harness.

### Institutional Learnings

- No `docs/solutions/` artifacts were present in this repo.

### External References

- React Router official docs show `RouterProvider` with `createBrowserRouter` as the route-tree-first setup model for data routers.
- React Router official API docs describe `BrowserRouter` as using the browser History API and `HashRouter` as storing the location in the URL hash, which is the safer fit when static-host rewrite support is not yet verified.
- The repo's current `vite.config.js` shows a plain Vite setup with no deployment or rewrite configuration checked in, so route design should not assume server-side SPA fallback exists.

### Planning Conclusions

- This repo has strong local patterns for data shaping but no existing routing layer, so the plan should introduce one with minimal new surface area.
- The safest route contract for this pass is hash-based declarative routing, with browser-history routing left as an explicit future upgrade once deployment support is verified.
- Existing data files are sufficient for a standalone analysis page because run records already include repo identity, timestamps, run IDs, job summaries, and links to derive repo/run context.

## Key Technical Decisions

- Use a declarative client router and move top-level page identity out of `src/App.jsx`.
  Rationale: this is the core architectural requirement and unlocks future pages without a second structural refactor.

- Start with a hash-based route contract.
  Rationale: the checked-in app is a static Vite frontend with no verified rewrite/fallback config. Hash routing preserves direct-link behavior without coupling the plan to deployment assumptions.

- Use explicit page routes instead of one route with query-state branching.
  Rationale: the requirements call for durable top-level areas, so the route tree should make those areas obvious.

- Keep browsing and analysis under one shared shell layout.
  Rationale: the user chose consistency and extensibility over page-specific shells, so navigation chrome should be reused rather than reimplemented per page.

- Extract shared data loading and route-state translation into reusable modules.
  Rationale: route-driven pages should not duplicate fetch and selection logic currently embedded in `src/App.jsx`.

## Open Questions

### Resolved During Planning

- Should the first route implementation use browser-history paths or hash paths? Resolved to hash paths for this pass.
- Should analysis remain dependent on browse-page state? Resolved to no; it should be directly routable and self-sufficient.
- Should the sidebar shell be shared across browse and analysis? Resolved to yes.

### Deferred to Implementation

- Whether the analysis page should default to the newest run in the selected repo or to an empty state when opened without a specific run.
- Whether a direct run URL should canonicalize back to the selected repo route when the run cannot be found in currently indexed files.
- Whether the home page should surface lightweight summary cards immediately or stay intentionally minimal on the first pass.

## High-Level Technical Design

> Directional guidance for review, not implementation specification.

```mermaid
flowchart TD
  A[src/main.jsx] --> B[RouterProvider + route config]
  B --> C[/]
  B --> D[/browse/...]
  B --> E[/analysis/...]

  D --> F[Shared AppShell]
  E --> F
  F --> G[Shared org/repo tree]

  D --> H[Browse page content]
  H --> I[Repo run list]
  I --> J[Route navigation to analysis]

  E --> K[Analysis page content]
  K --> L[Recent runs selector]
  K --> M[Single-run detail panel]

  N[Shared data-loading layer] --> D
  N --> E
```

## Proposed Route Contract

- `/#/`
  Lightweight home/orientation page.
- `/#/browse`
  Browse landing state.
- `/#/browse/:owner`
  Browse with organization context selected.
- `/#/browse/:owner/:repo`
  Browse with repository context selected and run list visible.
- `/#/analysis`
  Analysis landing state.
- `/#/analysis/:owner/:repo`
  Analysis page scoped to a repository with recent runs available.
- `/#/analysis/:owner/:repo/:runId`
  Analysis page with a specific run selected directly.

This contract keeps top-level page identity explicit while allowing direct run entry and route-based repo context restoration. If deployment support for browser-history routing is later verified, the path shape can stay the same and only the router implementation should need to change.

## Implementation Units

- [x] **Unit 1: Establish Router and Shared Shell**

**Goal:** Replace the current single-entry `App` render path with a route-driven app shell and explicit top-level pages.

**Requirements:** R1, R2, R3, R4, R9, R11

**Dependencies:** None

**Files:**
- Modify: `package.json`
- Modify: `src/main.jsx`
- Replace or slim down: `src/App.jsx`
- Create: `src/router.jsx`
- Create: `src/layouts/AppShell.jsx`
- Create: `src/pages/HomePage.jsx`
- Create: `src/pages/BrowsePage.jsx`
- Create: `src/pages/AnalysisPage.jsx`
- Test: `test/router-config.test.js`

**Approach:**
- Add a client-side routing dependency and define the route tree in one dedicated module.
- Move common frame elements out of `src/App.jsx` into `src/layouts/AppShell.jsx`.
- Keep the home page intentionally lightweight: orientation copy plus entry points into browse and analysis.
- Reduce `src/App.jsx` to a compatibility wrapper only if needed; otherwise let the router become the effective app entry.

**Patterns to follow:**
- The current top-level bootstrap simplicity in `src/main.jsx`
- Existing visual language and shell styling in `src/App.jsx`

**Test scenarios:**
- Happy path: the router resolves `/`, `/browse`, and `/analysis` to distinct page modules.
- Happy path: route definitions for `browse/:owner/:repo` and `analysis/:owner/:repo/:runId` are stable and parse expected params.
- Edge case: unknown routes fall back to a safe default page or not-found treatment rather than leaving a blank shell.
- Regression: the shared shell can render without a selected org, repo, or run.

**Verification:**
- The route tree can represent all three top-level destinations without relying on `selected*` component state in `src/App.jsx`.

- [x] **Unit 2: Extract Shared Dashboard Data and Navigation State**

**Goal:** Pull data fetching, repo indexing, and route-to-selection translation out of page components so browse and analysis can share the same underlying model.

**Requirements:** R4, R5, R7, R8, R10, R11

**Dependencies:** Unit 1

**Files:**
- Modify: `src/utils/etlData.js`
- Create: `src/hooks/useDashboardData.js`
- Create: `src/utils/routeState.js`
- Create: `src/components/RepoTreeNav.jsx`
- Test: `test/route-state.test.js`
- Test: `test/etl-data.test.js`

**Approach:**
- Extract the current index/day-file loading behavior from `src/App.jsx` into a shared hook that returns org entries, repo runs, detail maps, loading states, and fetch helpers.
- Introduce pure route-state helpers that map route params to selected org/repo/run identities and produce canonical navigation targets.
- Move the current sidebar org/repo tree into its own component so browse and analysis can reuse it with different main-panel content.
- Extend `src/utils/etlData.js` only for pure selection/lookup helpers; keep view logic out of utility modules.

**Patterns to follow:**
- Pure helper style in `src/utils/etlData.js`
- Current lazy data-loading behavior in `src/App.jsx`

**Test scenarios:**
- Happy path: route-state helpers derive repo and run selection from valid `owner`, `repo`, and `runId` params.
- Happy path: canonical target builders generate the expected analysis and browse URLs from selected repo/run context.
- Edge case: missing or invalid params degrade to org-level, repo-level, or empty analysis states without throwing.
- Regression: existing ETL helper outputs for repo listing and run summaries remain unchanged.

**Verification:**
- Browse and analysis can share one data-loading layer and one sidebar component while keeping page-specific content separate.

- [x] **Unit 3: Migrate Browse Flow onto Routed Pages**

**Goal:** Preserve the current exploration workflow, but make organization and repository context route-driven rather than component-local.

**Requirements:** R5, R9, R10, R11

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/pages/BrowsePage.jsx`
- Modify: `src/layouts/AppShell.jsx`
- Modify: `src/components/RepoTreeNav.jsx`
- Test: `test/route-state.test.js`

**Approach:**
- Make browse the canonical home for org/repo exploration, using route params to represent the selected org and repo.
- Preserve the current overview/repo drill-down presentation where possible, but have sidebar interaction navigate to browse routes instead of mutating local view state only.
- Change “view run” interactions to navigate into analysis routes rather than rendering the run detail inline inside browse.

**Patterns to follow:**
- Existing org overview and repo list sections in `src/App.jsx`
- Existing summary helpers in `src/utils/etlData.js`

**Test scenarios:**
- Happy path: selecting an org updates the browse route and shows org-level summary content.
- Happy path: selecting a repo updates the browse route and shows repo runs.
- Regression: browse still works when no repo is selected yet.
- Edge case: stale repo params produce a recoverable empty state rather than breaking the shell.

**Verification:**
- The existing browse workflow remains intact, but route changes now represent org/repo navigation.

- [x] **Unit 4: Build Standalone Analysis Flow with Recent-Run Selection**

**Goal:** Turn run detail into a standalone analysis destination that supports direct entry and recent-run reselection inside the page.

**Requirements:** R6, R7, R8, R9, R10, R11

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/pages/AnalysisPage.jsx`
- Modify: `src/utils/runTimeline.js`
- Modify: `src/utils/etlData.js`
- Test: `test/analysis-selection.test.js`
- Test: `test/run-timeline.test.js`

**Approach:**
- Scope analysis to a repo context first, then render a recent-runs list or selector within the page for that repo.
- Support direct `analysis/:owner/:repo/:runId` entry by hydrating the selected run from existing day files for the repo.
- Keep the current run timeline and detail rendering model, but separate it from browse-only chrome.
- If analysis is opened without `runId`, show a stable initial state driven by recent runs for the selected repo rather than redirecting back to browse.

**Patterns to follow:**
- Existing run detail rendering in `src/App.jsx`
- Existing timeline derivation in `src/utils/runTimeline.js`

**Test scenarios:**
- Happy path: a direct analysis route with valid repo and run ID renders the expected selected run context.
- Happy path: the recent-runs selector can switch the selected run and update the route accordingly.
- Edge case: a repo-level analysis route without `runId` still renders a usable recent-runs state.
- Edge case: an invalid `runId` degrades to repo-level analysis state with an explicit empty or fallback selection.
- Regression: timeline derivation still works for runs with and without PR detail payloads.

**Verification:**
- Analysis is reachable both from browse and from a direct route, and a user can pick another recent run without leaving the page.

- [x] **Unit 5: Finish Verification and Routing Documentation**

**Goal:** Lock the new route contract, dependency changes, and user-visible navigation behavior into tests and docs.

**Requirements:** R1, R2, R7, R8, R11

**Dependencies:** Unit 1, Unit 2, Unit 3, Unit 4

**Files:**
- Modify: `README.md`
- Modify: `docs/current-architecture.md`
- Modify: `package.json`
- Test: `test/router-config.test.js`
- Test: `test/route-state.test.js`
- Test: `test/analysis-selection.test.js`

**Approach:**
- Document the new page structure and route entry points in `README.md` and `docs/current-architecture.md`.
- Update scripts or test dependencies only as needed to run the new pure route/selection tests cleanly.
- Prefer utility-level automated tests plus manual browser verification of navigation flows, since the repo does not currently contain a DOM testing stack.

**Execution note:** characterization-first for existing ETL and timeline helpers; route and selection helpers should be covered by deterministic pure tests before heavier UI rendering checks are considered.

**Test scenarios:**
- Happy path: documented routes match the actual route contract in code.
- Happy path: navigation from browse to analysis preserves enough context to select the expected run.
- Regression: existing non-routing tests continue to pass unchanged.
- Manual check: refresh and direct-open behavior work for root, browse, and analysis hash URLs in the built app.

**Verification:**
- The route contract is documented, tested at the helper/config level, and manually verified end-to-end in the browser.

## System-Wide Impact

- **Interaction graph:** frontend entrypoint, shell layout, route model, and page composition change; ETL and static data generation stay untouched.
- **State lifecycle:** top-level selection state moves from `src/App.jsx` into the router and shared data/navigation helpers.
- **Data-loading behavior:** repo/day-file fetching remains lazy, but it becomes reusable across browse and analysis rather than page-specific.
- **URL contract:** the app gains stable deep-linkable hash routes for page identity and selected run context.
- **Testing impact:** current utility-only tests stay relevant; new route/selection helpers should absorb most automated coverage without forcing a full UI test framework migration in this pass.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Route refactor accidentally couples page rendering to one giant shared hook | Keep shell, route-state helpers, and page content boundaries explicit from the start |
| Direct run route cannot hydrate quickly enough from current lazy day-file loading | Scope analysis by repo, then limit lookup to that repo's configured files and degrade cleanly on misses |
| Shared sidebar leaks browse-specific assumptions into analysis | Extract the tree as a reusable navigation primitive with page-specific handlers and selection props |
| Browser-history routing is assumed and later breaks on static hosting | Start with hash routing and document browser-history as a future upgrade path only |
| No DOM test harness leaves route rendering gaps | Cover route contracts and selection logic with pure tests, then manually verify routed flows in the browser before merging |

## Documentation / Operational Notes

- Document the route contract and page structure in `README.md`.
- Update `docs/current-architecture.md` so it no longer implies the dashboard is a single `src/App.jsx` state machine.
- During implementation, run at least one production-like `npm run build` and local preview check on direct hash URLs for home, browse, and analysis.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-17-declarative-routing-app-shell-requirements.md`
- Related code: `src/App.jsx`
- Related code: `src/main.jsx`
- Related code: `src/utils/etlData.js`
- Related code: `src/utils/runTimeline.js`
- Related test: `test/etl-data.test.js`
- Related test: `test/run-timeline.test.js`
- External reference: https://reactrouter.com/api/data-routers/RouterProvider
- External reference: https://api.reactrouter.com/v7/functions/react-router.BrowserRouter.html
- External reference: https://api.reactrouter.com/v7/functions/react-router.HashRouter.html
