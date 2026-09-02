-- 005_project_members.sql
-- Minimal project membership: who is invited to / part of a project.
-- profile_id is null until the invited email matches an existing profile (i.e. they've signed up).

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_at timestamptz default now(),
  joined_at timestamptz,
  primary key (project_id, email)
);

create index if not exists idx_project_members_project_id on project_members(project_id);
create index if not exists idx_project_members_profile_id on project_members(profile_id);

alter table project_members enable row level security;

create policy "Authenticated users full access" on project_members
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
