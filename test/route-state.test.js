import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAnalysisPath,
  buildBrowsePath,
  getSelectedOrgEntry,
  getSelectedRepoEntry,
  getSelectedRun,
} from '../src/utils/routeState.js';

const orgEntries = [
  {
    owner: 'Ascend',
    repos: [
      {
        key: 'Ascend/community',
        owner: 'Ascend',
        repo: 'community',
      },
      {
        key: 'Ascend/pytorch',
        owner: 'Ascend',
        repo: 'pytorch',
      },
    ],
  },
];

const repoRunsByKey = {
  'Ascend/community': [
    { id: 101, name: 'PR #101 compile - test', html_url: 'https://gitcode.com/Ascend/community/merge_requests/101' },
    { id: 88, name: 'PR #88 docs-ci - test', html_url: 'https://gitcode.com/Ascend/community/merge_requests/88' },
  ],
};

test('buildBrowsePath creates canonical browse routes', () => {
  assert.equal(buildBrowsePath(), '/browse');
  assert.equal(buildBrowsePath({ owner: 'Ascend' }), '/browse/Ascend');
  assert.equal(buildBrowsePath({ owner: 'Ascend', repo: 'community' }), '/browse/Ascend/community');
});

test('buildAnalysisPath creates canonical analysis routes', () => {
  assert.equal(buildAnalysisPath(), '/analysis');
  assert.equal(buildAnalysisPath({ owner: 'Ascend', repo: 'community' }), '/analysis/Ascend/community');
  assert.equal(buildAnalysisPath({ owner: 'Ascend', repo: 'community', runId: 101 }), '/analysis/Ascend/community/101');
});

test('selection helpers derive org and repo entries from route params', () => {
  assert.equal(getSelectedOrgEntry(orgEntries, { owner: 'Ascend' })?.owner, 'Ascend');
  assert.equal(getSelectedRepoEntry(orgEntries, { owner: 'Ascend', repo: 'community' })?.key, 'Ascend/community');
  assert.equal(getSelectedRepoEntry(orgEntries, { owner: 'Ascend', repo: 'missing' }), null);
});

test('getSelectedRun derives a run from repo context and route params', () => {
  const repoEntry = orgEntries[0].repos[0];

  assert.equal(
    getSelectedRun({
      repoEntry,
      repoRunsByKey,
      params: { runId: '101' },
    })?.id,
    101
  );

  assert.equal(
    getSelectedRun({
      repoEntry,
      repoRunsByKey,
      params: {},
    }),
    null
  );
});
