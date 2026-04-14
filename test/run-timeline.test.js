import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRunTimeline, getRunTotalDuration } from '../src/utils/runTimeline.js';

test('buildRunTimeline returns no phases when PR detail is missing', () => {
  const run = {
    id: 42,
    created_at: '2026-04-04T10:20:53Z',
    durationInSeconds: 214,
    jobs: [
      {
        id: 43,
        name: 'ci-pipeline-running',
        queueDurationInSeconds: 123,
        durationInSeconds: 91,
      },
    ],
  };

  assert.deepEqual(buildRunTimeline(run, null), []);
});

test('getRunTotalDuration falls back to run duration when timeline is unavailable', () => {
  const run = {
    durationInSeconds: 214,
  };

  assert.equal(getRunTotalDuration(run, []), 214);
});

test('buildRunTimeline uses matched PR detail when available', () => {
  const run = {
    id: 42,
    created_at: '2026-04-04T10:20:53Z',
    durationInSeconds: 214,
    jobs: [
      {
        id: 43,
        name: 'ci-pipeline-running',
        started_at: '2026-04-04T10:22:53Z',
        queueDurationInSeconds: 123,
        durationInSeconds: 91,
      },
    ],
  };
  const detail = {
    compileToCiCycles: [
      {
        compileTime: '2026-04-04T10:21:53Z',
        durationSeconds: 91,
      },
    ],
    lastCiRemovalToMerge: {
      durationSeconds: 12,
    },
  };

  assert.deepEqual(buildRunTimeline(run, detail), [
    {
      key: 'comment_to_label',
      eyebrow: 'Phase 1',
      label: 'CI启动时间',
      seconds: 60,
      description: '',
      barClass: 'bg-amber-400',
    },
    {
      key: 'label_to_remove',
      eyebrow: 'Phase 2',
      label: 'CI运行时间',
      seconds: 91,
      description: '',
      barClass: 'bg-emerald-400',
    },
    {
      key: 'remove_to_merge',
      eyebrow: 'Phase 3',
      label: 'PR合入时间',
      seconds: 12,
      description: '',
      barClass: 'bg-sky-400',
    },
  ]);
});
