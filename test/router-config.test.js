import test from 'node:test';
import assert from 'node:assert/strict';

import { appRoutes } from '../src/router.js';

test('router exports the expected top-level route contract', () => {
  assert.deepEqual(
    appRoutes.map(route => route.path),
    ['/', '/browse', '/browse/:owner', '/browse/:owner/:repo', '/analysis', '/analysis/:owner/:repo', '/analysis/:owner/:repo/:runId', '/overview', '*']
  );
});
