// Run: node lib/groupNotifications.check.ts
import assert from 'node:assert/strict';
import { groupNotifications } from './groupNotifications.ts';

const at = (min: number) => new Date(Date.UTC(2026, 9, 5, 12, min)).toISOString();
const ids = (gs: { id: string }[][]) => gs.map((g) => g.map((n) => n.id).join(','));

// newest first: a, b (other task) and c within 3 min on task 1 -> a+c together, b alone
assert.deepEqual(ids(groupNotifications([
  { id: 'a', taskId: 't1', createdAt: at(10) },
  { id: 'b', taskId: 't2', createdAt: at(9) },
  { id: 'c', taskId: 't1', createdAt: at(8) },
])), ['a,c', 'b']);

// a gap over 3 minutes starts a new row; a chain of short gaps keeps going
assert.deepEqual(ids(groupNotifications([
  { id: 'a', taskId: 't1', createdAt: at(20) },
  { id: 'b', taskId: 't1', createdAt: at(18) },
  { id: 'c', taskId: 't1', createdAt: at(16) },
  { id: 'd', taskId: 't1', createdAt: at(10) },
])), ['a,b,c', 'd']);

// no task -> never grouped
assert.deepEqual(ids(groupNotifications([
  { id: 'a', taskId: null, createdAt: at(1) },
  { id: 'b', taskId: null, createdAt: at(1) },
])), ['a', 'b']);

console.log('groupNotifications ok');
