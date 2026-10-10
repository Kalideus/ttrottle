import test from 'node:test';
import assert from 'node:assert/strict';
import { filterKinds } from './filterKinds.ts';

test('filters of one kind share a group, other kinds get their own', () => {
  assert.deepEqual(filterKinds(['priority:high', 'overdue', 'priority:low', 'tag:abc', 'no-due-date', 'created-7d']), [
    ['priority:high', 'priority:low'],
    ['overdue', 'no-due-date'],
    ['tag:abc'],
    ['created-7d'],
  ]);
});
