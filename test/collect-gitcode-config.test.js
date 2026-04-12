import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, normalizeRepoIdentifier, resolveRepoTargets } from '../etl/lib/config.js';

const compileRules = [
  {
    id: 'compile',
    when: [
      { phase: 'trigger', source: 'comment', pattern: 'compile', match: 'equals' },
    ],
  },
];

const docsRules = [
  {
    id: 'docs-ci',
    when: [
      { phase: 'trigger', source: 'comment', pattern: '/compile', match: 'equals' },
    ],
  },
];

test('normalizeConfig preserves legacy explicit repo lists', () => {
  const config = normalizeConfig({
    repos: ['vllm-project/vllm-ascend'],
    orgs: [
      {
        name: 'Ascend',
        repos: ['Ascend/community'],
        rules: compileRules,
      },
    ],
  });

  assert.deepEqual(config.repos, ['vllm-project/vllm-ascend']);
  assert.equal(config.orgs.length, 1);
  assert.deepEqual(config.orgs[0].repos, ['Ascend/community']);
  assert.deepEqual(config.orgs[0].exclude, []);
  assert.deepEqual(config.orgs[0].repo_overrides, {});
});

test('normalizeRepoIdentifier trims whitespace around repo separators', () => {
  assert.equal(normalizeRepoIdentifier(' Ascend / model-agent '), 'Ascend/model-agent');
  assert.equal(normalizeRepoIdentifier('Ascend / nested / repo'), 'Ascend/nested/repo');
});

test('resolveRepoTargets discovers org repos when repos list is omitted', async () => {
  const config = normalizeConfig({
    orgs: [
      {
        name: 'Ascend',
        rules: compileRules,
        exclude: ['Ascend/ignored'],
        repo_overrides: {
          'Ascend/pytorch': {
            rules: docsRules,
            mode: 'append',
          },
        },
      },
    ],
  });

  const targets = await resolveRepoTargets(config, async orgName => {
    assert.equal(orgName, 'Ascend');
    return ['Ascend/community', 'Ascend/pytorch', 'Ascend/ignored'];
  });

  assert.deepEqual(
    targets.map(target => target.repo),
    ['Ascend/community', 'Ascend/pytorch']
  );
  assert.deepEqual(targets[0].rules, compileRules);
  assert.deepEqual(targets[1].rules, [...compileRules, ...docsRules]);
  assert.equal(targets[1].source, 'org-discovery');
});

test('resolveRepoTargets canonicalizes discovered repo names before exclude and overrides', async () => {
  const config = normalizeConfig({
    orgs: [
      {
        name: 'Ascend',
        rules: compileRules,
        exclude: ['Ascend/ignored'],
        repo_overrides: {
          'Ascend/model-agent': {
            rules: docsRules,
            mode: 'replace',
          },
        },
      },
    ],
  });

  const targets = await resolveRepoTargets(config, async () => [
    ' Ascend / model-agent ',
    'Ascend / ignored',
  ]);

  assert.deepEqual(targets.map(target => target.repo), ['Ascend/model-agent']);
  assert.deepEqual(targets[0].rules, docsRules);
});

test('resolveRepoTargets deduplicates targets across top-level repos and org discovery', async () => {
  const config = normalizeConfig({
    repos: ['Ascend/community'],
    orgs: [
      {
        name: 'Ascend',
        rules: compileRules,
      },
    ],
  });

  const targets = await resolveRepoTargets(config, async () => [
    'Ascend/community',
    'Ascend/pytorch',
  ]);

  assert.deepEqual(
    targets.map(target => target.repo),
    ['Ascend/community', 'Ascend/pytorch']
  );
  assert.equal(targets.find(target => target.repo === 'Ascend/community')?.source, 'top-level');
});

test('resolveRepoTargets uses replace override mode when requested', async () => {
  const config = normalizeConfig({
    orgs: [
      {
        name: 'Ascend',
        rules: compileRules,
        repo_overrides: {
          'Ascend/community': {
            rules: docsRules,
            mode: 'replace',
          },
        },
      },
    ],
  });

  const targets = await resolveRepoTargets(config, async () => ['Ascend/community']);

  assert.deepEqual(targets[0].rules, docsRules);
});
