// Performance dashboard numbers. One pass over a set of tasks (the caller picks whose: a person, a project,
// a team) for a rolling window ending at `now`. Passing an earlier `now` gives that week's figures for a trend.
//   * Core KPI: flagged 🎯 by someone other than the assignee (migration 043). All work: everything assigned.
//   * Each task gets a deadline: the end of its due date (extensions already moved it), or for a turnaround
//     project (Tech) its start plus the priority's target in working days. No deadline, no on-time verdict.
//   * Assigned/completed is a cohort: of the tasks started in the window, how many are done.
//     Pending and overdue are a snapshot at `now`, whatever the window.
//   * On time: of the tasks completed in the window with a deadline. Achievement: of the tasks whose deadline
//     fell in the window, how many were done by it, so one still open past its deadline is a miss.
//   * Deleted tasks are the caller's to leave out.
import type { Task } from '@/lib/supabase/queries';

export type KpiTask = Pick<Task, 'id' | 'name' | 'project_id' | 'assignee_id' | 'created_by' | 'created_at' | 'completed' | 'completed_at' | 'due_date' | 'priority' | 'kpi' | 'kpi_by' | 'kpi_at' | 'first_assigned_at' | 'ticket_by'>;

export type KpiBucket = 'assigned' | 'completed' | 'pending' | 'overdue' | 'onTime' | 'late' | 'extended' | 'achieved' | 'missed' | 'selfCreated' | 'tickets';
const BUCKETS: KpiBucket[] = ['assigned', 'completed', 'pending', 'overdue', 'onTime', 'late', 'extended', 'achieved', 'missed', 'selfCreated', 'tickets'];

export type KpiStats = {
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number | null; // completed / assigned, 0..1
  onTime: { hit: number; of: number; extended: number }; // extended: on time thanks to an approved extension
  achievement: { hit: number; of: number };
  medianDays: number | null; // turnaround projects: working days from start to done
  selfCreated: number;
  tickets: number;
  // which tasks make up each number, for the drill-down list
  ids: Record<KpiBucket, string[]>;
};

export type KpiContext = {
  now: Date;
  days: number; // 30 or 90
  turnaround: Set<string>; // project ids with kpi_type 'turnaround'
  extended: { has(id: string): boolean }; // task ids with an approved extension request
};

// working days to close, by priority; no priority, no target
export const TURNAROUND_TARGET_DAYS: Record<string, number> = { high: 1, medium: 3, low: 5 };

const DAY = 86_400_000;
const nextMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

// working days (Mon-Fri, local time) between two moments, as a fraction
export function workingDaysBetween(a: Date, b: Date): number {
  let ms = 0;
  for (let cur = a; cur < b; ) {
    const end = new Date(Math.min(nextMidnight(cur).getTime(), b.getTime()));
    if (!isWeekend(cur)) ms += end.getTime() - cur.getTime();
    cur = end;
  }
  return ms / DAY;
}

export function addWorkingDays(start: Date, days: number): Date {
  let left = days * DAY;
  for (let cur = start; ; ) {
    const next = nextMidnight(cur);
    if (!isWeekend(cur)) {
      if (next.getTime() - cur.getTime() >= left) return new Date(cur.getTime() + left);
      left -= next.getTime() - cur.getTime();
    }
    cur = next;
  }
}

// 'YYYY-MM-DD' -> the midnight that ends that day, local time
const endOfDay = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d + 1);
};

export const isCoreKpi = (t: KpiTask) => !!t.kpi && !!t.assignee_id && !!t.kpi_by && t.kpi_by !== t.assignee_id;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const rate = (hit: number, of: number) => (of ? hit / of : null);

