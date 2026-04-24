import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLastCiRemovalToMerge, getCompletedRunFinishTime } from '../etl/lib/ci-metrics.js';

function parseDate(value) {
  return value ? new Date(value) : null;
}

function formatDate(value) {
  return value.toISOString().replace('.000', '');
}

test('getCompletedRunFinishTime prefers completed_at from the primary job', () => {
  const finishTime = getCompletedRunFinishTime({
    status: 'completed',
    created_at: '2026-04-23T00:00:00Z',
    updated_at: '2026-04-23T03:50:32Z',
    jobs: [{ completed_at: '2026-04-23T00:26:41Z' }],
  });

  assert.equal(finishTime, '2026-04-23T00:26:41Z');
});

test('getCompletedRunFinishTime returns the latest completed_at across all jobs', () => {
  const finishTime = getCompletedRunFinishTime({
    status: 'completed',
    created_at: '2026-04-23T00:00:00Z',
    updated_at: '2026-04-23T03:50:32Z',
    jobs: [
      { completed_at: '2026-04-23T00:26:41Z' },
      { completed_at: '2026-04-23T00:40:00Z' },
    ],
  });

  assert.equal(finishTime, '2026-04-23T00:40:00Z');
});

test('getCompletedRunFinishTime falls back to updated_at for completed runs even when timestamps match', () => {
  const finishTime = getCompletedRunFinishTime({
    status: 'completed',
    created_at: '2026-04-23T00:00:00Z',
    updated_at: '2026-04-23T00:00:00Z',
    jobs: [],
  });

  assert.equal(finishTime, '2026-04-23T00:00:00Z');
});

test('getCompletedRunFinishTime ignores pending runs without a real completion timestamp', () => {
  const finishTime = getCompletedRunFinishTime({
    status: 'pending',
    created_at: '2026-04-23T00:00:00Z',
    updated_at: '2026-04-23T03:50:32Z',
    jobs: [{ completed_at: null }],
  });

  assert.equal(finishTime, null);
});

test('buildLastCiRemovalToMerge ignores unfinished runs that would otherwise collapse merge wait to zero', () => {
  const result = buildLastCiRemovalToMerge(
    [
      {
        status: 'completed',
        created_at: '2026-04-23T00:00:00Z',
        updated_at: '2026-04-23T00:26:41Z',
        jobs: [{ completed_at: '2026-04-23T00:26:41Z' }],
      },
      {
        status: 'pending',
        created_at: '2026-04-23T00:08:18Z',
        updated_at: '2026-04-23T03:50:32Z',
        jobs: [{ completed_at: null }],
      },
    ],
    '2026-04-23T03:50:32Z',
    { parseDate, formatDate }
  );

  assert.deepEqual(result, {
    durationSeconds: 12231,
    fromTime: '2026-04-23T00:26:41Z',
    toTime: '2026-04-23T03:50:32Z',
  });
});

test('buildLastCiRemovalToMerge returns null when there is no completed CI run', () => {
  const result = buildLastCiRemovalToMerge(
    [
      {
        status: 'pending',
        created_at: '2026-04-23T00:08:18Z',
        updated_at: '2026-04-23T03:50:32Z',
        jobs: [{ completed_at: null }],
      },
    ],
    '2026-04-23T03:50:32Z',
    { parseDate, formatDate }
  );

  assert.equal(result, null);
});
