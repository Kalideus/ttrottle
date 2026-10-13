// Run: node lib/groupNotifications.check.ts
import assert from 'node:assert/strict';
import { groupNotifications } from './groupNotifications.ts';

const at = (min: number) => new Date(Date.UTC(2026, 9, 5, 12, min)).toISOString();
const ids = (gs: { id: string }[][]) => gs.map((g) => g.map((n) => n.id).join(','));

// newest first: a and c on task 1 go together around b (other task); the row sits where its newest is
assert.deepEqual(ids(groupNotifications([
  { id: 'a', taskId: 't1', createdAt: at(10) },
  { id: 'b', taskId: 't2', createdAt: at(9) },
  { id: 'c', taskId: 't1', createdAt: at(8) },
])), ['a,c', 'b']);

// however far apart: one task is one row
assert.deepEqual(ids(groupNotifications([
  { id: 'a', taskId: 't1', createdAt: at(50) },
  { id: 'b', taskId: 't1', createdAt: at(18) },
  { id: 'c', taskId: 't1', createdAt: at(0) },
])), ['a,b,c']);

// no task -> never grouped
assert.deepEqual(ids(groupNotifications([
  { id: 'a', taskId: null, createdAt: at(1) },
  { id: 'b', taskId: null, createdAt: at(1) },
])), ['a', 'b']);

console.log('groupNotifications ok');
