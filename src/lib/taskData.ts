import { businessToday } from './time';
import { supabase } from './supabaseClient';

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: string;
  target: string;
  archived: boolean;
};

export type TaskRecord = {
  id: string;
  project_id: string;
  project: string;
  title: string;
  description: string;
  assignee: string;
  status: string;
  priority: string;
  due_date: string;
  level: 1 | 2;
  parent_task_id: string | null;
  parent_title?: string;
};

export type DashboardStats = {
  myTasksToday: number;
  companyOverdue: number;
  dueThisWeek: number;
  activeProjects: number;
};

const fallbackProjects: ProjectRecord[] = [
  { id: 'fleet', name: 'Fleet Ops', description: 'Operational maintenance and readiness tracking for the active TTR fleet.', owner: 'Ayesha', status: 'Active', target: '2026-09-12', archived: false },
  { id: 'safety', name: 'Safety', description: 'Driver compliance, incident follow-up, and safety review tasks.', owner: 'Nimal', status: 'On Hold', target: '2026-09-02', archived: false },
  { id: 'ops', name: 'Operations Refresh', description: 'Operational planning and process refresh initiative.', owner: 'Saman', status: 'Completed', target: '2026-08-15', archived: false },
  { id: 'archive-1', name: 'Driver Training Archive', description: 'Archived training and onboarding follow-up work.', owner: 'Ayesha', status: 'Archived', target: '2026-06-30', archived: true },
];

const fallbackTasks: TaskRecord[] = [
  { id: 't1', project_id: 'fleet', project: 'Fleet Ops', title: 'Confirm vehicle inspection checklist', description: 'Verify the inspection report, check expired approvals, and confirm all outstanding issues are escalated before the next dispatch cycle.', assignee: 'You', status: 'In Progress', priority: 'High', due_date: '2026-08-28', level: 1, parent_task_id: null },
  { id: 't2', project_id: 'safety', project: 'Safety', title: 'Review driver incident follow-up', description: 'Check the incident log and ensure the corrective action is documented and reviewed by safety lead.', assignee: 'You', status: 'Waiting', priority: 'Urgent', due_date: '2026-08-29', level: 1, parent_task_id: null },
  { id: 't3', project_id: 'ops', project: 'Operations', title: 'Upload monthly maintenance summary', description: 'Upload the latest maintenance report to the shared folder and confirm the summary is visible to operations.', assignee: 'You', status: 'Not Started', priority: 'Normal', due_date: '2026-08-31', level: 1, parent_task_id: null },
  { id: 'p1', project_id: 'fleet', project: 'Fleet Ops', title: 'Vehicle inspection checklist', description: 'Complete the full inspection and record any maintenance issues for the current vehicle batch.', assignee: 'Ayesha', status: 'In Progress', priority: 'High', due_date: '2026-08-28', level: 2, parent_task_id: 't1', parent_title: 'Confirm vehicle inspection checklist' },
  { id: 's1', project_id: 'safety', project: 'Safety', title: 'Review incident follow-up docs', description: 'Review docs linked to the incident and confirm the final response is logged correctly.', assignee: 'Nimal', status: 'Waiting', priority: 'High', due_date: '2026-08-29', level: 2, parent_task_id: 't2', parent_title: 'Review driver incident follow-up' },
];

const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
);

function mapProject(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? 'Untitled'),
    description: String(row.description ?? ''),
    owner: String(row.owner ?? row.owner_id ?? 'Unknown'),
    status: String(row.status ?? 'Not Started'),
    target: row.target_date ? String(row.target_date) : row.target ? String(row.target) : 'TBD',
    archived: Boolean(row.archived ?? false),
  };
}

function mapTask(row: Record<string, unknown>): TaskRecord {
  const parentTaskId = row.parent_task_id == null ? null : String(row.parent_task_id);
  const parentName = row.parent_title ? String(row.parent_title) : undefined;

  return {
    id: String(row.id ?? ''),
    project_id: String(row.project_id ?? ''),
    project: String(row.project ?? row.project_name ?? 'Unknown Project'),
    title: String(row.title ?? 'Untitled task'),
    description: String(row.description ?? ''),
    assignee: String(row.assignee ?? row.assignee_id ?? 'Unassigned'),
    status: String(row.status ?? 'Not Started'),
    priority: String(row.priority ?? 'Normal'),
    due_date: row.due_date ? String(row.due_date) : 'TBD',
    level: (Number(row.level) === 2 ? 2 : 1) as 1 | 2,
    parent_task_id: parentTaskId,
    parent_title: parentName,
  };
}

function withProjectNames(tasks: TaskRecord[], projects: ProjectRecord[]): TaskRecord[] {
  const projectLookup = new Map(projects.map((project) => [project.id, project.name]));

  return tasks.map((task) => {
    const resolvedProjectName = task.project_id ? projectLookup.get(task.project_id) ?? task.project : task.project;
    return { ...task, project: resolvedProjectName ?? 'Unknown Project' };
  });
}

export async function fetchProjects(): Promise<ProjectRecord[]> {
  if (!hasSupabaseConfig) return fallbackProjects;

  try {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapProject(row as Record<string, unknown>));
  } catch {
    return fallbackProjects;
  }
}

