import { intervalToDuration } from 'date-fns';

const PR_DETAIL_FILE_PATHS = [
  'ascend/pytorch/pr-33542.json',
  'ascend/pytorch/pr-33543.json',
  'ascend/pytorch/pr-33551.json',
  'ascend/pytorch/pr-33552.json',
  'ascend/pytorch/pr-33553.json',
  'ascend/pytorch/pr-33554.json',
];

export function listRepoEntries(indexData) {
  return Object.entries(indexData?.repos || {})
    .map(([key, value]) => {
      const [owner, repo] = key.split('/');
      return {
        key,
        owner,
        repo,
        latest: value.latest,
        files: value.files || [],
        retentionDays: value.retention_days,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function listOrgEntries(indexData) {
  const repoEntries = listRepoEntries(indexData);
  const orgMap = new Map();

  for (const repo of repoEntries) {
    if (!orgMap.has(repo.owner)) {
      orgMap.set(repo.owner, {
        owner: repo.owner,
        key: repo.owner,
        repos: [],
      });
    }

    orgMap.get(repo.owner).repos.push(repo);
  }

  return Array.from(orgMap.values())
    .map(org => ({
      ...org,
      repos: org.repos.sort((a, b) => a.repo.localeCompare(b.repo)),
    }))
    .sort((a, b) => a.owner.localeCompare(b.owner));
}

export function buildRunList(dayFiles) {
  return dayFiles
    .flatMap(file => file?.runs || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function buildRepoRunList(dayFiles, repoKey) {
  return buildRunList(dayFiles).filter(run => getRunRepoKey(run) === repoKey);
}

export function summarizeRun(run) {
  return {
    id: run.id,
    title: run.name,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    conclusion: run.conclusion,
    durationText: formatSeconds(run.durationInSeconds || 0),
    link: run.html_url,
    jobCount: Array.isArray(run.jobs) ? run.jobs.length : 0,
  };
}

export function getPrMergeWaitDuration(detail) {
  return detail?.lastCiRemovalToMerge?.durationSeconds ?? null;
}

export function getRunRepoParts(run) {
  try {
    const url = new URL(run?.html_url || '');
    const segments = url.pathname.split('/').filter(Boolean);
    const mergeRequestIndex = segments.findIndex(segment => segment === 'merge_requests');

    if (mergeRequestIndex < 2) return null;

    const owner = segments[mergeRequestIndex - 2];
    const repo = segments[mergeRequestIndex - 1];

    if (!owner || !repo) return null;

    return { owner, repo, key: `${owner}/${repo}` };
  } catch {
    return null;
  }
}

export function getRunRepoKey(run) {
  return getRunRepoParts(run)?.key || '';
}

export function getRunPrNumber(run) {
  const match = String(run?.name || '').match(/PR\s+#(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function listPrDetailEntries() {
  return PR_DETAIL_FILE_PATHS.map(filePath => {
    const normalizedPath = filePath.toLowerCase();
    const match = normalizedPath.match(/^([^/]+)\/(.+)\/pr-(\d+)\.json$/);
    if (!match) return null;

    const [, owner, repoPath, prNumber] = match;
    return {
      owner,
      repo: repoPath,
      repoKey: `${owner}/${repoPath}`,
      prNumber: Number(prNumber),
      filePath,
      publicPath: `/data/${filePath}`,
      detailKey: `${owner}/${repoPath}#${prNumber}`,
    };
  }).filter(Boolean);
}

export function getPrDetailEntry(owner, repo, prNumber) {
  const normalizedOwner = String(owner || '').toLowerCase();
  const normalizedRepo = String(repo || '').toLowerCase();
  const normalizedPrNumber = Number(prNumber);

  return listPrDetailEntries().find(entry =>
    entry.owner === normalizedOwner &&
    entry.repo === normalizedRepo &&
    entry.prNumber === normalizedPrNumber
  ) || null;
}

export function listOrgPrDetailEntries(owner) {
  const normalizedOwner = String(owner || '').toLowerCase();
  return listPrDetailEntries().filter(entry => entry.owner === normalizedOwner);
}

export function getRunStageName(run) {
  const primaryJob = Array.isArray(run?.jobs) && run.jobs.length > 0 ? run.jobs[0].name : '';
  if (primaryJob) return primaryJob;

  const match = String(run?.name || '').match(/^PR\s+#\d+\s+(.+?)\s+-/i);
  return match ? match[1].trim() : 'unknown';
}

export function average(numbers) {
  const valid = numbers.filter(value => Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function percentile(numbers, p) {
  const valid = numbers.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  const index = (p / 100) * (valid.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return valid[lower];
  const fraction = index - lower;
  return valid[lower] + fraction * (valid[upper] - valid[lower]);
}

export function getSuccessRate(runs) {
  if (!runs.length) return 0;
  const successCount = runs.filter(run => run.conclusion === 'success').length;
  return successCount / runs.length;
}

export function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  if (seconds < 0) return '0s';
  const duration = intervalToDuration({ start: 0, end: Math.round(seconds) * 1000 });
  const parts = [];
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (duration.seconds || parts.length === 0) parts.push(`${duration.seconds}s`);
  return parts.join(' ');
}

let cachedPrDetailIndex = null;

export async function fetchPrDetailIndex() {
  if (cachedPrDetailIndex) return cachedPrDetailIndex;
  try {
    const res = await fetch('/data/pr-details-index.json');
    if (!res.ok) return [];
    const paths = await res.json();
    cachedPrDetailIndex = paths.map(filePath => {
      const normalizedPath = filePath.toLowerCase();
      const match = normalizedPath.match(/^([^/]+)\/(.+)\/pr-(\d+)\.json$/);
      if (!match) return null;
      const [, owner, repoPath, prNumber] = match;
      return {
        owner,
        repo: repoPath,
        repoKey: `${owner}/${repoPath}`,
        prNumber: Number(prNumber),
        filePath,
        publicPath: `/data/${filePath}`,
        detailKey: `${owner}/${repoPath}#${prNumber}`,
      };
    }).filter(Boolean);
    return cachedPrDetailIndex;
  } catch {
    return [];
  }
}

export async function fetchAllPrDetails() {
  const entries = await fetchPrDetailIndex();
  if (entries.length === 0) return {};
  const results = await Promise.all(
    entries.map(async entry => {
      try {
        const res = await fetch(entry.publicPath);
        if (!res.ok) return [entry.detailKey, null];
        const detail = await res.json();
        return [entry.detailKey, detail];
      } catch {
        return [entry.detailKey, null];
      };
    })
  );
  return Object.fromEntries(results.filter(([, v]) => v !== null));
}
