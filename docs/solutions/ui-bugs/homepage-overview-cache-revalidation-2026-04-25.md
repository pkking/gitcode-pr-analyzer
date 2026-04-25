---
title: Homepage overview cache revalidation should not look like a cold boot
date: 2026-04-25
category: ui-bugs
problem_type: ui_bug
module: homepage-overview
component: src/pages/HomePage.jsx
tags:
  - homepage
  - cache
  - loading-state
  - revalidation
  - review-feedback
related_prs:
  - "#28"
status: solved
---

## Problem
The homepage could render repo data immediately from `sessionStorage`, but it still kept the page in the same `loading` state used for a first-load fetch. That made a cache hit look like a cold boot even though usable data was already on screen.

## Symptoms
- Cached homepage data appeared immediately, but the loading progress UI still behaved like the page was waiting for first data.
- Review feedback on PR `#28` called out that the UI needed a more nuanced state than a single `loading` boolean.
- The implementation already avoided showing the table skeleton when cached data existed, but the remaining loading affordances still implied the page was not ready.

## What Didn't Work
- Reusing one `loading` flag for both initial hydration and background revalidation was not expressive enough.
- Relying only on `isBootstrapping = loading && repoMetrics.length === 0` fixed the skeleton case, but it did not separate “no data yet” from “data is visible and being refreshed”.
- Leaving the progress bar tied directly to `loading` preserved the misleading cold-start experience on cache hits.

## Solution
Split the state model into two phases:

1. `loading` for the true boot path when no cached overview is available.
2. `isRefreshing` for the background fetch path when cached overview data has already been applied.

The fix in [`src/pages/HomePage.jsx`](https://github.com/pkking/gitcode-pr-analyzer/blob/32c958cd5d022b52f59168b3ee2e94f10d84f307/src/pages/HomePage.jsx) does three things:

```jsx
const [loading, setLoading] = useState(true);
const [isRefreshing, setIsRefreshing] = useState(false);
```

```jsx
if (cachedOverview) {
  applyOverview(cachedOverview);
  setLoading(false);
  setIsRefreshing(true);
} else {
  setLoading(true);
  setIsRefreshing(false);
}
```

```jsx
const isBootstrapping = loading && repoMetrics.length === 0;
const showProgress = isBootstrapping || isRefreshing;
```

The progress bar is now rendered only when the page is truly bootstrapping or explicitly revalidating cached data:

```jsx
{showProgress && (
  <ProgressBar
    value={loadingProgress}
    label={loadingLabel}
    detail={loadingDetail}
    className="mt-6"
  />
)}
```

The same change also makes the completion and fallback paths clear by resetting both flags explicitly:

```jsx
setLoading(false);
setIsRefreshing(false);
```

## Why This Works
The bug came from conflating two different UI states:
- “the page has no usable data yet”
- “the page has usable cached data and is checking for fresher data”

Those states should not produce the same feedback. Once cached data is applied, the page is already interactive, so the UI should stop behaving like a blocked first render. The separate `isRefreshing` flag preserves the revalidation signal without lying about readiness.

## Prevention
- Model cached-data revalidation separately from initial boot whenever a screen can render from storage before the network completes.
- Avoid overloading a single `loading` boolean when the screen has at least two user-visible readiness phases.
- When adding cache-first flows, review all dependent UI conditions, not just the empty-state skeleton.
- Test both of these paths explicitly:
  - no cache available
  - cache available, network still in flight

A useful review rule for cache-backed pages:

```jsx
const isBootstrapping = loading && !hasRenderableData;
const isRefreshing = hasRenderableData && networkRequestInFlight;
```

If both states drive the same UI, the screen is probably hiding a readiness bug.

## Related References
- PR: https://github.com/pkking/gitcode-pr-analyzer/pull/28
- Changed files in the fix: `src/pages/HomePage.jsx`, `etl/scripts/collect-gitcode.ts`
- Related docs in `docs/solutions/`: none found
- Related GitHub issues: none found from a narrow search on homepage overview cache/revalidation terms
