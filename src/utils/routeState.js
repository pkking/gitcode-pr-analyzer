export function buildRepoPath({ owner, repo } = {}) {
  if (!owner || !repo) return '/';
  return `/repo/${owner}/${repo}`;
}

export function buildPRAnalysisPath({ owner, repo, prNumber } = {}) {
  if (!owner || !repo || !prNumber) return '/';
  return `/repo/${owner}/${repo}/${prNumber}`;
}
