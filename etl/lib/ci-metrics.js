export function getCompletedRunFinishTime(run) {
  if (Array.isArray(run?.jobs) && run.jobs.length > 0) {
    let latestCompletedAt = null;

    for (const job of run.jobs) {
      if (!job?.completed_at) return null;
      if (!latestCompletedAt || job.completed_at > latestCompletedAt) {
        latestCompletedAt = job.completed_at;
      }
    }

    if (latestCompletedAt) return latestCompletedAt;
  }

  if (run?.status === 'completed' && run?.updated_at) {
    return run.updated_at;
  }

  return null;
}

export function buildLastCiRemovalToMerge(runs, mergedAtValue, { parseDate, formatDate }) {
  if (!mergedAtValue || !Array.isArray(runs) || runs.length === 0) return null;

  const mergedAt = parseDate(mergedAtValue);
  if (!mergedAt) return null;

  let lastFinishTime = null;

  for (const run of runs) {
    const finishCandidate = getCompletedRunFinishTime(run);
    const finishDate = parseDate(finishCandidate);
    if (!finishDate || finishDate > mergedAt) continue;

    if (!lastFinishTime || finishDate > lastFinishTime) {
      lastFinishTime = finishDate;
    }
  }

  if (!lastFinishTime) return null;

  return {
    durationSeconds: Math.max(0, (mergedAt.getTime() - lastFinishTime.getTime()) / 1000),
    fromTime: formatDate(lastFinishTime),
    toTime: formatDate(mergedAt),
  };
}
