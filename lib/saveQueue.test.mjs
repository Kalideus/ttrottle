import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveQueue } from './saveQueue.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('writes run in order, one at a time, and drain once with all keys', async () => {
  const log = [];
  const drains = [];
  const q = createSaveQueue((keys) => drains.push(keys.sort()), () => {});
  q.add(async () => { log.push('create:start'); await sleep(20); log.push('create:end'); }, ['tasks']);
  q.add(async () => { log.push('edit'); }, ['tasks', 'activity']);
  assert.equal(q.pending, 2);
  await q.add(async () => {}, ['headings']);
  assert.deepEqual(log, ['create:start', 'create:end', 'edit']);
  assert.deepEqual(drains, [['activity', 'headings', 'tasks']]);
  assert.equal(q.pending, 0);
});

test('a failed write is reported, later writes still run, and the drain still reloads', async () => {
  const errors = [];
  const drains = [];
  let ran = false;
  const q = createSaveQueue((keys) => drains.push(keys), (e) => errors.push(e.message));
  q.add(async () => { throw new Error('rls'); }, ['tasks']);
  await q.add(async () => { ran = true; });
  assert.deepEqual(errors, ['rls']);
  assert.ok(ran);
  assert.deepEqual(drains, [['tasks']]);
});
