// Run: node lib/avatar.check.ts
// The picker's colours and the database's random sign-up colour must be the same list.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AVATAR_COLORS } from './avatar.ts';

const sqlColors = (file: string) => {
  const sql = readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
  const fn = sql.slice(sql.indexOf('function random_avatar_color()'), sql.indexOf('$$;', sql.indexOf('function random_avatar_color()')));
  return fn.match(/#[0-9A-F]{6}/gi) ?? [];
};

assert.equal(new Set(AVATAR_COLORS).size, 20, 'twenty different colours');
assert.deepEqual(sqlColors('migrations/048_twenty_avatar_colors.sql'), AVATAR_COLORS);
assert.deepEqual(sqlColors('schema.sql'), AVATAR_COLORS);
// random() * 20 must match the list length, or some colours are never picked
assert.match(readFileSync(new URL('../db/migrations/048_twenty_avatar_colors.sql', import.meta.url), 'utf8'), new RegExp(`random\\(\\) \\* ${AVATAR_COLORS.length} \\+ 1`));
console.log('avatar colours ok');
