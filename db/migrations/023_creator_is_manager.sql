-- 023_creator_is_manager.sql
-- Whoever creates a project now joins it as Manager ('admin') rather than Owner,
-- so deleting projects and changing roles stay with super admins. The only
-- policy change needed: a project's very first member row (the creator adding
-- themselves) may now be 'admin' as well as 'owner'. Existing owners are untouched.

drop policy if exists "Owners and admins can add members" on project_members;
create policy "Owners and admins can add members" on project_members
  for insert with check (
    not project_is_private(project_id)
    and (
      project_role(project_id) in ('owner', 'admin')
      or (
        profile_id = auth.uid() and role in ('owner', 'admin')
        and not exists (select 1 from project_members m where m.project_id = project_members.project_id)
      )
    )
  );
