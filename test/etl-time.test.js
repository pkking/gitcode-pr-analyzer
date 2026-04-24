import test from 'node:test';
import assert from 'node:assert/strict';

import { toUtcISOString } from '../etl/lib/time.js';
import { safeFormatUtc } from '../etl/lib/time.js';

test('toUtcISOString preserves UTC semantics instead of relabeling local time as Z', () => {
  const date = new Date('2026-04-16T14:07:18+08:00');

  assert.equal(toUtcISOString(date), '2026-04-16T06:07:18.000Z');
});

test('safeFormatUtc removes milliseconds regardless of precision', () => {
  const customDate = {
    toISOString() {
      return '2026-04-16T06:07:18.123456Z';
    },
  };

  assert.equal(safeFormatUtc(customDate), '2026-04-16T06:07:18Z');
});
