import { Task } from '@/src/lib/types';

export type FilterType =
  | 'priority:high'
  | 'priority:medium'
  | 'priority:low'
  | 'no-due-date'
  | 'overdue'
  | 'completed'
  | 'incomplete';

export type SortField = 'due_date' | 'priority' | 'name' | 'created_at';
export type SortDirection = 'asc' | 'desc';

export function filterTasks(tasks: Task[], filters: FilterType[]): Task[] {
  if (filters.length === 0) return tasks;

  return tasks.filter((task) => {
    return filters.every((filter) => {
      switch (filter) {
        case 'priority:high':
          return task.priority === 'high';
        case 'priority:medium':
          return task.priority === 'medium';
        case 'priority:low':
          return task.priority === 'low';
        case 'no-due-date':
          return !task.dueDate;
        case 'overdue':
          return task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
        case 'completed':
          return task.completed;
        case 'incomplete':
          return !task.completed;
        default:
          return true;
      }
    });
  });
}

export function sortTasks(
  tasks: Task[],
  field: SortField,
  direction: SortDirection = 'asc'
): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (field) {
      case 'due_date':
        aVal = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        bVal = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        break;
      case 'priority':
        const priorityOrder = { high: 0, medium: 1, low: 2, null: 3 };
        aVal = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3;
        bVal = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3;
        break;
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'created_at':
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  if (!query.trim()) return tasks;

  const lowerQuery = query.toLowerCase();
  return tasks.filter(
    (task) =>
      task.name.toLowerCase().includes(lowerQuery) ||
      task.description?.toLowerCase().includes(lowerQuery)
  );
}

export function getTaskStats(tasks: Task[]) {
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.completed).length,
    incomplete: tasks.filter((t) => !t.completed).length,
    overdue: tasks.filter(
      (t) =>
        !t.completed &&
        t.dueDate &&
        new Date(t.dueDate) < new Date()
    ).length,
    highPriority: tasks.filter((t) => t.priority === 'high' && !t.completed).length,
  };
}
