---
date: 2026-04-17
topic: declarative-routing-app-shell
---

# Declarative Routing App Shell

## Problem Frame

The current frontend keeps navigation state entirely inside `src/App.jsx`, so the app's structure is implicit rather than expressed through URLs and route boundaries. That makes the code harder to extend into additional views, and it ties the existing org -> repo -> run drill-down flow to one component-level state machine instead of a reusable app shell.

This change should turn routing into a first-class architectural boundary so the app can add more top-level analysis views later without continuing to grow a monolithic `App` component.

## Requirements

**Shell and top-level information architecture**
- R1. The frontend must introduce a declarative route-based app shell rather than switching between major views with local component state.
- R2. The app must expose three routed destinations on day one: a lightweight home page, a browsing page, and a standalone analysis page.
- R3. Visiting the app root must land on the lightweight home page, which should orient the user and link them into both browsing and analysis.
- R4. The shell must be structured so additional top-level pages or analysis views can be added later without reworking the current route model again.

**Browsing and analysis behavior**
- R5. The browsing page must preserve the existing repository exploration workflow as the primary place to move through organization, repository, and run context.
- R6. The analysis page must be a first-class destination rather than only a drill-down detail state inside browsing.
- R7. On day one, the analysis page must support single-run analysis and include its own recent-runs selection or filtering flow so users can choose a run from within analysis.
- R8. Users must be able to enter the analysis page both by navigating from browsing and by opening a direct run-specific URL.

**Shared navigation model**
- R9. The app shell must present a consistent navigation structure across browsing and analysis rather than using unrelated layouts per page.
- R10. The existing organization/repository tree, or an equivalent shared sidebar navigation model, must be reusable across both browsing and analysis to keep context switching consistent.
- R11. Browser navigation should align with the routed view structure so major page transitions are represented as route changes rather than only in-memory state changes.

## Success Criteria

- The major frontend destinations are represented as explicit routes instead of a single `selected*` view-state flow in `src/App.jsx`.
- A user can identify the current top-level area of the app from the URL and shell structure.
- The analysis experience can be reached directly and still lets the user choose another recent run without returning to browsing first.
- Adding another top-level page later should primarily require adding a new route and page module rather than rewriting central app-state switching logic.

## Scope Boundaries

- This change does not require inventing new analytics beyond the current browsing and single-run detail capabilities, except for the day-one recent-runs selector on analysis.
- This change does not require defining all future pages now; it only needs a shell and route model that makes future additions straightforward.
- This change does not require redesigning the ETL pipeline or changing the shape of collected data unless planning proves a small supporting adjustment is necessary.

## Key Decisions

- Route-driven architecture over state-driven view switching: the primary goal is future extensibility, not only shareable deep links.
- Three routed destinations now: home is the root entry point, while browsing and analysis become durable top-level areas.
- Analysis is standalone: it should not depend on browsing state to function.
- Shared shell across browsing and analysis: consistency matters more than isolating each page into a distinct layout.

## Dependencies / Assumptions

- Current run detail data and index data are sufficient to support a standalone analysis entry flow, or any missing glue can be handled as part of implementation planning.
- The app can adopt a client-side routing solution without conflicting with the current static-dashboard deployment model. This is an assumption to verify during planning.

## Outstanding Questions

### Deferred to Planning
- [Affects R2, R4, R11][Technical] What exact route contract should represent home, browsing, analysis, and direct run analysis while staying compatible with static hosting?
- [Affects R7, R8][Technical] How should the analysis page source and order its recent-runs selection list to balance responsiveness with reuse of the existing data-loading model?
- [Affects R9, R10][Technical] Which shell elements should be shared at the layout level versus composed per page to avoid coupling unrelated page concerns?

## Next Steps

-> /ce:plan for structured implementation planning