function stats(tasks: KpiTask[], ctx: KpiContext, core: boolean): KpiStats {
  const s: KpiStats = { assigned: 0, completed: 0, pending: 0, overdue: 0, completionRate: null, onTime: { hit: 0, of: 0, extended: 0 }, achievement: { hit: 0, of: 0 }, medianDays: null, selfCreated: 0, tickets: 0, ids: Object.fromEntries(BUCKETS.map((b) => [b, []])) as unknown as KpiStats['ids'] };
  const now = ctx.now;
  const from = new Date(now.getTime() - ctx.days * DAY);
  const inWindow = (d: Date) => d > from && d <= now;
  const turnarounds: number[] = [];

  for (const t of tasks) {
    if (!t.assignee_id || (core && !isCoreKpi(t))) continue;
    const startIso = core ? t.kpi_at : t.first_assigned_at ?? t.kpi_at ?? t.created_at;
    if (!startIso) continue;
    const start = new Date(startIso);
    if (start > now) continue; // not given out yet at `now`

    const turnaround = ctx.turnaround.has(t.project_id);
    const target = t.priority ? TURNAROUND_TARGET_DAYS[t.priority] : undefined;
    const deadline = turnaround ? (target ? addWorkingDays(start, target) : null) : t.due_date ? endOfDay(t.due_date) : null;
    const doneAt = t.completed_at ? new Date(t.completed_at) : null;
    // done with no completed_at (older rows): counts as done, but has no date to judge on time by
    const done = doneAt ? doneAt <= now : t.completed;

    if (inWindow(start)) {
      s.assigned++;
      s.ids.assigned.push(t.id);
      if (done) {
        s.completed++;
        s.ids.completed.push(t.id);
      }
      if (t.created_by === t.assignee_id) {
        s.selfCreated++;
        s.ids.selfCreated.push(t.id);
      }
      if (t.ticket_by) {
        s.tickets++;
        s.ids.tickets.push(t.id);
      }
    }
    if (!done) {
      const late = !!deadline && deadline <= now;
      s[late ? 'overdue' : 'pending']++;
      s.ids[late ? 'overdue' : 'pending'].push(t.id);
    }
    if (done && doneAt && inWindow(doneAt)) {
      if (deadline) {
        s.onTime.of++;
        if (doneAt <= deadline) {
          s.onTime.hit++;
          s.ids.onTime.push(t.id);
          if (ctx.extended.has(t.id)) {
            s.onTime.extended++;
            s.ids.extended.push(t.id);
          }
        } else s.ids.late.push(t.id);
      }
      if (turnaround) turnarounds.push(workingDaysBetween(start, doneAt));
    }
    if (deadline && inWindow(deadline)) {
      s.achievement.of++;
      const hit = done && (!doneAt || doneAt <= deadline);
      if (hit) s.achievement.hit++;
      s.ids[hit ? 'achieved' : 'missed'].push(t.id);
    }
  }
  s.completionRate = rate(s.completed, s.assigned);
  s.medianDays = median(turnarounds);
  return s;
}

export function computeKpi(tasks: KpiTask[], ctx: KpiContext): { core: KpiStats; all: KpiStats } {
  return { core: stats(tasks, ctx, true), all: stats(tasks, ctx, false) };
}

// Tech tickets waiting to be handed out: a team number, not anyone's personal score
export function ticketWait(tasks: KpiTask[], ctx: KpiContext) {
  const from = new Date(ctx.now.getTime() - ctx.days * DAY);
  const waits: number[] = [];
  let unassigned = 0;
  let oldestDays: number | null = null;
  for (const t of tasks) {
    if (!t.ticket_by || !ctx.turnaround.has(t.project_id)) continue;
    const raised = new Date(t.created_at);
    if (raised > ctx.now) continue;
    const given = t.first_assigned_at ? new Date(t.first_assigned_at) : null;
    if (given && given > from && given <= ctx.now) waits.push(workingDaysBetween(raised, given));
    if (!t.assignee_id && !t.completed) {
      unassigned++;
      const waited = workingDaysBetween(raised, ctx.now);
      oldestDays = Math.max(oldestDays ?? 0, waited);
    }
  }
  return { medianDays: median(waits), handedOut: waits.length, unassigned, oldestDays };
}

// One figure per week for the last `weeks` weeks, oldest first: the rolling window as it stood at the end of
// each week, so the line moves the way the headline number did.
export function weeklyTrend(tasks: KpiTask[], ctx: KpiContext, value: (s: { core: KpiStats; all: KpiStats }) => number | null, weeks = 12): (number | null)[] {
  return Array.from({ length: weeks }, (_, i) => value(computeKpi(tasks, { ...ctx, now: new Date(ctx.now.getTime() - (weeks - 1 - i) * 7 * DAY) })));
}
