const DAY_MS = 86400000;

// Local-time YYYY-MM-DD, `plusDays` from today (due_date is a plain date, so compare as strings).
export function localYmd(plusDays = 0) {
  const d = new Date(Date.now() + plusDays * DAY_MS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Overdue = the due day is over where the user is. Not `new Date(due) < new Date()`: that reads the
// date as midnight UTC, which makes a task due today look late for most of the day.
export function isOverdue(dueDate: string | null | undefined, completed?: boolean) {
  return !!dueDate && !completed && dueDate.slice(0, 10) < localYmd();
}

// "8 Oct 2026" from a plain YYYY-MM-DD. Formatted in UTC, because that is how `new Date('2026-10-08')`
// reads it; in local time it would show the day before anywhere west of UTC.
export function formatDay(ymd: string, withYear = true) {
  return new Date(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }), timeZone: 'UTC' });
}
