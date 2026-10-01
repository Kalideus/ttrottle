import test from 'node:test';
import assert from 'node:assert/strict';
import { groupNotifications } from './groupNotifications.ts';

const n = (id, type, taskId) => ({ id, type, taskId });
const ids = (groups) => groups.map((g) => g.map((x) => x.id));

test('back-to-back updates to one task become one row', () => {
  const rows = groupNotifications([n(1, 'updated', 'a'), n(2, 'updated', 'a'), n(3, 'updated', 'a')]);
  assert.deepEqual(ids(rows), [[1, 2, 3]]);
});

test('other tasks, other types and interruptions stay separate', () => {
  const rows = groupNotifications([
    n(1, 'updated', 'a'),
    n(2, 'updated', 'b'), // different task
    n(3, 'comment', 'b'), // comments never group
    n(4, 'comment', 'b'),
    n(5, 'updated', 'a'), // same task as #1 but not adjacent
    n(6, 'updated', null), // no task: nothing to group on
    n(7, 'updated', null),
  ]);
  assert.deepEqual(ids(rows), [[1], [2], [3], [4], [5], [6], [7]]);
});
