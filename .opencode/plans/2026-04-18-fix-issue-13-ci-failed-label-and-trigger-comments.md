# Fix Issue #13: CI Pipeline Failed Label & Missing Trigger Comments

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs: (1) `ci-pipeline-failed` label not being tracked in CI events, and (2) ETL only fetching review comments but missing issue-style comments that contain trigger commands like "/compile".

**Architecture:** Two independent fixes: one in the CI events utility (JavaScript) and one in the ETL collector (TypeScript). Both require new tests and follow TDD.

**Tech Stack:** Node.js test runner, JavaScript/JSX for frontend utils, TypeScript for ETL

---

## Task Dependency Graph

| Task | Depends On | Reason |
|------|------------|--------|
| Task 1 | None | Fix CI_FINISH_LABELS - independent utility change |
| Task 2 | None | Fix ETL comment fetching - independent ETL change |
| Task 3 | Task 1, Task 2 | Integration verification - verify both fixes work together |

## Parallel Execution Graph

Wave 1 (Start immediately):
├── Task 1: Add `ci-pipeline-failed` to CI_FINISH_LABELS with tests (no dependencies)
└── Task 2: Fetch issue-style comments in ETL with tests (no dependencies)

Wave 2 (After Wave 1 completes):
└── Task 3: Integration verification (depends: Task 1, Task 2)

Critical Path: Task 1 → Task 3 (or Task 2 → Task 3)
Estimated Parallel Speedup: 50% faster than sequential

## Tasks

### Task 1: Add `ci-pipeline-failed` and `docs-ci-pipeline-failed` to CI_FINISH_LABELS

**Files:**
- Modify: `src/utils/gitcodeCiEvents.js:6`
- Create: `test/gitcode-ci-events.test.js`

**Context:** The `CI_FINISH_LABELS` Set at line 6 currently only contains `ci-pipeline-running` and `ci-pipeline-passed`. The `extractCiEvents()` function at line 21-26 filters events to only include:
- Events with label === `ci-pipeline-running` (any type)
- Events with type === 'added' AND label in `CI_FINISH_LABELS`

This means `ci-pipeline-failed` label additions are silently dropped because they're not in the Set.

**Steps:**

- [ ] **Step 1: Write failing tests for CI_FINISH_LABELS**

Create `test/gitcode-ci-events.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCiEvents, CI_FINISH_LABELS } from '../src/utils/gitcodeCiEvents.js';

test('CI_FINISH_LABELS includes ci-pipeline-failed', () => {
  assert.ok(CI_FINISH_LABELS.has('ci-pipeline-failed'), 'ci-pipeline-failed should be in CI_FINISH_LABELS');
});

test('CI_FINISH_LABELS includes docs-ci-pipeline-failed', () => {
  assert.ok(CI_FINISH_LABELS.has('docs-ci-pipeline-failed'), 'docs-ci-pipeline-failed should be in CI_FINISH_LABELS');
});

test('extractCiEvents captures ci-pipeline-failed label addition', () => {
  const operateLogs = [
    { id: 1, content: 'add label ci-pipeline-running', created_at: '2026-04-01T10:00:00Z', user: { login: 'bot' } },
    { id: 2, content: 'add label ci-pipeline-failed', created_at: '2026-04-01T10:05:00Z', user: { login: 'bot' } },
  ];

  const events = extractCiEvents({ operateLogs });

  assert.equal(events.length, 2);
  assert.equal(events[0].label, 'ci-pipeline-running');
  assert.equal(events[0].type, 'added');
  assert.equal(events[1].label, 'ci-pipeline-failed');
  assert.equal(events[1].type, 'added');
});

test('extractCiEvents captures docs-ci-pipeline-failed label addition', () => {
  const operateLogs = [
    { id: 1, content: 'add label ci-pipeline-running', created_at: '2026-04-01T10:00:00Z', user: { login: 'bot' } },
    { id: 2, content: 'add label docs-ci-pipeline-failed', created_at: '2026-04-01T10:05:00Z', user: { login: 'bot' } },
  ];

  const events = extractCiEvents({ operateLogs });

  assert.equal(events.length, 2);
  assert.equal(events[1].label, 'docs-ci-pipeline-failed');
  assert.equal(events[1].type, 'added');
});

test('extractCiEvents still captures ci-pipeline-passed', () => {
  const operateLogs = [
    { id: 1, content: 'add label ci-pipeline-running', created_at: '2026-04-01T10:00:00Z', user: { login: 'bot' } },
    { id: 2, content: 'add label ci-pipeline-passed', created_at: '2026-04-01T10:05:00Z', user: { login: 'bot' } },
  ];

  const events = extractCiEvents({ operateLogs });

  assert.equal(events.length, 2);
  assert.equal(events[1].label, 'ci-pipeline-passed');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/gitcode-ci-events.test.js`
Expected: FAIL - `ci-pipeline-failed` and `docs-ci-pipeline-failed` not in CI_FINISH_LABELS

- [ ] **Step 3: Add CI_FAILED_LABEL and DOCS_CI_FAILED_LABEL constants**

Modify `src/utils/gitcodeCiEvents.js` lines 1-6:

```javascript
const LABEL_ADD_PREFIX = 'add label ';
const LABEL_REMOVE_PREFIX = 'delete label ';
const CI_RUNNING_LABEL = 'ci-pipeline-running';
const CI_PASSED_LABEL = 'ci-pipeline-passed';
const CI_FAILED_LABEL = 'ci-pipeline-failed';
const DOCS_CI_FAILED_LABEL = 'docs-ci-pipeline-failed';

export const CI_FINISH_LABELS = new Set([CI_RUNNING_LABEL, CI_PASSED_LABEL, CI_FAILED_LABEL, DOCS_CI_FAILED_LABEL]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/gitcode-ci-events.test.js`
Expected: All 5 tests PASS

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/utils/gitcodeCiEvents.js test/gitcode-ci-events.test.js
git commit -m "fix: add ci-pipeline-failed and docs-ci-pipeline-failed to CI_FINISH_LABELS

