-- 012_project_member_roles.sql
-- Three-tier roles (owner/admin/member) with real enforcement.
--
-- Before this: project_members RLS was "any authenticated user, full access"
-- (anyone could add/remove/promote themselves on any project via the client),
-- and the invite API let ANY existing member invite more people, with no
-- concept of admin at all. `projects` had no RLS whatsoever -- any signed-in
-- user could edit or delete any project.

alter table project_members drop constraint if exists project_members_role_check;
alter table project_members add constraint project_members_role_check
  check (role in ('owner', 'admin', 'member'));

-- security definer so this can be used inside project_members' own policies
-- without RLS recursing into itself.
create or replace function project_role(p_project_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from project_members
  where project_id = p_project_id and profile_id = auth.uid()
$$;

-- project_members --------------------------------------------------------

drop policy if exists "Authenticated users full access" on project_members;

-- unchanged: everyone can see who's on a project (matches projects being
-- visible to the whole team today -- see getProjects()).
create policy "Authenticated users can view members" on project_members
  for select using (auth.role() = 'authenticated');

-- owners/admins can add members; a project's very first row (the creator
-- inserting themselves as owner in createProject()) is also allowed.
create policy "Owners and admins can add members" on project_members
  for insert with check (
    project_role(project_id) in ('owner', 'admin')
    or (
      profile_id = auth.uid() and role = 'owner'
      and not exists (select 1 from project_members m where m.project_id = project_members.project_id)
    )
  );

-- owners can remove anyone; admins can remove anyone except an owner.
create policy "Owners and admins can remove non-owner members" on project_members
  for delete using (
    project_role(project_id) = 'owner'
    or (project_role(project_id) = 'admin' and role <> 'owner')
  );

-- role changes (promote/demote) are owner-only.
create policy "Owners can change member roles" on project_members
  for update using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

-- projects ----------------------------------------------------------------

alter table projects enable row level security;

-- unchanged: every signed-in user can see every project.
create policy "Authenticated users can view projects" on projects
  for select using (auth.role() = 'authenticated');

-- new: creating a project is opt-in per person, not "anyone signed in".
alter table profiles add column if not exists can_create_projects boolean not null default false;
update profiles set can_create_projects = true where email = 't.j.cornish@gmail.com';

create policy "Permitted users can create projects" on projects
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and can_create_projects = true)
  );

-- ponytail: "not exists" arm is a safety net for any pre-existing project
-- that has no project_members row at all (created before that table existed,
-- or with no created_by) -- otherwise it'd become permanently uneditable.
create policy "Owners and admins can edit their project" on projects
  for update using (
    project_role(id) in ('owner', 'admin')
    or not exists (select 1 from project_members where project_id = projects.id)
  );

create policy "Owners can delete their project" on projects
  for delete using (
    project_role(id) = 'owner'
    or not exists (select 1 from project_members where project_id = projects.id)
  );
