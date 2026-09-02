import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addInterval, getNextDueDates, LEAD_DAYS } from './recurrence.ts';

test('addDays adds calendar days without timezone drift', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-02-28', 7), '2026-03-07');
});

test('addInterval handles weekly and monthly steps', () => {
  assert.equal(addInterval('2026-01-01', 'weekly', 2), '2026-01-15');
  assert.equal(addInterval('2026-01-31', 'monthly', 1), '2026-02-28');
});

test('getNextDueDates returns a bounded recurring series', () => {
  const dates = getNextDueDates({
    anchorDate: '2026-08-28',
    frequency: 'weekly',
    intervalCount: 1,
    leadDays: 7,
  }, '2026-08-28');

  assert.deepEqual(dates, ['2026-08-28', '2026-09-04']);
  assert.ok(LEAD_DAYS >= 7);
});
