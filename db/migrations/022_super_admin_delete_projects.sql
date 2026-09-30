-- 022_super_admin_delete_projects.sql (run after 021, which adds is_super_admin())
-- Super admins can delete any shared project from inside the app, not just ones
-- they own. Private projects still can't be deleted by anyone.

drop policy if exists "Owners can delete their project" on projects;
create policy "Owners can delete their project" on projects
  for delete using (
    not is_private
    and (
      project_role(id) = 'owner'
      or is_super_admin()
      or not exists (select 1 from project_members where project_id = projects.id)
    )
  );
