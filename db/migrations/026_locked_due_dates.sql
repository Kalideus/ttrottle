-- 026_locked_due_dates.sql
-- Managers (project owner/admin, or a super admin) can lock a task's due date.
-- Everyone else then asks for an extension: a comment carrying the date they
-- want, which a manager approves (moves the date) or declines.
-- Enforced here, not just hidden in the UI. Run after 025. Safe to re-run.

alter table tasks add column if not exists due_locked boolean not null default false;

alter table comments add column if not exists requested_due_date date;
alter table comments add column if not exists request_status text;
alter table comments drop constraint if exists comments_request_status_check;
alter table comments add constraint comments_request_status_check
  check (request_status in ('pending', 'approved', 'declined'));

create or replace function is_project_manager(p_project_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(project_role(p_project_id) in ('owner', 'admin'), false) or is_super_admin()
$$;

-- tasks: only managers flip the lock, or move a locked date ---------------------

create or replace function guard_locked_due_date() returns trigger
language plpgsql as $$
begin
  -- auth.uid() is null for server/cron jobs (service role): not blocked
  if auth.uid() is null or is_project_manager(old.project_id) then return new; end if;
  if new.due_locked is distinct from old.due_locked then
    raise exception 'Only a project manager can lock or unlock a due date';
  end if;
  if old.due_locked and new.due_date is distinct from old.due_date then
    raise exception 'This due date is locked. Ask for an extension instead';
  end if;
  return new;
end
$$;

drop trigger if exists tasks_guard_locked_due_date on tasks;
create trigger tasks_guard_locked_due_date
  before update of due_locked, due_date on tasks
  for each row execute function guard_locked_due_date();

-- comments: anyone can ask, only managers answer ---------------------------------

create or replace function guard_extension_request() returns trigger
language plpgsql as $$
declare
  p uuid := (select project_id from tasks where id = new.task_id);
begin
  if tg_op = 'INSERT' then
    if new.request_status is not null and new.request_status <> 'pending' then
      raise exception 'A new extension request must be pending';
    end if;
  elsif new.request_status is distinct from old.request_status
     or new.requested_due_date is distinct from old.requested_due_date then
    if auth.uid() is not null and not is_project_manager(p) then
      raise exception 'Only a project manager can approve or decline an extension';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists comments_guard_extension_request on comments;
create trigger comments_guard_extension_request
  before insert or update on comments
  for each row execute function guard_extension_request();

-- a new request notifies the project's managers (followers already get the usual comment notification)
create or replace function notify_extension_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, task_id, type, actor_id, comment_id, detail)
  select pm.profile_id, new.task_id, 'comment', new.author_id, new.id,
         'asked to move the due date to ' || to_char(new.requested_due_date, 'FMDD Mon YYYY')
  from tasks t
  join project_members pm on pm.project_id = t.project_id and pm.role in ('owner', 'admin')
  where t.id = new.task_id
    and pm.profile_id is not null
    and pm.profile_id <> new.author_id
    and not exists (select 1 from followers f where f.task_id = new.task_id and f.user_id = pm.profile_id);
  return new;
end
$$;

drop trigger if exists comments_notify_extension_request on comments;
create trigger comments_notify_extension_request
  after insert on comments
  for each row when (new.requested_due_date is not null)
  execute function notify_extension_request();
