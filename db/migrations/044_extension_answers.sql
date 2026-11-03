-- 044_extension_answers.sql
-- An extension request remembers who answered it, when, and the due date it replaced, so the performance
-- drill-down can say "+3d, 28 Oct -> 31 Oct, approved by Sarah".
--   * Stamped by the database when the status changes, not sent by the app, so it can't be made up.
--   * previous_due_date is the task's date at that moment. The app saves the answer before it moves the
--     date (one save queue, in order), so this is the date from before the extension.
--   * Requests answered before this ran keep these empty.
-- Run after 043. Safe to re-run.

alter table comments add column if not exists answered_by uuid references auth.users(id) on delete set null;
alter table comments add column if not exists answered_at timestamptz;
alter table comments add column if not exists previous_due_date date;

create or replace function stamp_extension_answer() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.answered_by := null;
    new.answered_at := null;
    new.previous_due_date := null;
  elsif new.request_status is distinct from old.request_status and new.request_status in ('approved', 'declined') then
    new.answered_by := auth.uid();
    new.answered_at := now();
    new.previous_due_date := (select due_date from tasks where id = new.task_id);
  else
    new.answered_by := old.answered_by;
    new.answered_at := old.answered_at;
    new.previous_due_date := old.previous_due_date;
  end if;
  return new;
end
$$;

drop trigger if exists comments_stamp_extension_answer on comments;
create trigger comments_stamp_extension_answer
  before insert or update on comments
  for each row execute function stamp_extension_answer();
