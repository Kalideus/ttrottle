-- 017_private_projects_gaps.sql
-- Closes the holes left by 016 (run 016 first):
--   * notifications: anyone could read EVERY notification (including comment
--     snippets from private projects) and create ones for people who can't open
--     the task. Now you only see your own, and you can't notify someone else
--     about a private task.
--   * task_recurrences / task_dependencies / comment_likes had no project check.
--   * A private task can't be assigned to, or followed by, anyone but its owner.

create or replace function task_is_private(p_task_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(project_is_private((select project_id from tasks where id = p_task_id)), false)
$$;

create or replace function can_see_comment(p_comment_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select can_see_task((select task_id from comments where id = p_comment_id))
$$;

-- notifications ------------------------------------------------------------

drop policy if exists "Authenticated users full access" on notifications;
drop policy if exists "Own notifications only" on notifications;
drop policy if exists "Notify only people who can see the task" on notifications;

create policy "Own notifications only" on notifications
  for select using (user_id = auth.uid());
create policy "Own notifications update" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own notifications delete" on notifications
  for delete using (user_id = auth.uid());

-- Notifications for other people are how followers/assignees/mentions work, so
-- inserts stay open -- except for private tasks, where only self-notifications pass.
create policy "Notify only people who can see the task" on notifications
  for insert with check (
    auth.role() = 'authenticated'
    and can_see_task(task_id)
    and (user_id = auth.uid() or not task_is_private(task_id))
  );

-- comment_likes ------------------------------------------------------------

drop policy if exists "Authenticated users full access" on comment_likes;
create policy "Visible comments only" on comment_likes
  for all using (can_see_comment(comment_id)) with check (can_see_comment(comment_id) and user_id = auth.uid());

-- recurrences / dependencies -------------------------------------------------

alter table task_recurrences enable row level security;
alter table task_dependencies enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('task_recurrences', 'task_dependencies')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "Visible projects only" on task_recurrences
  for all
  using (can_see_project(project_id) and (parent_task_id is null or can_see_task(parent_task_id)))
  with check (can_see_project(project_id) and (parent_task_id is null or can_see_task(parent_task_id)));

create policy "Visible projects only" on task_dependencies
  for all
  using (can_see_task(task_id) and can_see_task(depends_on_task_id))
  with check (can_see_task(task_id) and can_see_task(depends_on_task_id));

-- private tasks stay with their owner ------------------------------------------

drop policy if exists "Visible projects only" on tasks;
create policy "Visible projects only" on tasks
  for all
  using (can_see_project(project_id))
  with check (
    can_see_project(project_id)
    and (assignee_id is null or assignee_id = auth.uid() or not project_is_private(project_id))
  );

drop policy if exists "Visible projects only" on followers;
create policy "Visible projects only" on followers
  for all
  using (can_see_task(task_id))
  with check (can_see_task(task_id) and (user_id = auth.uid() or not task_is_private(task_id)));
