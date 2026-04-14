import test from 'node:test';
import assert from 'node:assert/strict';

import { listRepoEntries, buildRunList, summarizeRun, getPrMergeWaitDuration } from '../src/utils/etlData.js';

test('listRepoEntries converts ETL index repos map into sorted repo entries', () => {
  const indexData = {
    repos: {
      'Ascend/community': {
        latest: '2026-04-04',
        files: ['2026-04-04.json', '2026-04-03.json'],
        retention_days: 365,
      },
      'vllm-project/vllm-ascend': {
        latest: '2026-04-02',
        files: ['2026-04-02.json'],
        retention_days: 90,
      },
    },
  };

  assert.deepEqual(listRepoEntries(indexData), [
    {
      key: 'Ascend/community',
      owner: 'Ascend',
      repo: 'community',
      latest: '2026-04-04',
      files: ['2026-04-04.json', '2026-04-03.json'],
      retentionDays: 365,
    },
    {
      key: 'vllm-project/vllm-ascend',
      owner: 'vllm-project',
      repo: 'vllm-ascend',
      latest: '2026-04-02',
      files: ['2026-04-02.json'],
      retentionDays: 90,
    },
  ]);
});

test('buildRunList flattens and sorts repo day files by created_at descending', () => {
  const dayFiles = [
    {
      date: '2026-04-03',
      repo: 'Ascend/community',
      runs: [
        { id: 1, name: 'older', created_at: '2026-04-03T09:00:00Z', conclusion: 'success', durationInSeconds: 30, jobs: [] },
      ],
    },
    {
      date: '2026-04-04',
      repo: 'Ascend/community',
      runs: [
        { id: 2, name: 'newer', created_at: '2026-04-04T08:00:00Z', conclusion: 'failure', durationInSeconds: 40, jobs: [] },
      ],
    },
  ];

  assert.deepEqual(
    buildRunList(dayFiles).map(run => run.id),
    [2, 1]
  );
});

test('summarizeRun derives stable display fields from an ETL run', () => {
  const summary = summarizeRun({
    id: 42,
    name: 'PR #465 compile - add reviewers for mindspeed',
    created_at: '2026-04-04T10:20:53Z',
    updated_at: '2026-04-04T10:24:27Z',
    conclusion: 'success',
    durationInSeconds: 214,
    html_url: 'https://gitcode.com/Ascend/community/merge_requests/465',
    jobs: [
      {
        id: 43,
        name: 'ci-pipeline-running',
        queueDurationInSeconds: 123,
        durationInSeconds: 91,
      },
    ],
  });

  assert.equal(summary.title, 'PR #465 compile - add reviewers for mindspeed');
  assert.equal(summary.durationText, '3m 34s');
  assert.equal(summary.jobCount, 1);
  assert.equal(summary.link, 'https://gitcode.com/Ascend/community/merge_requests/465');
});

test('getPrMergeWaitDuration uses label-removal-to-merge duration', () => {
  const detail = {
    prSubmitToMerge: {
      durationSeconds: 5635,
    },
    lastCiRemovalToMerge: {
      durationSeconds: 572,
    },
  };

  assert.equal(getPrMergeWaitDuration(detail), 572);
});
