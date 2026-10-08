import test from 'node:test';
import assert from 'node:assert/strict';
import { isOverdue, localYmd } from './dates.ts';

test('a task is overdue only once its due day is over', () => {
  assert.equal(isOverdue(localYmd(-1)), true);
  assert.equal(isOverdue(localYmd(0)), false); // due today is not late yet
  assert.equal(isOverdue(localYmd(1)), false);
});

test('completed or undated tasks are never overdue', () => {
  assert.equal(isOverdue(localYmd(-1), true), false);
  assert.equal(isOverdue(null), false);
});
