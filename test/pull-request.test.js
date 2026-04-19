import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergePullRequestData,
  needsPullRequestHydration,
  normalizeMergedAt,
} from '../etl/lib/pull-request.js';

test('normalizeMergedAt converts empty merge timestamps to null', () => {
  assert.equal(normalizeMergedAt(''), null);
  assert.equal(normalizeMergedAt('   '), null);
  assert.equal(normalizeMergedAt(null), null);
  assert.equal(normalizeMergedAt('2026-04-19T08:00:00+08:00'), '2026-04-19T08:00:00+08:00');
});

test('needsPullRequestHydration detects missing merged_at values from list payloads', () => {
  assert.equal(needsPullRequestHydration({ merged_at: '' }), true);
  assert.equal(needsPullRequestHydration({ merged_at: null }), true);
  assert.equal(needsPullRequestHydration({ merged_at: '2026-04-19T08:00:00+08:00' }), false);
});

test('mergePullRequestData prefers normalized merged_at from detail payload', () => {
  const merged = mergePullRequestData(
    {
      number: 1067,
      merged_at: '',
      title: 'summary title',
    },
    {
      merged_at: '2026-04-19T08:00:00+08:00',
      title: 'detail title',
    }
  );

  assert.equal(merged.merged_at, '2026-04-19T08:00:00+08:00');
  assert.equal(merged.title, 'detail title');
});

test('mergePullRequestData falls back to normalized summary merged_at when detail is also blank', () => {
  const merged = mergePullRequestData(
    {
      number: 1067,
      merged_at: '2026-04-19T08:00:00+08:00',
    },
    {
      merged_at: '   ',
    }
  );

  assert.equal(merged.merged_at, '2026-04-19T08:00:00+08:00');
});
