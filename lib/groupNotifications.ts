// Inbox grouping: every notification about the same task collapses into one row, however far apart they
// arrived, so a task is one line to open and tick off. Input and each group stay newest-first; groups are
// ordered by their newest.
export function groupNotifications<T extends { taskId?: string | null }>(items: T[]): T[][] {
  const groups: T[][] = [];
  const byTask = new Map<string, T[]>();
  for (const n of items) {
    const g = n.taskId ? byTask.get(n.taskId) : undefined;
    if (g) {
      g.push(n);
      continue;
    }
    const fresh = [n];
    groups.push(fresh);
    if (n.taskId) byTask.set(n.taskId, fresh);
  }
  return groups;
}
