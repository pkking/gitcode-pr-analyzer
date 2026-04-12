const LABEL_ADD_PREFIX = 'add label ';
const LABEL_REMOVE_PREFIX = 'delete label ';
const CI_RUNNING_LABEL = 'ci-pipeline-running';
const CI_PASSED_LABEL = 'ci-pipeline-passed';

export const CI_FINISH_LABELS = new Set([CI_RUNNING_LABEL, CI_PASSED_LABEL]);

export function extractLabelEvents({ operateLogs = [], history = [] } = {}) {
  const events = [
    ...operateLogs
      .map(parseOperateLogLabelEvent)
      .filter(Boolean),
    ...history
      .map(parseHistoryLabelEvent)
      .filter(Boolean),
  ];

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

export function extractCiEvents({ operateLogs = [], history = [] } = {}) {
  return extractLabelEvents({ operateLogs, history }).filter(event =>
    event.label === CI_RUNNING_LABEL ||
    (event.type === 'added' && CI_FINISH_LABELS.has(event.label))
  );
}

function parseOperateLogLabelEvent(log) {
  const content = normalizeText(log?.content);
  const createdAt = log?.created_at;
  if (!content || !createdAt) return null;

  if (content.startsWith(LABEL_ADD_PREFIX)) {
    return buildEvent(log, 'added', content.slice(LABEL_ADD_PREFIX.length));
  }

  if (content.startsWith(LABEL_REMOVE_PREFIX)) {
    return buildEvent(log, 'removed', content.slice(LABEL_REMOVE_PREFIX.length));
  }

  return null;
}

function parseHistoryLabelEvent(entry) {
  const content = normalizeText(entry?.content);
  const createdAt = entry?.created_at;
  if (!content || !createdAt) return null;

  if (content.includes('removed label')) {
    return buildEvent(entry, 'removed', content.split('removed label')[1]);
  }

  if (content.includes('移除 标签')) {
    return buildEvent(entry, 'removed', content.split('移除 标签')[1]);
  }

  if (content.includes('added label')) {
    return buildEvent(entry, 'added', content.split('added label')[1]);
  }

  if (content.includes('添加 标签')) {
    return buildEvent(entry, 'added', content.split('添加 标签')[1]);
  }

  return null;
}

function buildEvent(source, type, rawLabel) {
  const label = normalizeText(rawLabel);
  if (!label) return null;

  return {
    id: source.id,
    type,
    label,
    timestamp: new Date(source.created_at),
    content: source.content || '',
    user: source.user?.login || 'unknown',
  };
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}
