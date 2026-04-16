import test from 'node:test';
import assert from 'node:assert/strict';

import { getAnalysisDisplayRun, hasMissingRequestedRun } from '../src/utils/routeState.js';

test('getAnalysisDisplayRun falls back to most recent repo run when no run param resolves', () => {
  const recentRuns = [
    { id: 300 },
    { id: 200 },
  ];

  assert.equal(getAnalysisDisplayRun({ selectedRun: null, recentRuns })?.id, 300);
  assert.equal(getAnalysisDisplayRun({ selectedRun: { id: 200 }, recentRuns })?.id, 200);
  assert.equal(getAnalysisDisplayRun({ selectedRun: null, recentRuns: [] }), null);
});

test('hasMissingRequestedRun only flags unresolved explicit run requests', () => {
  assert.equal(hasMissingRequestedRun({ requestedRunId: '42', selectedRun: null, recentRuns: [{ id: 1 }] }), true);
  assert.equal(hasMissingRequestedRun({ requestedRunId: null, selectedRun: null, recentRuns: [{ id: 1 }] }), false);
  assert.equal(hasMissingRequestedRun({ requestedRunId: '42', selectedRun: { id: 42 }, recentRuns: [{ id: 42 }] }), false);
  assert.equal(hasMissingRequestedRun({ requestedRunId: '42', selectedRun: null, recentRuns: [] }), false);
});
