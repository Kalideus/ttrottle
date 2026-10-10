-- 036_merge_tells_ticket_sender.sql
-- When a ticket is merged away into another task, whoever raised it used to see it turn
-- "Closed" with its comments gone and no reason. Now a comment is left on the closed ticket
-- saying it was merged, and they're notified. They still can't see the task it went into
-- (unless they're in that project), so they're no longer carried over to it as a follower.
-- Same function as 033 apart from the two "ticket" blocks. Run after 035. Safe to re-run.

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
  v_note uuid;
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
  -- ticket: its sender only follows on to the kept task if they can open it
  if r.ticket_by is not null and r.ticket_by is distinct from k.ticket_by
     and not exists (select 1 from project_members where project_id = k.project_id and profile_id = r.ticket_by) then
    v_allowed := array_remove(v_allowed, r.ticket_by);
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

  -- ticket: tell its sender why it closed (My tickets still shows them a closed ticket and its comments)
  if r.ticket_by is not null and r.ticket_by is distinct from k.ticket_by then
    insert into comments (task_id, author_id, body)
    values (p_remove, v_me, 'This ticket was merged into another task the team is already working on, so it''s closed here. The work carries on there.')
    returning id into v_note;
    if r.ticket_by <> v_me then
      insert into notifications (user_id, task_id, type, actor_id, comment_id, detail)
      values (r.ticket_by, p_remove, 'comment', v_me, v_note, 'This ticket was merged into another task');
    end if;
  end if;
end
$$;
