import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapEdit, listEdit, enterEdit } from './format.ts';

const apply = (v, ed) => v.slice(0, ed.start) + ed.text + v.slice(ed.end);

test('wrap toggles a mark around the selection, ignoring a trailing space', () => {
  const v = 'say hello there';
  const on = wrapEdit(v, 4, 10, '**');
  assert.equal(apply(v, on), 'say **hello** there');
  const off = wrapEdit(apply(v, on), on.selStart, on.selEnd, '**');
  assert.equal(apply(apply(v, on), off), v);
});

test('list toggles every selected line and numbers ordered lists', () => {
  const v = 'a\nb\nc';
  const ol = listEdit(v, 0, 3, 'ol');
  assert.equal(apply(v, ol), '1. a\n2. b\nc');
  assert.equal(apply('1. a\n2. b', listEdit('1. a\n2. b', 0, 9, 'ol')), 'a\nb');
  assert.equal(apply('1. a', listEdit('1. a', 2, 2, 'ul')), '- a');
});

test('enter continues a list, and ends it on an empty item', () => {
  assert.equal(apply('1. a', enterEdit('1. a', 4, 4)), '1. a\n2. ');
  assert.equal(apply('- a\n- ', enterEdit('- a\n- ', 6, 6)), '- a\n');
  assert.equal(enterEdit('plain', 5, 5), null);
});
