import { parseISO, differenceInSeconds, formatDuration, intervalToDuration } from 'date-fns';
import { extractCiEvents } from './gitcodeCiEvents.js';

const CI_LABEL = 'ci-pipeline-running';
const CI_FINISH_LABEL = 'ci-pipeline-passed';

export const analyzePR = (pr, comments, history, operateLogs = []) => {
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

  const ciFinishEvents = extractCiEvents({ history, operateLogs })
    .filter(event => (
      (event.type === 'removed' && event.label === CI_LABEL) ||
      (event.type === 'added' && event.label === CI_FINISH_LABEL)
    ))
    .map(event => ({
      id: event.id,
      timestamp: event.timestamp,
      content: event.content,
      label: event.label,
      type: event.type,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const compileToCiCycles = [];
  let lastUsedFinishIdx = -1;

  for (const comment of compileComments) {
    // Match each compile comment to the first finish event after it.
    const finish = ciFinishEvents.find((event, idx) => idx > lastUsedFinishIdx && event.timestamp > comment.timestamp);
    if (finish) {
      const seconds = differenceInSeconds(finish.timestamp, comment.timestamp);
      compileToCiCycles.push({
        compileTime: comment.timestamp,
        removalTime: finish.timestamp,
        durationSeconds: seconds,
        durationText: formatSeconds(seconds)
      });
      lastUsedFinishIdx = ciFinishEvents.indexOf(finish);
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
  if (prMergedAt && ciFinishEvents.length > 0) {
    const lastFinish = ciFinishEvents[ciFinishEvents.length - 1];
    if (prMergedAt > lastFinish.timestamp) {
      const seconds = differenceInSeconds(prMergedAt, lastFinish.timestamp);
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
