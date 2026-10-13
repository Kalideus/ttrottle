// Run: node lib/taskFiles.check.ts
import assert from 'node:assert/strict';
import { FILE_PATTERN, fileExt, fileToken, filesAsText, parseFileToken } from './taskFiles.ts';

const path = '11111111-2222-3333-4444-555555555555/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf';
const whole = new RegExp(`^${FILE_PATTERN}$`);

// only what can be attached, whatever the capitals
assert.equal(fileExt('Report.PDF'), 'pdf');
assert.equal(fileExt('budget.final.xlsx'), 'xlsx');
assert.equal(fileExt('virus.exe'), null);
assert.equal(fileExt('pdf'), null);
assert.equal(fileExt('toString'), null);

// a token survives the round trip, name and path intact
const token = fileToken('Q3 report (final).pdf', path);
assert.match(token, whole);
assert.deepEqual(parseFileToken(token), { name: 'Q3 report (final).pdf', path });

// a name with brackets or a line break can't end the token early
const odd = fileToken('notes [v2]\n.pdf', path);
assert.match(odd, whole);
assert.equal(parseFileToken(odd).path, path);

// never a path outside the bucket's task/file shape, nor another type
assert.doesNotMatch('[file:x.pdf](https://evil.example/x.pdf)', whole);
assert.doesNotMatch(`[file:x](task-photo:${path.replace('.pdf', '.exe')})`, whole);

assert.equal(filesAsText(`see ${token} please`), 'see [file: Q3 report (final).pdf] please');

console.log('taskFiles ok');
