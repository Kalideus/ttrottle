-- 027_repeating_subtasks.sql
-- Subtasks can repeat too. Ticking a repeating subtask doesn't make a copy (that
-- would pile ticked copies up under the parent); it rolls the same row on to its
-- next due date and un-ticks it. The tick is still recorded in the activity log.
-- When a repeating parent makes its next copy, the copied subtasks keep their
-- own repeat. Run after 026. Safe to re-run.

create or replace function spawn_repeat() returns trigger
language plpgsql as $$
declare
  base date := coalesce(new.due_date, current_date);  -- no due date: one period from today
  next_due date;
  new_id uuid := gen_random_uuid();
  next_task tasks%rowtype;
begin
  if new.repeat is null or new.deleted_at is not null or not new.completed or old.completed then
    return new;
  end if;

  next_due := next_repeat_date(base, new.repeat);
  while next_due < current_date loop
    next_due := next_repeat_date(next_due, new.repeat);
  end loop;

  -- a subtask rolls on in place
  if new.parent_task_id is not null then
    new.due_date := next_due;
    new.completed := false;
    new.completed_at := null;
    return new;
  end if;

  -- copy the whole row, so columns added later (e.g. 026's due_locked) carry over without touching this
  next_task := new;
  next_task.id := new_id;
  next_task.due_date := next_due;
  next_task.completed := false;
  next_task.completed_at := null;
  next_task.position := (select coalesce(max(position), -1) + 1 from tasks where project_id = new.project_id and parent_task_id is null);
  next_task.created_by := auth.uid();
  next_task.created_at := now();
  insert into tasks select next_task.*;

  -- subtasks come along reset to not done, their dates shifted by the same amount, keeping their own repeat
  insert into tasks (project_id, parent_task_id, name, description, assignee_id, due_date, priority, position, repeat, created_by)
  select project_id, new_id, name, description, assignee_id, due_date + (next_due - base), priority, position, repeat, auth.uid()
  from tasks where parent_task_id = new.id and deleted_at is null;

  insert into task_tags (task_id, tag_id) select new_id, tag_id from task_tags where task_id = new.id;
  insert into followers (task_id, user_id) select new_id, user_id from followers where task_id = new.id;

  -- the repeat moves to the new copy, so un-ticking and re-ticking this one can't spawn a second
  new.repeat := null;
  return new;
end
$$;
