import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const FRONTEND_FILE_PATTERN = /^src\/.+\.(js|jsx)$/;

function normalizeTarget(target) {
  return target.split(path.sep).join('/');
}

function collectTargets(args) {
  const normalized = args
    .map(normalizeTarget)
    .filter(target => FRONTEND_FILE_PATTERN.test(target));

  if (normalized.length > 0) {
    return [...new Set(normalized)];
  }

  if (args.length > 0) {
    return [];
  }

  return ['src'];
}

const eslintBin = path.resolve('node_modules', 'eslint', 'bin', 'eslint.js');

if (!existsSync(eslintBin)) {
  console.error('ESLint is not installed. Run `npm install` first.');
  process.exit(1);
}

const targets = collectTargets(process.argv.slice(2));

if (targets.length === 0) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [eslintBin, '--max-warnings=0', ...targets],
  { stdio: 'inherit' }
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
