import { parseISO, differenceInSeconds, formatDuration, intervalToDuration } from 'date-fns';

const CI_LABEL = 'ci-pipeline-running';

export const analyzePR = (pr, comments, history) => {
  const prCreatedAt = parseISO(pr.created_at);
  const prMergedAt = pr.merged_at ? parseISO(pr.merged_at) : null;

  // 1. Compile to CI removal matching
  const compileComments = comments
    .filter(c => c.body.toLowerCase().includes('compile'))
    .map(c => ({
      id: c.id,
      user: c.user.login,
      timestamp: parseISO(c.created_at),
      body: c.body
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const ciRemovals = history
    .filter(h => {
      const content = h.content || '';
      return (content.includes('移除 标签') || content.includes('removed label')) && content.includes(CI_LABEL);
    })
    .map(h => ({
      id: h.id,
      timestamp: parseISO(h.created_at),
      content: h.content
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const compileToCiCycles = [];
  let lastUsedRemovalIdx = -1;

  for (const comment of compileComments) {
    // Find the first removal AFTER this comment and AFTER the last used removal
    const removal = ciRemovals.find((r, idx) => idx > lastUsedRemovalIdx && r.timestamp > comment.timestamp);
    if (removal) {
      const seconds = differenceInSeconds(removal.timestamp, comment.timestamp);
      compileToCiCycles.push({
        compileTime: comment.timestamp,
        removalTime: removal.timestamp,
        durationSeconds: seconds,
        durationText: formatSeconds(seconds)
      });
      lastUsedRemovalIdx = ciRemovals.indexOf(removal);
    }
  }

  // 2. PR submission to merge
  let prSubmitToMerge = null;
  if (prMergedAt) {
    const seconds = differenceInSeconds(prMergedAt, prCreatedAt);
    prSubmitToMerge = {
      durationSeconds: seconds,
      durationText: formatSeconds(seconds)
    };
  }

  // 3. Last CI removal to merge
  let lastCiRemovalToMerge = null;
  if (prMergedAt && ciRemovals.length > 0) {
    const lastRemoval = ciRemovals[ciRemovals.length - 1];
    if (prMergedAt > lastRemoval.timestamp) {
      const seconds = differenceInSeconds(prMergedAt, lastRemoval.timestamp);
      lastCiRemovalToMerge = {
        durationSeconds: seconds,
        durationText: formatSeconds(seconds)
      };
    }
  }

  return {
    prDetails: {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      created_at: prCreatedAt,
      merged_at: prMergedAt,
    },
    compileToCiCycles,
    prSubmitToMerge,
    lastCiRemovalToMerge
  };
};

const formatSeconds = (seconds) => {
  if (seconds < 0) return '0s';
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  const parts = [];
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (duration.seconds || parts.length === 0) parts.push(`${duration.seconds}s`);
  return parts.join(' ');
};