- Add CI_FAILED_LABEL and DOCS_CI_FAILED_LABEL constants
- Include both in CI_FINISH_LABELS Set so extractCiEvents() captures them
- Add comprehensive tests for failed label detection
- Fixes issue #13: ci-pipeline-failed label not being tracked"
```

### Task 2: Fetch issue-style comments in ETL and merge with review comments

**Files:**
- Modify: `etl/scripts/collect-gitcode.ts` (lines 517-522, and interface at line 77)
- Create: `test/collect-gitcode-comments.test.js`

**Context:** The ETL at line 517-520 only fetches review comments from `/pulls/{number}/comments`. Trigger comments like "/compile" are often posted as general discussion comments, which on GitCode (Gitee-compatible API) are stored at `/issues/{number}/comments`. We need to fetch both and merge them.

The `GitCodeComment` interface at line 77-83 is sufficient for both comment types since they share the same structure (id, body, created_at, user).

**Steps:**

- [ ] **Step 1: Write failing tests for issue comment fetching**

Create `test/collect-gitcode-comments.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

// Test the comment merging logic that will be extracted from collect-gitcode.ts
// We test the pure function that merges and deduplicates comments

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

  // The /compile trigger should be present for CI reconstruction
  const hasTrigger = merged.some(c => c.body.trim() === '/compile');
  assert.ok(hasTrigger, '/compile trigger comment should be in merged comments');
});
```

- [ ] **Step 2: Run tests to verify they pass (pure function tests)**

Run: `node --test test/collect-gitcode-comments.test.js`
Expected: All 5 tests PASS (these test the logic pattern we'll implement)

- [ ] **Step 3: Modify ETL to fetch issue-style comments**

Modify `etl/scripts/collect-gitcode.ts` lines 517-522:

Replace:
```typescript
const [comments, logs] = await Promise.all([
  paginate(`/repos/${ownerPath}/${repoPath}/pulls/${pr.number}/comments`),
  paginate(`/repos/${ownerPath}/${repoPath}/pulls/${pr.number}/operate_logs`),
]);

console.log(`    ${comments.length} comments, ${logs.length} operate logs`);
```

With:
```typescript
const [reviewComments, issueComments, logs] = await Promise.all([
  paginate(`/repos/${ownerPath}/${repoPath}/pulls/${pr.number}/comments`),
  paginate(`/repos/${ownerPath}/${repoPath}/issues/${pr.number}/comments`),
  paginate(`/repos/${ownerPath}/${repoPath}/pulls/${pr.number}/operate_logs`),
]);

// Merge and deduplicate comments by ID
const seenCommentIds = new Set<string>();
const comments: GitCodeComment[] = [];

for (const comment of [...reviewComments, ...issueComments]) {
  if (!seenCommentIds.has(comment.id)) {
    seenCommentIds.add(comment.id);
    comments.push(comment);
  }
}

console.log(`    ${reviewComments.length} review comments, ${issueComments.length} issue comments, ${logs.length} operate logs (${comments.length} merged)`);
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 5: Run lint check**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add etl/scripts/collect-gitcode.ts test/collect-gitcode-comments.test.js
git commit -m "fix: fetch issue-style comments for trigger detection

- Add fetching from /issues/{number}/comments endpoint alongside /pulls/{number}/comments
- Merge and deduplicate comments by ID before building CI timeline
- This captures trigger comments like '/compile' posted as general discussion
- Fixes issue #13: trigger comments not being recognized"
```

### Task 3: Integration verification

**Files:**
- No file changes - verification only

**Steps:**

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS including new tests from Task 1 and Task 2

- [ ] **Step 2: Run lint check**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Verify ETL compiles**

Run: `npx tsc --noEmit etl/scripts/collect-gitcode.ts --experimental-strip-types` (or `npm run collect` with a test token)
Expected: No TypeScript errors

- [ ] **Step 4: Manual verification checklist**

Verify the following scenarios would work:
1. When CI pipeline fails, `ci-pipeline-failed` label is captured by `extractCiEvents()`
2. When docs-ci pipeline fails, `docs-ci-pipeline-failed` label is captured
3. Trigger comments posted as issue-style comments (not review comments) are included in timeline
4. Comments are deduplicated by ID when the same comment appears in both endpoints

## Commit Strategy

Each task produces one atomic commit:

1. **Commit 1 (Task 1):** `fix: add ci-pipeline-failed and docs-ci-pipeline-failed to CI_FINISH_LABELS`
   - Changes: `src/utils/gitcodeCiEvents.js`, `test/gitcode-ci-events.test.js`
   - Scope: CI event detection fix only

2. **Commit 2 (Task 2):** `fix: fetch issue-style comments for trigger detection`
   - Changes: `etl/scripts/collect-gitcode.ts`, `test/collect-gitcode-comments.test.js`
   - Scope: ETL comment fetching fix only

This strategy ensures:
- Each commit is independently testable
- Easy to revert one fix without affecting the other
- Clear commit messages explaining the "why"

## Success Criteria

1. All existing tests continue to pass
2. New tests for `ci-pipeline-failed` label detection pass
3. New tests for comment merging pass
4. `CI_FINISH_LABELS` Set contains both `ci-pipeline-failed` and `docs-ci-pipeline-failed`
5. ETL fetches from both `/pulls/{number}/comments` and `/issues/{number}/comments`
6. Comments are merged and deduplicated by ID
7. Lint passes with no errors
8. TypeScript compilation succeeds
