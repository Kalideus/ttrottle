import test from 'node:test';
import assert from 'node:assert/strict';
import { handle, extractMentions } from './mentions.ts';

const users = [
  { id: 'cornish', name: 'Tom Cornish' },
  { id: 'adams', name: 'Tom Adams' },
  { id: 'raveen', name: 'Raveen' },
];

test('a handle is the first name plus a last initial, when there is one', () => {
  assert.equal(handle('Tom Cornish'), 'TomC');
  assert.equal(handle('Raveen'), 'Raveen');
  assert.equal(handle('Tom (Marketing)'), 'Tom');
});

test('the initial picks between people who share a first name', () => {
  assert.deepEqual(extractMentions('ask @TomA and @raveen', users), ['adams', 'raveen']);
});

test('a bare first name still works and goes to the first match', () => {
  assert.deepEqual(extractMentions('@Tom please look', users), ['cornish']);
});

test('an email address or unknown name mentions nobody', () => {
  assert.deepEqual(extractMentions('mail tom@example.com or @nobody', users), []);
});
