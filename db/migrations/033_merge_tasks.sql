-- 033_merge_tasks.sql
-- Merging a duplicate task into another (lib/supabase/queries.ts mergeTasks). One task is
-- kept exactly as it is. The other's name, description, assignee, due date and priority
-- are written into a comment on the kept task; its comments, activity, subtasks, followers,
-- tags and notifications move across; then it is soft-deleted (013). All or nothing.
--   * Either task may be in any project the person merging can see.
--   * A repeating task can't be merged.
--   * Still two levels only: a task with subtasks can't be merged into a subtask.
-- Run after 032. Safe to re-run.

-- Same trigger as 028, plus the merge_tasks line: a merge moves other people's comments,
-- which this otherwise refuses. Only merge_tasks sets that setting; the API can't.
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

  if current_setting('app.merging_tasks', true) = '1' then return new; end if;

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

create or replace function merge_tasks(p_keep uuid, p_remove uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  k tasks%rowtype;
  r tasks%rowtype;
  v_private boolean;
  -- who may be carried over to the kept task as a follower or keep a notification about it
  v_allowed uuid[];
  -- photos: the client copies the removed task's folder into the kept task's before calling this
  v_from text := 'task-photo:' || p_remove || '/';
  v_to text := 'task-photo:' || p_keep || '/';
begin
  if v_me is null then raise exception 'Not signed in'; end if;
  if p_keep = p_remove then raise exception 'Pick a different task to merge with'; end if;

  select * into k from tasks where id = p_keep and deleted_at is null for update;
  select * into r from tasks where id = p_remove and deleted_at is null for update;
  -- can_see_project, not can_see_task: whoever raised a ticket can read it but not change it
  if k.id is null or r.id is null or not can_see_project(k.project_id) or not can_see_project(r.project_id) then
    raise exception 'One of those tasks can''t be found';
  end if;
  if k.repeat is not null or r.repeat is not null then
    raise exception 'A repeating task can''t be merged. Turn off its repeat first';
  end if;
  if k.parent_task_id is not null and exists (select 1 from tasks where parent_task_id = p_remove and deleted_at is null) then
    raise exception 'A task with subtasks can''t be merged into a subtask';
  end if;

  v_private := project_is_private(k.project_id);
  if k.project_id = r.project_id then
    v_allowed := array(select user_id from followers where task_id = p_remove
                       union select user_id from notifications where task_id = p_remove);
  else
    v_allowed := array(select profile_id from project_members where project_id = k.project_id and profile_id is not null
                       union select created_by from projects where id = k.project_id
                       union select k.ticket_by);
  end if;

  -- what the removed task said, kept as a comment from whoever merged it
  insert into comments (task_id, author_id, body)
  values (p_keep, v_me, replace(
    'Merged in "' || r.name || '"'
      || coalesce(E'\nAssignee: ' || (select name from profiles where id = r.assignee_id), '')
      || coalesce(E'\nDue: ' || to_char(r.due_date, 'FMDD Mon YYYY'), '')
      || coalesce(E'\nPriority: ' || r.priority::text, '')
      || case when r.completed then E'\nIt was completed' else '' end
      || coalesce(E'\n\n' || nullif(trim(r.description), ''), ''),
    v_from, v_to));

  -- its comments (their likes go with them)
  perform set_config('app.merging_tasks', '1', true);
  update comments set task_id = p_keep, body = replace(body, v_from, v_to) where task_id = p_remove;
  perform set_config('app.merging_tasks', '', true);

  update task_activity set task_id = p_keep where task_id = p_remove;
  insert into task_activity (task_id, actor_id, message)
  values (p_keep, v_me, 'merged "' || r.name || '" into this task');

  -- its subtasks, after the ones already there; a private project's tasks are only ever its owner's
  update tasks set
    parent_task_id = p_keep,
    project_id = k.project_id,
    heading_id = null,
    position = position + 1 + (select coalesce(max(position), -1) from tasks where parent_task_id = p_keep),
    assignee_id = case when v_private and assignee_id is distinct from v_me then null else assignee_id end
  where parent_task_id = p_remove and deleted_at is null;

  insert into followers (task_id, user_id)
  select p_keep, user_id from followers where task_id = p_remove and user_id = any(v_allowed)
  on conflict do nothing;

  insert into task_tags (task_id, tag_id)
  select p_keep, tag_id from task_tags where task_id = p_remove
  on conflict do nothing;

  -- so an old notification opens the kept task, not a deleted one
  update notifications set task_id = p_keep where task_id = p_remove and user_id = any(v_allowed);

  update tasks set deleted_at = now(), deleted_by = v_me where id = p_remove;
end
$$;
