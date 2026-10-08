-- 028_audit_fixes.sql
-- Three holes found in an audit. Run after 027. Safe to re-run.
--   * Deleting a project left its tasks behind with no project, and "no project"
--     counted as visible to every signed-in user.
--   * A manager ('admin') could add a member as 'owner', which 023 meant to
--     keep with owners and super admins.
--   * Any project member could edit, delete or post comments as someone else.

-- tasks go with their project --------------------------------------------------

-- Tasks already orphaned by an earlier project delete. They stop being visible
-- below; look at them first, then delete them by hand if they're not wanted:
--   select id, name, created_at from tasks where project_id is null;
--   delete from tasks where project_id is null;

alter table tasks drop constraint if exists tasks_project_id_fkey;
alter table tasks add constraint tasks_project_id_fkey
  foreign key (project_id) references projects(id) on delete cascade;

-- Same as 021 minus "p_project_id is null": a task without a project is visible to nobody.
create or replace function can_see_project(p_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select auth.role() = 'authenticated' and (
    exists (select 1 from project_members where project_id = p_project_id and profile_id = auth.uid())
    or exists (select 1 from projects where id = p_project_id and created_by = auth.uid())
    or (not project_is_private(p_project_id) and is_super_admin())
  )
$$;

-- managers can't hand out 'owner' ------------------------------------------------

drop policy if exists "Owners and admins can add members" on project_members;
create policy "Owners and admins can add members" on project_members
  for insert with check (
    not project_is_private(project_id)
    and (
      project_role(project_id) = 'owner'
      or (project_role(project_id) = 'admin' and role <> 'owner')
      or (
        profile_id = auth.uid() and role in ('owner', 'admin')
        and not exists (select 1 from project_members m where m.project_id = project_members.project_id)
      )
    )
  );

-- comments belong to their author ---------------------------------------------------
-- Same trigger as 026, plus the author checks. auth.uid() is null for server/cron
-- jobs (service role): not blocked.

create or replace function guard_extension_request() returns trigger
language plpgsql as $$
declare
  p uuid := (select project_id from tasks where id = new.task_id);
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.author_id is distinct from auth.uid() then
      raise exception 'You can only comment as yourself';
    end if;
    if new.request_status is not null and new.request_status <> 'pending' then
      raise exception 'A new extension request must be pending';
    end if;
    return new;
  end if;

  if auth.uid() is not null and (
       new.author_id is distinct from old.author_id
       or new.task_id is distinct from old.task_id
       or (old.author_id is distinct from auth.uid() and (
            new.body is distinct from old.body
            or new.mentions is distinct from old.mentions
            or new.edited_at is distinct from old.edited_at
            or new.deleted_at is distinct from old.deleted_at))
     ) then
    raise exception 'Only the author can edit or delete a comment';
  end if;

  if new.request_status is distinct from old.request_status
     or new.requested_due_date is distinct from old.requested_due_date then
    if auth.uid() is not null and not is_project_manager(p) then
      raise exception 'Only a project manager can approve or decline an extension';
    end if;
  end if;
  return new;
end
$$;