export async function fetchTasks(): Promise<TaskRecord[]> {
  if (!hasSupabaseConfig) return fallbackTasks;

  try {
    const [projectResult, taskResult] = await Promise.all([
      fetchProjects(),
      supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false }),
    ]);

    if (taskResult.error) throw taskResult.error;
    return withProjectNames(
      (taskResult.data ?? []).map((row) => mapTask(row as Record<string, unknown>)),
      projectResult,
    );
  } catch {
    return fallbackTasks;
  }
}

export async function fetchProjectById(projectId: string): Promise<ProjectRecord | null> {
  if (!hasSupabaseConfig) {
    const projects = await fetchProjects();
    return projects.find((project) => project.id === projectId) ?? null;
  }

  try {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    if (error) throw error;
    return data ? mapProject(data as Record<string, unknown>) : null;
  } catch {
    const projects = await fetchProjects();
    return projects.find((project) => project.id === projectId) ?? null;
  }
}

export async function fetchTaskById(taskId: string): Promise<TaskRecord | null> {
  if (!hasSupabaseConfig) {
    const tasks = await fetchTasks();
    return tasks.find((task) => task.id === taskId) ?? null;
  }

  try {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const projects = await fetchProjects();
    return withProjectNames([mapTask(data as Record<string, unknown>)], projects)[0] ?? null;
  } catch {
    const tasks = await fetchTasks();
    return tasks.find((task) => task.id === taskId) ?? null;
  }
}

export async function fetchTasksByProject(projectId: string): Promise<TaskRecord[]> {
  if (!hasSupabaseConfig) {
    const tasks = await fetchTasks();
    return tasks.filter((task) => task.project_id === projectId);
  }

  try {
    const [projectResult, taskResult] = await Promise.all([
      fetchProjects(),
      supabase.from('tasks').select('*').eq('project_id', projectId).order('due_date', { ascending: true, nullsFirst: false }),
    ]);

    if (taskResult.error) throw taskResult.error;
    return withProjectNames(
      (taskResult.data ?? []).map((row) => mapTask(row as Record<string, unknown>)),
      projectResult,
    );
  } catch {
    const tasks = await fetchTasks();
    return tasks.filter((task) => task.project_id === projectId);
  }
}

export async function createTask(task: {
  title: string;
  project_id: string;
  description?: string;
  assignee?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  parent_task_id?: string | null;
}) {
  if (!hasSupabaseConfig) {
    return {
      id: `task-${Date.now()}`,
      ...task,
      level: task.parent_task_id ? 2 : 1,
      project: task.project_id,
    };
  }

  const payload = {
    title: task.title,
    project_id: task.project_id,
    description: task.description ?? '',
    assignee_id: task.assignee ?? null,
    status: task.status ?? 'Not Started',
    priority: task.priority ?? 'Normal',
    due_date: task.due_date ?? null,
    parent_task_id: task.parent_task_id ?? null,
    created_by: null,
  };

  const { data, error } = await supabase.from('tasks').insert(payload).select('*').single();

  if (error) {
    throw error;
  }

  const projects = await fetchProjects();
  return { ...(data as Record<string, unknown>), project: projects.find((project) => project.id === task.project_id)?.name ?? 'Unknown Project' };
}

export async function updateTask(taskId: string, updates: Partial<Pick<TaskRecord, 'title' | 'description' | 'status' | 'priority' | 'due_date' | 'parent_task_id'>>) {
  if (!hasSupabaseConfig) {
    return { id: taskId, ...updates };
  }

  const payload = {
    title: updates.title,
    description: updates.description,
    status: updates.status,
    priority: updates.priority,
    due_date: updates.due_date,
    parent_task_id: updates.parent_task_id,
  };

  const { data, error } = await supabase.from('tasks').update(payload).eq('id', taskId).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string) {
  if (!hasSupabaseConfig) {
    return { id: taskId };
  }

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
  return { id: taskId };
}

function parseDateOnly(dateValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getDashboardStats(tasks: TaskRecord[], projects: ProjectRecord[]): DashboardStats {
  const todayKey = businessToday();
  const today = parseDateOnly(todayKey);
  const nextWeek = new Date(today);
  nextWeek.setUTCDate(today.getUTCDate() + 7);

  const myTasksToday = tasks.filter((task) => task.status !== 'Completed' && task.due_date && task.due_date === todayKey).length;
  const companyOverdue = tasks.filter((task) => task.status !== 'Completed' && task.due_date && parseDateOnly(task.due_date) < today).length;
  const dueThisWeek = tasks.filter((task) => task.status !== 'Completed' && task.due_date && parseDateOnly(task.due_date) >= today && parseDateOnly(task.due_date) <= nextWeek).length;
  const activeProjects = projects.filter((project) => !project.archived && project.status !== 'Completed').length;

  return {
    myTasksToday,
    companyOverdue,
    dueThisWeek,
    activeProjects,
  };
}

export const dashboardSeed = {
  projects: fallbackProjects,
  tasks: fallbackTasks,
};
