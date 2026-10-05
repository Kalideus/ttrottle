// Inbox rows: everything on the same task that happened within a few minutes (comments, mentions, edits...)
// collapses into one row, so a burst of activity reads as one line instead of ten. A group keeps growing
// while each next-older notification is within the window of the oldest one already in it, so a steady
// back-and-forth chains together. Input and each group stay newest-first; groups are ordered by their newest.
export const GROUP_WINDOW_MS = 3 * 60 * 1000;

export function groupNotifications<T extends { taskId?: string | null; createdAt: string }>(items: T[]): T[][] {
  const groups: T[][] = [];
  const open = new Map<string, T[]>(); // taskId -> the group still accepting older items
  for (const n of items) {
    const g = n.taskId ? open.get(n.taskId) : undefined;
    const oldest = g?.[g.length - 1];
    if (g && oldest && new Date(oldest.createdAt).getTime() - new Date(n.createdAt).getTime() <= GROUP_WINDOW_MS) {
      g.push(n);
      continue;
    }
    const fresh = [n];
    groups.push(fresh);
    if (n.taskId) open.set(n.taskId, fresh);
  }
  return groups;
}
