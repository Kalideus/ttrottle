-- 025_repeating_tasks.sql
-- Repeating tasks: ticking a repeating task done creates its next copy.
-- The next due date steps from the old DUE date (not the day it was ticked),
-- and skips ahead past any dates already gone, so finishing late never
-- produces an already-overdue copy. Safe to re-run.
--
-- repeat values (lib/repeat.ts labels them):
--   daily, weekly, yearly
--   monthly               same day of month; the last day of a month stays the last day
--   monthly_weekday       same "nth weekday" as the due date, e.g. the 3rd Thursday
--   monthly_last_weekday  same weekday, last one in the month, e.g. the last Thursday

alter table tasks add column if not exists repeat text;
alter table tasks drop constraint if exists tasks_repeat_check;
alter table tasks add constraint tasks_repeat_check
  check (repeat in ('daily', 'weekly', 'monthly', 'monthly_weekday', 'monthly_last_weekday', 'yearly'));

create or replace function next_repeat_date(d date, r text) returns date
language plpgsql immutable as $$
declare
  next_month date := (date_trunc('month', d) + interval '1 month')::date;
  next_month_end date := (date_trunc('month', d) + interval '2 months' - interval '1 day')::date;
  dow int := extract(dow from d);
  nth int := (extract(day from d)::int - 1) / 7 + 1;
  first_dow date;
begin
  if r = 'daily' then return d + 1; end if;
  if r = 'weekly' then return d + 7; end if;
  if r = 'yearly' then return (d + interval '1 year')::date; end if;

  if r = 'monthly' then
    -- 30 Apr -> 31 May, 28 Feb -> 31 Mar, 31 Jan -> 28 Feb (Postgres clamps).
    -- ponytail: so a "28th of every month" task drifts to the 31st after February; store the
    -- anchor day if anyone ever needs that.
    if d = (date_trunc('month', d) + interval '1 month' - interval '1 day')::date then
      return next_month_end;
    end if;
    return (d + interval '1 month')::date;
  end if;

  -- a 5th weekday doesn't exist every month, so it's treated as "the last"
  if r = 'monthly_last_weekday' or (r = 'monthly_weekday' and nth = 5) then
    return next_month_end - ((extract(dow from next_month_end)::int - dow + 7) % 7);
  end if;

  if r = 'monthly_weekday' then
    first_dow := next_month + ((dow - extract(dow from next_month)::int + 7) % 7);
    return first_dow + 7 * (nth - 1);
  end if;

  return null;
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

-- self-check: the editor shows an error here if the date maths is wrong (October 2026 Thursdays: 1, 8, 15, 22, 29)
do $$ begin
  assert next_repeat_date('2026-04-30', 'monthly') = '2026-05-31';
  assert next_repeat_date('2026-01-31', 'monthly') = '2026-02-28';
  assert next_repeat_date('2026-03-15', 'monthly') = '2026-04-15';
  assert next_repeat_date('2026-10-15', 'monthly_weekday') = '2026-11-19';
  assert next_repeat_date('2026-10-29', 'monthly_weekday') = '2026-11-26';
  assert next_repeat_date('2026-10-29', 'monthly_last_weekday') = '2026-11-26';
  assert next_repeat_date('2026-12-29', 'weekly') = '2027-01-05';
end $$;
