import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const preCommitConfig = readFileSync(new URL('../.pre-commit-config.yaml', import.meta.url), 'utf8');
const workflowConfig = readFileSync(new URL('../.github/workflows/frontend-lint.yml', import.meta.url), 'utf8');
const eslintConfig = readFileSync(new URL('../eslint.config.js', import.meta.url), 'utf8');

test('package.json exposes the canonical frontend lint command', () => {
  assert.equal(packageJson.scripts.lint, 'node scripts/run-frontend-lint.mjs');
});

test('pre-commit delegates to the canonical lint command for frontend files', () => {
  assert.match(preCommitConfig, /entry: npm run lint --/);
  assert.match(preCommitConfig, /files: \^src\/\.\*\\\.\(js\|jsx\)\$/);
  assert.match(preCommitConfig, /pass_filenames: true/);
});

test('frontend lint workflow runs the canonical lint command', () => {
  assert.match(workflowConfig, /name: Frontend Lint/);
  assert.match(workflowConfig, /node-version: 20/);
  assert.match(workflowConfig, /- run: npm run lint/);
});

test('eslint configuration stays scoped to src frontend files', () => {
  assert.match(eslintConfig, /files: \['src\/\*\*\/\*\.\{js,jsx\}'\]/);
  assert.match(eslintConfig, /'public\/\*\*'/);
  assert.match(eslintConfig, /'etl\/\*\*'/);
});
