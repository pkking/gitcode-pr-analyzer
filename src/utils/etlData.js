import { intervalToDuration } from 'date-fns';

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

export function buildRunList(dayFiles) {
  return dayFiles
    .flatMap(file => file?.runs || [])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

export function formatSeconds(seconds) {
  if (seconds < 0) return '0s';
  const duration = intervalToDuration({ start: 0, end: Math.round(seconds) * 1000 });
  const parts = [];
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (duration.seconds || parts.length === 0) parts.push(`${duration.seconds}s`);
  return parts.join(' ');
}
