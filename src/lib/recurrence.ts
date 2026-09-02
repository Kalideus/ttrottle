import { supabaseAdmin } from './supabaseClient';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'annually';

export const LEAD_DAYS = 7;

export type RecurrenceRecord = {
  id: string;
  project_id: string | null;
  level: 1 | 2;
  parent_task_id: string | null;
  parent_recurrence_id: string | null;
  title: string;
  description: string | null;
  assignee_id: string | null;
  priority: string | null;
  frequency: Frequency | null;
  interval_count: number | null;
  anchor_date: string | null;
  next_due_date: string | null;
  due_offset_days: number | null;
  active: boolean;
};

export function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toColomboDate(date: Date): string {
  const colomboDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Colombo' }));
  return toIsoDate(colomboDate);
}

export function addDays(value: string, days: number): string {
  const date = toDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function addInterval(value: string, frequency: Frequency, intervalCount: number): string {
  const date = toDate(value);

  if (frequency === 'daily') {
    date.setUTCDate(date.getUTCDate() + intervalCount);
    return toIsoDate(date);
  }

  if (frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + intervalCount * 7);
    return toIsoDate(date);
  }

  if (frequency === 'monthly') {
    const targetYear = date.getUTCFullYear();
    const targetMonth = date.getUTCMonth() + intervalCount;
    const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1));
    const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    const day = Math.min(date.getUTCDate(), lastDay);
    monthStart.setUTCDate(day);
    return toIsoDate(monthStart);
  }

  const next = new Date(Date.UTC(date.getUTCFullYear() + intervalCount, date.getUTCMonth(), date.getUTCDate()));
  return toIsoDate(next);
}

export function getNextDueDates(
  recurrence: {
    anchorDate: string;
    frequency: Frequency;
    intervalCount: number;
    leadDays?: number;
  },
  businessToday: string,
): string[] {
  const leadDays = recurrence.leadDays ?? LEAD_DAYS;
  const current = recurrence.anchorDate;
  const today = toDate(businessToday);
  const dates: string[] = [];
  let cursor = current;

  while (true) {
    const due = toDate(cursor);
    if (due.getTime() > today.getTime() + leadDays * 24 * 60 * 60 * 1000) {
      break;
    }

    dates.push(cursor);
    cursor = addInterval(cursor, recurrence.frequency, recurrence.intervalCount);
  }

  return dates;
}

export function getRecurringTaskPayload(template: {
  title: string;
  description?: string;
  assignee?: string;
  priority?: string;
  projectId: string;
  dueDate: string;
  parentTaskId?: string | null;
}) {
  return {
    title: template.title,
    description: template.description ?? '',
    assignee: template.assignee ?? 'Unassigned',
    priority: template.priority ?? 'Normal',
    project_id: template.projectId,
    due_date: template.dueDate,
    parent_task_id: template.parentTaskId ?? null,
    status: 'Not Started',
    level: template.parentTaskId ? 2 : 1,
  };
}

function isDateOnOrBefore(left: string, right: string): boolean {
  return toDate(left).getTime() <= toDate(right).getTime();
}

function getEffectiveProjectId(recurrence: RecurrenceRecord, fallbackProjectId?: string | null): string | null {
  if (recurrence.project_id) return recurrence.project_id;
  return fallbackProjectId ?? null;
}

export async function runRecurrenceGeneration() {
  if (!supabaseAdmin) {
    return {
      ok: true,
      businessToday: toColomboDate(new Date()),
      leadDays: LEAD_DAYS,
      generated: [],
      note: 'Supabase admin client is not configured; recurrence engine is in demo-only mode.',
    };
  }

  const businessToday = toColomboDate(new Date());
  const cutoffDate = addDays(businessToday, LEAD_DAYS);

  const { data: recurrences, error } = await supabaseAdmin
    .from('task_recurrences')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const generated: string[] = [];

  for (const recurrence of recurrences ?? []) {
    if (!recurrence.frequency || !recurrence.interval_count || !recurrence.next_due_date) {
      continue;
    }

    let cursor = recurrence.next_due_date;
    while (isDateOnOrBefore(cursor, cutoffDate)) {
      const parentProjectId = recurrence.parent_task_id
        ? (await supabaseAdmin.from('tasks').select('project_id').eq('id', recurrence.parent_task_id).maybeSingle())?.data?.project_id ?? null
        : null;

      const effectiveProjectId = getEffectiveProjectId(recurrence, parentProjectId) ?? recurrence.project_id;
      if (!effectiveProjectId) {
        break;
      }

      const insertedTaskResult = await supabaseAdmin
        .from('tasks')
        .insert({
          project_id: effectiveProjectId,
          parent_task_id: recurrence.parent_task_id ?? null,
          title: recurrence.title,
          description: recurrence.description ?? '',
          assignee_id: recurrence.assignee_id ?? null,
          status: 'Not Started',
          priority: recurrence.priority ?? 'Normal',
          due_date: cursor,
          recurrence_id: recurrence.id,
          created_by: null,
          level: recurrence.level,
        })
        .select('*')
        .single();

      if (insertedTaskResult.error) {
        throw insertedTaskResult.error;
      }

      generated.push(cursor);

      if (recurrence.level === 1) {
        const { data: childRecurrences, error: childError } = await supabaseAdmin
          .from('task_recurrences')
          .select('*')
          .eq('active', true)
          .eq('parent_recurrence_id', recurrence.id);

        if (childError) {
          throw childError;
        }

        for (const childRecurrence of childRecurrences ?? []) {
          const childDueDate = addDays(cursor, childRecurrence.due_offset_days ?? 0);
          if (!childDueDate) continue;

          const taskPayload = getRecurringTaskPayload({
            title: childRecurrence.title,
            description: childRecurrence.description ?? '',
            assignee: childRecurrence.assignee_id ?? 'Unassigned',
            priority: childRecurrence.priority ?? 'Normal',
            projectId: effectiveProjectId,
            dueDate: childDueDate,
            parentTaskId: insertedTaskResult.data.id,
          });

          const { error: childTaskError } = await supabaseAdmin.from('tasks').insert({
            ...taskPayload,
            recurrence_id: childRecurrence.id,
            created_by: null,
          });

          if (childTaskError) {
            throw childTaskError;
          }
        }
      }

      const nextDueDate = addInterval(cursor, recurrence.frequency, recurrence.interval_count);
      const { error: updateError } = await supabaseAdmin
        .from('task_recurrences')
        .update({ next_due_date: nextDueDate })
        .eq('id', recurrence.id);

      if (updateError) {
        throw updateError;
      }

      cursor = nextDueDate;
      if (cursor === '' || cursor > cutoffDate) {
        break;
      }
    }
  }

  return {
    ok: true,
    businessToday,
    leadDays: LEAD_DAYS,
    generated,
    note: 'Recurrence generation completed using the live task recurrence schedule.',
  };
}
