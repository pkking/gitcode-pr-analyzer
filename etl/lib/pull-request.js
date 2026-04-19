export function normalizeMergedAt(value) {
  const mergedAt = String(value || '').trim();
  return mergedAt ? mergedAt : null;
}

export function mergePullRequestData(summary = {}, detail = {}) {
  const mergedAt = normalizeMergedAt(detail.merged_at) || normalizeMergedAt(summary.merged_at);
  return {
    ...summary,
    ...detail,
    merged_at: mergedAt,
  };
}

export function needsPullRequestHydration(pr = {}) {
  return !normalizeMergedAt(pr.merged_at);
}
