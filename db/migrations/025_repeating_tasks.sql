-- 025_repeating_tasks.sql
-- Repeating tasks: ticking a repeating task done creates its next copy.
-- The next due date steps from the old DUE date (not the day it was ticked),
-- and skips ahead past any dates already gone, so finishing late never
-- produces an already-overdue copy. Safe to re-run.

alter table tasks add column if not exists repeat text
  check (repeat in ('daily', 'weekly', 'monthly', 'yearly'));

create or replace function next_repeat_date(d date, r text) returns date
language sql immutable as $$
  select case r
    when 'daily' then d + 1
    when 'weekly' then d + 7
    -- the last day of a month stays the last day: 30 Apr -> 31 May, 28 Feb -> 31 Mar.
    -- ponytail: so a "28th of every month" task drifts to the 31st after February; store the
    -- anchor day if anyone ever needs that.
    when 'monthly' then case
      when d = (date_trunc('month', d) + interval '1 month' - interval '1 day')::date
        then (date_trunc('month', d) + interval '2 months' - interval '1 day')::date
      else (d + interval '1 month')::date  -- 31 Jan -> 28 Feb (Postgres clamps)
    end
    when 'yearly' then (d + interval '1 year')::date
  end
$$;

create or replace function spawn_repeat() returns trigger
language plpgsql as $$
declare
  base date := coalesce(new.due_date, current_date);  -- no due date: one period from today
  next_due date;
  new_id uuid := gen_random_uuid();
begin
  if new.repeat is null or new.parent_task_id is not null or new.deleted_at is not null
     or not new.completed or old.completed then
    return new;
  end if;

  next_due := next_repeat_date(base, new.repeat);
  while next_due < current_date loop
    next_due := next_repeat_date(next_due, new.repeat);
  end loop;

  insert into tasks (id, project_id, heading_id, name, description, assignee_id, due_date, priority, repeat, position, created_by)
  values (
    new_id, new.project_id, new.heading_id, new.name, new.description, new.assignee_id, next_due, new.priority, new.repeat,
    (select coalesce(max(position), -1) + 1 from tasks where project_id = new.project_id and parent_task_id is null),
    auth.uid()
  );

  -- subtasks come along reset to not done, their dates shifted by the same amount
  insert into tasks (project_id, parent_task_id, name, description, assignee_id, due_date, priority, position, created_by)
  select project_id, new_id, name, description, assignee_id, due_date + (next_due - base), priority, position, auth.uid()
  from tasks where parent_task_id = new.id and deleted_at is null;

  insert into task_tags (task_id, tag_id) select new_id, tag_id from task_tags where task_id = new.id;
  insert into followers (task_id, user_id) select new_id, user_id from followers where task_id = new.id;

  -- the repeat moves to the new copy, so un-ticking and re-ticking this one can't spawn a second
  new.repeat := null;
  return new;
end
$$;

drop trigger if exists tasks_spawn_repeat on tasks;
create trigger tasks_spawn_repeat
  before update of completed on tasks
  for each row execute function spawn_repeat();
