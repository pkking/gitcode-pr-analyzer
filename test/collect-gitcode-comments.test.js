import test from 'node:test';
import assert from 'node:assert/strict';

function mergeComments(reviewComments, issueComments) {
  const seen = new Set();
  const merged = [];

  for (const comment of [...reviewComments, ...issueComments]) {
    if (!seen.has(comment.id)) {
      seen.add(comment.id);
      merged.push(comment);
    }
  }

  return merged;
}

test('mergeComments combines review and issue comments', () => {
  const reviewComments = [
    { id: '1', body: 'Review comment 1', created_at: '2026-04-01T10:00:00Z', user: { login: 'reviewer' } },
  ];
  const issueComments = [
    { id: '2', body: '/compile', created_at: '2026-04-01T10:01:00Z', user: { login: 'developer' } },
  ];

  const merged = mergeComments(reviewComments, issueComments);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, '1');
  assert.equal(merged[1].id, '2');
  assert.equal(merged[1].body, '/compile');
});

test('mergeComments deduplicates comments by ID', () => {
  const reviewComments = [
    { id: '1', body: 'Same comment', created_at: '2026-04-01T10:00:00Z', user: { login: 'user1' } },
  ];
  const issueComments = [
    { id: '1', body: 'Same comment', created_at: '2026-04-01T10:00:00Z', user: { login: 'user1' } },
    { id: '2', body: 'Issue only comment', created_at: '2026-04-01T10:01:00Z', user: { login: 'user2' } },
  ];

  const merged = mergeComments(reviewComments, issueComments);

  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, '1');
  assert.equal(merged[1].id, '2');
});

test('mergeComments handles empty review comments', () => {
  const reviewComments = [];
  const issueComments = [
    { id: '1', body: '/compile', created_at: '2026-04-01T10:00:00Z', user: { login: 'developer' } },
  ];

  const merged = mergeComments(reviewComments, issueComments);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].body, '/compile');
});

test('mergeComments handles empty issue comments', () => {
  const reviewComments = [
    { id: '1', body: 'Review comment', created_at: '2026-04-01T10:00:00Z', user: { login: 'reviewer' } },
  ];
  const issueComments = [];

  const merged = mergeComments(reviewComments, issueComments);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].body, 'Review comment');
});

test('mergeComments preserves trigger comment for CI reconstruction', () => {
  const reviewComments = [
    { id: '1', body: 'LGTM', created_at: '2026-04-01T10:00:00Z', user: { login: 'reviewer' } },
  ];
  const issueComments = [
    { id: '2', body: '/compile', created_at: '2026-04-01T09:00:00Z', user: { login: 'developer' } },
  ];

  const merged = mergeComments(reviewComments, issueComments);

  const hasTrigger = merged.some(c => c.body.trim() === '/compile');
  assert.ok(hasTrigger, '/compile trigger comment should be in merged comments');
});
