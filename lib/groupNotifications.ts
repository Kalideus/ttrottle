// Inbox rows: back-to-back "updated" notifications for the same task collapse into one row, so five quick
// edits read as one line instead of five. Input and each group stay newest-first. Comments, mentions,
// assignments etc. always get their own row, and any other notification in between starts a new group.
export function groupNotifications<T extends { type: string; taskId?: string | null }>(items: T[]): T[][] {
  const groups: T[][] = [];
  for (const n of items) {
    const last = groups[groups.length - 1];
    const head = last?.[0];
    if (head && n.type === 'updated' && head.type === 'updated' && n.taskId && n.taskId === head.taskId) last.push(n);
    else groups.push([n]);
  }
  return groups;
}
