import test from 'node:test';
import assert from 'node:assert/strict';

import { appRoutes } from '../src/router.js';

test('router exports the expected top-level route contract', () => {
  assert.deepEqual(
    appRoutes.map(route => route.path),
    ['/', '/repo/:owner/:repo', '/repo/:owner/:repo/:prNumber', '*']
  );
});
