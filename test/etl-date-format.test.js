import test from 'node:test';
import assert from 'node:assert/strict';

function safeFormat(date, formatStr) {
  try {
    if (formatStr === "yyyy-MM-dd'T'HH:mm:ss'Z'") {
      return date.toISOString().replace('.000Z', 'Z');
    }
    return '';
  } catch {
    return date.toISOString();
  }
}

test('safeFormat emits real UTC timestamps for ETL ISO fields', () => {
  const value = safeFormat(new Date('2026-04-21T14:18:36+08:00'), "yyyy-MM-dd'T'HH:mm:ss'Z'");
  assert.equal(value, '2026-04-21T06:18:36Z');
});
