import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDateRange,
  buildSummaryData,
  buildDetailData,
  buildDefinitionsData,
} from '../src/utils/exportToExcel.js';

describe('generateDateRange', () => {
  it('returns 7 dates for a 7-day range', () => {
    const dates = generateDateRange('2026-04-18', '2026-04-24');
    assert.strictEqual(dates.length, 7);
    assert.deepStrictEqual(dates, [
      '2026-04-18', '2026-04-19', '2026-04-20', '2026-04-21',
      '2026-04-22', '2026-04-23', '2026-04-24',
    ]);
  });

  it('returns single date when start equals end', () => {
    const dates = generateDateRange('2026-04-20', '2026-04-20');
    assert.strictEqual(dates.length, 1);
    assert.strictEqual(dates[0], '2026-04-20');
  });

  it('caps at maxDays', () => {
    const dates = generateDateRange('2026-01-01', '2026-12-31', 90);
    assert.strictEqual(dates.length, 90);
    assert.strictEqual(dates[0], '2026-01-01');
    assert.strictEqual(dates[89], '2026-03-31');
  });

  it('returns empty array when start > end', () => {
    const dates = generateDateRange('2026-04-24', '2026-04-18');
    assert.deepStrictEqual(dates, []);
  });

  it('returns empty array for invalid dates', () => {
    assert.deepStrictEqual(generateDateRange('invalid', '2026-04-24'), []);
    assert.deepStrictEqual(generateDateRange('2026-04-18', 'invalid'), []);
  });
});

describe('buildSummaryData', () => {
  const mockRuns = [
    {
      id: 1,
      name: 'PR #1 compile - test',
      html_url: 'https://gitcode.com/owner/repo/merge_requests/1',
      durationInSeconds: 100,
      conclusion: 'success',
      created_at: '2026-04-20T01:00:00Z',
      jobs: [{ name: 'ci-pipeline', durationInSeconds: 80, queueDurationInSeconds: 20, started_at: '2026-04-20T01:00:20Z', completed_at: '2026-04-20T01:01:40Z' }],
    },
    {
      id: 2,
      name: 'PR #2 compile - test',
      html_url: 'https://gitcode.com/owner/repo/merge_requests/2',
      durationInSeconds: 200,
      conclusion: 'success',
      created_at: '2026-04-20T02:00:00Z',
      jobs: [{ name: 'ci-pipeline', durationInSeconds: 180, queueDurationInSeconds: 20, started_at: '2026-04-20T02:00:20Z', completed_at: '2026-04-20T02:03:20Z' }],
    },
    {
      id: 3,
      name: 'PR #1 compile - test',
      html_url: 'https://gitcode.com/other/repo/merge_requests/1',
      durationInSeconds: 300,
      conclusion: 'failure',
      created_at: '2026-04-20T03:00:00Z',
      jobs: [{ name: 'ci-pipeline', durationInSeconds: 250, queueDurationInSeconds: 50, started_at: '2026-04-20T03:00:50Z', completed_at: '2026-04-20T03:05:00Z' }],
    },
  ];

  it('returns summary rows grouped by repo with correct P50/P90', () => {
    const summary = buildSummaryData(mockRuns);
    assert.strictEqual(summary.length, 2);

    const ownerRepo = summary.find(s => s.repoKey === 'owner/repo');
    assert.ok(ownerRepo);
    assert.strictEqual(ownerRepo.runCount, 2);
    assert.strictEqual(ownerRepo.complianceRate, 100);
    assert.strictEqual(ownerRepo.ciE2EP50, 150);

    const otherRepo = summary.find(s => s.repoKey === 'other/repo');
    assert.ok(otherRepo);
    assert.strictEqual(otherRepo.runCount, 1);
    assert.strictEqual(otherRepo.complianceRate, 0);
  });

  it('returns empty array for empty runs', () => {
    assert.deepStrictEqual(buildSummaryData([]), []);
    assert.deepStrictEqual(buildSummaryData(null), []);
  });

  it('skips runs with unparseable html_url', () => {
    const badRuns = [{ id: 1, name: 'test', html_url: 'not-a-url', durationInSeconds: 100, conclusion: 'success', jobs: [] }];
    assert.deepStrictEqual(buildSummaryData(badRuns), []);
  });
});

describe('buildDetailData', () => {
  const mockRuns = [
    {
      id: 1,
      name: 'PR #1 compile - test',
      html_url: 'https://gitcode.com/owner/repo/merge_requests/1',
      durationInSeconds: 100,
      conclusion: 'success',
      created_at: '2026-04-20T01:00:00Z',
      updated_at: '2026-04-20T01:01:40Z',
      jobs: [
        { name: 'job-a', durationInSeconds: 60, queueDurationInSeconds: 10, conclusion: 'success', created_at: '2026-04-20T01:00:00Z', completed_at: '2026-04-20T01:01:10Z' },
        { name: 'job-b', durationInSeconds: 30, queueDurationInSeconds: 5, conclusion: 'success', created_at: '2026-04-20T01:00:00Z', completed_at: '2026-04-20T01:00:35Z' },
      ],
    },
  ];

  it('flattens runs×jobs into detail rows', () => {
    const details = buildDetailData(mockRuns);
    assert.strictEqual(details.length, 2);
    assert.strictEqual(details[0].jobName, 'job-a');
    assert.strictEqual(details[1].jobName, 'job-b');
    assert.strictEqual(details[0].repo, 'owner/repo');
    assert.strictEqual(details[0].prNumber, 1);
  });

  it('filters by selected columns', () => {
    const details = buildDetailData(mockRuns, ['repo', 'jobName', 'totalDuration']);
    assert.strictEqual(details.length, 2);
    assert.ok(details[0].repo);
    assert.ok(details[0].jobName);
    assert.ok(details[0].totalDuration !== undefined);
    assert.strictEqual(details[0].prNumber, undefined);
  });

  it('produces 0 rows for runs with no jobs', () => {
    const noJobRuns = [{ id: 1, name: 'PR #1 compile', html_url: 'https://gitcode.com/owner/repo/merge_requests/1', durationInSeconds: 100, conclusion: 'success', created_at: '2026-04-20T01:00:00Z', jobs: [] }];
    assert.deepStrictEqual(buildDetailData(noJobRuns), []);
  });

  it('returns empty array for empty runs', () => {
    assert.deepStrictEqual(buildDetailData([]), []);
    assert.deepStrictEqual(buildDetailData(null), []);
  });
});

describe('buildDefinitionsData', () => {
  it('returns definitions for all 27 columns (13 summary + 14 detail)', () => {
    const defs = buildDefinitionsData();
    assert.strictEqual(defs.length, 21);
    assert.ok(defs[0]['指标名称']);
    assert.ok(defs[0]['定义说明']);
  });
});
