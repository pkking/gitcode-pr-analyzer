import test from 'node:test';
import assert from 'node:assert/strict';
import { CI_FINISH_LABELS, extractCiEvents } from '../src/utils/gitcodeCiEvents.js';

test('CI_FINISH_LABELS includes ci-pipeline-failed', () => {
  assert.ok(CI_FINISH_LABELS.has('ci-pipeline-failed'), 'CI_FINISH_LABELS should contain ci-pipeline-failed');
});

test('CI_FINISH_LABELS includes docs-ci-pipeline-failed', () => {
  assert.ok(CI_FINISH_LABELS.has('docs-ci-pipeline-failed'), 'CI_FINISH_LABELS should contain docs-ci-pipeline-failed');
});

test('extractCiEvents captures ci-pipeline-failed label addition', () => {
  const history = [
    {
      id: '1',
      content: 'added label ci-pipeline-failed',
      created_at: '2024-01-01T00:00:00Z',
      user: { login: 'bot' },
    },
  ];

  const result = extractCiEvents({ history });

  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'ci-pipeline-failed');
  assert.equal(result[0].type, 'added');
});

test('extractCiEvents captures docs-ci-pipeline-failed label addition', () => {
  const history = [
    {
      id: '2',
      content: 'added label docs-ci-pipeline-failed',
      created_at: '2024-01-01T00:00:00Z',
      user: { login: 'bot' },
    },
  ];

  const result = extractCiEvents({ history });

  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'docs-ci-pipeline-failed');
  assert.equal(result[0].type, 'added');
});

test('extractCiEvents still captures ci-pipeline-passed (regression test)', () => {
  const history = [
    {
      id: '3',
      content: 'added label ci-pipeline-passed',
      created_at: '2024-01-01T00:00:00Z',
      user: { login: 'bot' },
    },
  ];

  const result = extractCiEvents({ history });

  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'ci-pipeline-passed');
  assert.equal(result[0].type, 'added');
});
