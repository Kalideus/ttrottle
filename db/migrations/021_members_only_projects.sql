-- 021_members_only_projects.sql
-- Until now every signed-in user could see every non-private project (and all
-- its tasks, comments, etc.), regardless of project_members -- so the member
-- lists in the app didn't actually control access. From here on a project, and
-- everything inside it, is visible only to:
--   * its members (any role),
--   * whoever created it,
--   * site super admins (shared projects only -- private ones stay private).

create or replace function is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false)
$$;

-- Used by the policies on tasks, headings, comments, followers, task_tags,
-- task_activity, attachments, recurrences, dependencies, notifications,
-- comment_likes and project_members (migrations 016/017), so changing it here
-- tightens all of them at once.
create or replace function can_see_project(p_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select auth.role() = 'authenticated' and (
    p_project_id is null
    or exists (select 1 from project_members where project_id = p_project_id and profile_id = auth.uid())
    or exists (select 1 from projects where id = p_project_id and created_by = auth.uid())
    or (not project_is_private(p_project_id) and is_super_admin())
  )
$$;

-- Written inline rather than via can_see_project(): creating a project does
-- INSERT ... RETURNING before the owner's project_members row exists, and a
-- helper function wouldn't see the just-inserted row, so the creator would be
-- refused their own new project.
drop policy if exists "Authenticated users can view projects" on projects;
create policy "Authenticated users can view projects" on projects
  for select using (
    auth.role() = 'authenticated' and (
      created_by = auth.uid()
      or project_role(id) is not null
      or (not is_private and is_super_admin())
    )
  );
