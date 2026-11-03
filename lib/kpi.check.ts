// Run: node lib/kpi.check.ts
import assert from 'node:assert/strict';
import { computeKpi, ticketWait, weeklyTrend, workSplit, workingDaysBetween, addWorkingDays, type KpiTask } from './kpi.ts';

// local time, like the app; November 2026: Fri 30 Oct, Sat 31, Sun 1 Nov, Mon 2, Tue 3, Wed 4
const at = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour);
const iso = (month: number, day: number, hour = 12) => at(month, day, hour).toISOString();
const now = at(11, 4, 12);

let n = 0;
const task = (t: Partial<KpiTask>): KpiTask => ({
  id: `t${n++}`, name: 'task', project_id: 'cx', assignee_id: 'u', created_by: 'm', created_at: iso(10, 20), completed: false,
  completed_at: null, due_date: null, priority: null, kpi: true, kpi_by: 'm', kpi_at: iso(10, 20), first_assigned_at: null, ticket_by: null, ...t,
});
const done = (month: number, day: number, hour = 12) => ({ completed: true, completed_at: iso(month, day, hour) });

// working days skip the weekend
assert.equal(workingDaysBetween(at(10, 30, 9), at(11, 2, 9)), 1);
assert.deepEqual(addWorkingDays(at(10, 30, 9), 1), at(11, 2, 9));
assert.deepEqual(addWorkingDays(at(10, 31, 10), 1), at(11, 3, 0)); // raised on Saturday: all of Monday

const extendedTask = task({ due_date: '2026-10-31', ...done(10, 31) });
const cx = [
  task({ due_date: '2026-10-30', ...done(10, 30, 15) }), // on time, late in the day
  task({ due_date: '2026-10-28', ...done(10, 29) }), // late
  task({ due_date: '2026-11-01' }), // open past its date: overdue, a missed achievement
  task({ due_date: '2026-11-10' }), // open, not due yet
  extendedTask, // on time thanks to an extension
  task({ ...done(10, 26) }), // no due date: done, but no on-time verdict
  task({ kpi: false, kpi_by: null, kpi_at: null, created_by: 'u', created_at: iso(10, 24), due_date: '2026-10-25', ...done(10, 24) }), // self-made
  task({ kpi_by: 'u', created_by: 'u' }), // a manager's own task: never core
];
const ctx = { now, days: 30, turnaround: new Set(['tech']), extended: new Set([extendedTask.id]) };
const { core, all } = computeKpi(cx, ctx);

assert.equal(core.assigned, 6);
assert.equal(core.completed, 4);
assert.equal(core.pending, 1);
assert.equal(core.overdue, 1);
assert.equal(core.completionRate, 4 / 6);
assert.deepEqual(core.onTime, { hit: 2, of: 3, extended: 1 });
assert.deepEqual(core.achievement, { hit: 2, of: 4 });
assert.equal(core.selfCreated, 0);
// each number lists its tasks: the overdue one, the late one, and the misses (late + still open)
assert.deepEqual(core.ids.overdue, [cx[2].id]);
assert.deepEqual(core.ids.late, [cx[1].id]);
assert.deepEqual(core.ids.missed, [cx[1].id, cx[2].id]);
assert.deepEqual(core.ids.extended, [extendedTask.id]);
assert.equal(core.ids.assigned.length, core.assigned);

assert.equal(all.assigned, 8);
assert.equal(all.completed, 5);
assert.equal(all.selfCreated, 2);
assert.deepEqual(all.onTime, { hit: 3, of: 4, extended: 1 });

// the work split: every assigned task in exactly one part
const split = workSplit(core);
assert.deepEqual(split, { onTime: [cx[0].id, extendedTask.id], done: [cx[5].id], late: [cx[1].id], overdue: [cx[2].id], open: [cx[3].id] });
assert.equal(Object.values(workSplit(all)).flat().length, all.assigned);

// a week earlier: the 30 Oct task was still open and not yet due, the 1 Nov one not yet late
const before = computeKpi(cx, { ...ctx, now: at(10, 28, 12) }).core;
assert.equal(before.overdue, 0);
assert.equal(before.completed, 1);

// Tech: the clock starts when a manager hands it out, targets in working days by priority
const tech = [
  task({ project_id: 'tech', priority: 'high', kpi_at: iso(11, 2, 9), ...done(11, 3, 8), ticket_by: 'x' }), // inside 1 day
  task({ project_id: 'tech', priority: 'medium', kpi_at: iso(10, 30, 9) }), // 3 days ran out Wed 9:00
  task({ project_id: 'tech', priority: null, kpi_at: iso(11, 2, 9), ...done(11, 4, 9) }), // no target
];
const t = computeKpi(tech, ctx).core;
assert.deepEqual(t.onTime, { hit: 1, of: 1, extended: 0 });
assert.equal(t.overdue, 1);
assert.deepEqual(t.achievement, { hit: 1, of: 2 });
assert.equal(t.medianDays, (23 / 24 + 2) / 2); // 23h, and Mon 9:00 to Wed 9:00

// tickets waiting to be handed out
const wait = ticketWait([
  task({ project_id: 'tech', ticket_by: 'x', created_at: iso(10, 30, 9), first_assigned_at: iso(11, 2, 9) }),
  task({ project_id: 'tech', ticket_by: 'x', created_at: iso(11, 3, 12), assignee_id: null }),
  task({ project_id: 'cx', ticket_by: 'x', created_at: iso(10, 1), assignee_id: null }), // not Tech
], ctx);
assert.deepEqual(wait, { medianDays: 1, handedOut: 1, unassigned: 1, oldestDays: 1 });

// trend: one figure per week, oldest first; the last is today's
const overdueByWeek = weeklyTrend(cx, ctx, (s) => s.core.overdue, 3);
assert.equal(overdueByWeek.length, 3);
assert.equal(overdueByWeek[2], core.overdue);
assert.equal(overdueByWeek[1], before.overdue);

console.log('kpi ok');
