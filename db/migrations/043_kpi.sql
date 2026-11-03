-- 043_kpi.sql
-- Performance dashboard, step 1: which tasks count towards someone's core KPI.
--   * A manager handing a task to someone else flags it 🎯 (kpi), noting who and
--     when, and locks its due date. A manager taking a task themselves doesn't.
--   * Managers can flag or unflag any task by hand. Nobody else can.
--   * On a flagged task only a manager can move the due date, hand it to someone
--     else or delete it, so a miss can't be hidden or passed on.
--   * kpi_at is when the clock starts for Tech (turnaround) and is kept through
--     reassignment. first_assigned_at is when a task first got an assignee, for
--     how long tickets wait to be handed out.
--   * Nothing is backfilled: it all starts from when this runs.
-- Run after 042. Safe to re-run.

alter table projects add column if not exists kpi_type text not null default 'deadline';
alter table projects drop constraint if exists projects_kpi_type_check;
alter table projects add constraint projects_kpi_type_check check (kpi_type in ('deadline', 'turnaround'));
update projects set kpi_type = 'turnaround' where lower(trim(name)) = 'tech';

alter table tasks add column if not exists kpi boolean not null default false;
alter table tasks add column if not exists kpi_by uuid references auth.users(id) on delete set null;
alter table tasks add column if not exists kpi_at timestamptz;
alter table tasks add column if not exists first_assigned_at timestamptz;
create index if not exists idx_tasks_kpi_assignee on tasks(assignee_id) where kpi;

create or replace function kpi_on_task() returns trigger
language plpgsql as $$
declare
  me uuid := auth.uid();  -- null for server/cron jobs (service role): not blocked, never flags
  newly_assigned boolean;
begin
  if tg_op = 'INSERT' then
    -- pg_trigger_depth() > 1: the next copy of a repeating task, made inside spawn_repeat, keeps its flag
    if new.kpi and me is not null and pg_trigger_depth() = 1 and not is_project_manager(new.project_id) then
      raise exception 'Only a project manager can flag a task for KPI';
    end if;
    if new.kpi then
      new.kpi_at := now();
      if pg_trigger_depth() = 1 then new.kpi_by := me; end if;
    end if;
    new.first_assigned_at := case when new.assignee_id is not null then now() end;
    newly_assigned := new.assignee_id is not null;
  else
    if me is not null and not is_project_manager(old.project_id) and (
         new.kpi is distinct from old.kpi
         or new.kpi_by is distinct from old.kpi_by
         or new.kpi_at is distinct from old.kpi_at
         or (old.kpi and (new.due_date is distinct from old.due_date
                          or new.assignee_id is distinct from old.assignee_id
                          or (new.deleted_at is not null and old.deleted_at is null)))
       ) then
      raise exception 'This is a KPI task: only a project manager can change its flag, due date or assignee, or delete it';
    end if;
    if new.kpi and not old.kpi then
      new.kpi_by := me;
      new.kpi_at := now();
    end if;
    -- only set going from nobody to somebody, so tasks assigned before this ran stay null (not counted)
    new.first_assigned_at := case
      when old.first_assigned_at is not null then old.first_assigned_at
      when old.assignee_id is null and new.assignee_id is not null then now()
    end;
    newly_assigned := new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id;
  end if;

  -- a manager handing the task to someone else; reassigning a flagged task keeps its kpi_by and kpi_at
  if newly_assigned and not new.kpi and me is not null
     and new.assignee_id <> me and is_project_manager(new.project_id) then
    new.kpi := true;
    new.kpi_by := me;
    new.kpi_at := now();
  end if;

  if new.kpi and new.due_date is not null
     and (tg_op = 'INSERT' or not old.kpi or new.due_date is distinct from old.due_date) then
    new.due_locked := true;
  end if;
  return new;
end
$$;

drop trigger if exists tasks_kpi on tasks;
create trigger tasks_kpi
  before insert or update on tasks
  for each row execute function kpi_on_task();
