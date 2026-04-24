import test from 'node:test';
import assert from 'node:assert/strict';

import { safeFormatUtc } from '../etl/lib/time.js';

test('safeFormat emits real UTC timestamps for ETL ISO fields', () => {
  const value = safeFormatUtc(new Date('2026-04-21T14:18:36+08:00'));
  assert.equal(value, '2026-04-21T06:18:36Z');
});
