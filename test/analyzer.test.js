import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzePR } from '../src/utils/analyzer.js';

test('analyzePR reconstructs CI cycle from operate logs label timestamps', () => {
  const pr = {
    number: 33516,
    title: 'Example PR',
    state: 'merged',
    created_at: '2026-04-10T08:00:00Z',
    merged_at: '2026-04-10T10:00:00Z',
  };

  const comments = [
    {
      id: 1,
      body: 'compile',
      created_at: '2026-04-10T08:10:00Z',
      user: { login: 'dev' },
    },
  ];

  const history = [];

  const operateLogs = [
    {
      id: 10,
      action: 'label',
      content: 'add label ci-pipeline-running',
      created_at: '2026-04-10T08:11:00Z',
      user: { login: 'bot' },
    },
    {
      id: 11,
      action: 'label',
      content: 'add label ci-pipeline-passed',
      created_at: '2026-04-10T08:25:00Z',
      user: { login: 'bot' },
    },
  ];

  const result = analyzePR(pr, comments, history, operateLogs);

  assert.equal(result.compileToCiCycles.length, 1);
  assert.equal(result.compileToCiCycles[0].durationSeconds, 15 * 60);
  assert.equal(result.lastCiRemovalToMerge.durationSeconds, 95 * 60);
});

test('analyzePR still supports modify history removal entries as fallback', () => {
  const pr = {
    number: 1,
    title: 'Fallback PR',
    state: 'merged',
    created_at: '2026-04-10T08:00:00Z',
    merged_at: '2026-04-10T09:00:00Z',
  };

  const comments = [
    {
      id: 1,
      body: 'compile please',
      created_at: '2026-04-10T08:10:00Z',
      user: { login: 'dev' },
    },
  ];

  const history = [
    {
      id: 2,
      content: 'removed label ci-pipeline-running',
      created_at: '2026-04-10T08:20:00Z',
    },
  ];

  const result = analyzePR(pr, comments, history, []);

  assert.equal(result.compileToCiCycles.length, 1);
  assert.equal(result.compileToCiCycles[0].durationSeconds, 10 * 60);
});
