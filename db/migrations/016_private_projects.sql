-- 016_private_projects.sql
-- Every person gets exactly one private project, "My Private Project", visible
-- only to them. Not shareable, not deletable, not archivable, and nobody else
-- (super admins included) can see it or anything inside it.
--
-- Enforcement is in the database, so it also covers tasks/comments/etc.: those
-- tables had NO row-level security before this (any signed-in user could read
-- them directly), so this migration turns it on and REPLACES whatever policies
-- they had with "you can see it if you can see its project".

alter table projects add column if not exists is_private boolean not null default false;

-- "Can't make more": one private project per person, enforced by the database.
create unique index if not exists projects_one_private_per_user
  on projects (created_by) where is_private;

-- security definer helpers (same pattern as project_role in 012) so policies
-- can call them without RLS recursing into itself.
create or replace function project_is_private(p_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_private from projects where id = p_project_id), false)
$$;

-- Visible = shared project, no project at all, or you're a member.
create or replace function can_see_project(p_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select auth.role() = 'authenticated' and (
    p_project_id is null
    or not exists (select 1 from projects where id = p_project_id and is_private)
    or exists (select 1 from project_members where project_id = p_project_id and profile_id = auth.uid())
  )
$$;

create or replace function can_see_task(p_task_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select can_see_project((select project_id from tasks where id = p_task_id))
$$;

-- Creates the private project + owner membership for one person. Idempotent.
create or replace function create_private_project(p_profile_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into projects (name, color, icon, position, archived, created_by, is_private)
  values ('My Private Project', '#7A7A8C', '🔒', -1, false, p_profile_id, true)
  on conflict (created_by) where is_private do nothing
  returning id into v_id;

  if v_id is not null then
    insert into project_members (project_id, profile_id, email, role, joined_at)
    values (v_id, p_profile_id, coalesce(p_email, ''), 'owner', now());
  end if;
end $$;

-- Everyone who signs up from now on...
create or replace function profiles_create_private_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform create_private_project(NEW.id, NEW.email);
  return NEW;
end $$;

drop trigger if exists profiles_private_project_trigger on profiles;
create trigger profiles_private_project_trigger
  after insert on profiles
  for each row execute function profiles_create_private_project();

-- ...and everyone who already exists.
select create_private_project(id, email) from profiles;

-- projects ----------------------------------------------------------------

drop policy if exists "Authenticated users can view projects" on projects;
create policy "Authenticated users can view projects" on projects
  for select using (auth.role() = 'authenticated' and (not is_private or project_role(id) is not null));

-- The client can never create a private project (the trigger does it).
drop policy if exists "Permitted users can create projects" on projects;
create policy "Permitted users can create projects" on projects
  for insert with check (
    is_private = false
    and exists (select 1 from profiles where id = auth.uid() and can_create_projects = true)
  );

-- Can't flip is_private either way, and a private project can't be archived.
drop policy if exists "Owners and admins can edit their project" on projects;
create policy "Owners and admins can edit their project" on projects
  for update using (
    project_role(id) in ('owner', 'admin')
    or not exists (select 1 from project_members where project_id = projects.id)
  )
  with check (
    is_private = project_is_private(id)
    and (not is_private or archived = false)
  );

drop policy if exists "Owners can delete their project" on projects;
create policy "Owners can delete their project" on projects
  for delete using (
    not is_private
    and (
      project_role(id) = 'owner'
      or not exists (select 1 from project_members where project_id = projects.id)
    )
  );

-- project_members: private projects can't be shared or emptied ----------------

drop policy if exists "Authenticated users can view members" on project_members;
create policy "Authenticated users can view members" on project_members
  for select using (can_see_project(project_id));

drop policy if exists "Owners and admins can add members" on project_members;
create policy "Owners and admins can add members" on project_members
  for insert with check (
    not project_is_private(project_id)
    and (
      project_role(project_id) in ('owner', 'admin')
      or (
        profile_id = auth.uid() and role = 'owner'
        and not exists (select 1 from project_members m where m.project_id = project_members.project_id)
      )
    )
  );

drop policy if exists "Owners and admins can remove non-owner members" on project_members;
create policy "Owners and admins can remove non-owner members" on project_members
  for delete using (
    not project_is_private(project_id)
    and (
      project_role(project_id) = 'owner'
      or (project_role(project_id) = 'admin' and role <> 'owner')
    )
  );

-- Everything inside a project --------------------------------------------------
-- Drop any existing policies first: policies are OR'd together, so a leftover
-- "any signed-in user" policy would silently defeat the privacy rule.

-- Tables that don't exist in this database (e.g. attachments) are skipped.

do $$
declare
  t text;
  r record;
  cond text;
begin
  foreach t in array array['tasks', 'headings', 'comments', 'followers', 'task_tags', 'task_activity', 'attachments'] loop
    continue when to_regclass('public.' || t) is null;

    for r in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;

    cond := case when t in ('tasks', 'headings') then 'can_see_project(project_id)' else 'can_see_task(task_id)' end;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Visible projects only" on public.%I for all using (%s) with check (%s)', t, cond, cond);
  end loop;
end $$;
