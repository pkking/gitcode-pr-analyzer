export function buildBrowsePath({ owner, repo } = {}) {
  if (!owner) return '/browse';
  if (!repo) return `/browse/${owner}`;
  return `/browse/${owner}/${repo}`;
}

export function buildAnalysisPath({ owner, repo, runId } = {}) {
  if (!owner || !repo) return '/analysis';
  if (runId === undefined || runId === null) return `/analysis/${owner}/${repo}`;
  return `/analysis/${owner}/${repo}/${runId}`;
}

export function buildRepoPath({ owner, repo } = {}) {
  if (!owner || !repo) return '/';
  return `/repo/${owner}/${repo}`;
}

export function buildPRAnalysisPath({ owner, repo, prNumber } = {}) {
  if (!owner || !repo || !prNumber) return '/';
  return `/repo/${owner}/${repo}/${prNumber}`;
}

export function getSelectedOrgEntry(orgEntries, params = {}) {
  if (!params.owner) return null;
  return orgEntries.find(org => org.owner === params.owner) || null;
}

export function getSelectedRepoEntry(orgEntries, params = {}) {
  const orgEntry = getSelectedOrgEntry(orgEntries, params);
  if (!orgEntry || !params.repo) return null;
  return orgEntry.repos.find(repo => repo.repo === params.repo) || null;
}

export function getSelectedRun({ repoEntry, repoRunsByKey, params = {} }) {
  if (!repoEntry || !params.runId) return null;
  const runs = repoRunsByKey[repoEntry.key] || [];
  const normalizedRunId = Number(params.runId);
  return runs.find(run => Number(run.id) === normalizedRunId) || null;
}

export function getAnalysisDisplayRun({ selectedRun, recentRuns }) {
  return selectedRun || recentRuns[0] || null;
}

export function hasMissingRequestedRun({ requestedRunId, selectedRun, recentRuns }) {
  return Boolean(requestedRunId) && !selectedRun && recentRuns.length > 0;
}
