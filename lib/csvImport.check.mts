// Run: node lib/csvImport.check.mts
import assert from 'node:assert/strict'
import { parseCsv, guessMapping, parseDate, buildPlan, EXAMPLE_CSV } from './csvImport.ts'

assert.deepEqual(parseCsv('﻿a,b\r\n"x, ""y""","multi\nline"\r\n,\r\n'), [['a', 'b'], ['x, "y"', 'multi\nline']])
assert.deepEqual(parseCsv('a;b\n1;2,5'), [['a', 'b'], ['1', '2,5']])

assert.equal(parseDate('25/12/2026', 'dmy'), '2026-12-25')
assert.equal(parseDate('12/25/26', 'mdy'), '2026-12-25')
assert.equal(parseDate('2026-01-05', 'mdy'), '2026-01-05')
assert.equal(parseDate('31/02/2026', 'dmy'), null)

const [header, ...rows] = parseCsv(EXAMPLE_CSV)
const plan = buildPlan(rows, guessMapping(header), [{ id: 'u1', name: 'Tom', email: 'tom@example.com' }], 'dmy')
assert.deepEqual(plan.sections, ['Pre-Tournament Work', 'Hotels'])
assert.equal(plan.tasks.length, 2)
assert.equal(plan.tasks[0].assignee_id, 'u1')
assert.equal(plan.tasks[0].priority, 'high')
assert.equal(plan.tasks[0].subtasks?.[0].name, 'Book venue')
assert.equal(plan.tasks[1].completed, true)
assert.deepEqual(plan.warnings, [])

console.log('csvImport ok')
