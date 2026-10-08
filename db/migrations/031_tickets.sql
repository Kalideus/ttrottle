-- 031_tickets.sql
-- Tickets: anyone with an account can send a request to a team (Marketing, Tech,
-- Facilities...) without being in that team's project. A ticket is an ordinary
-- task in the project, marked with who raised it (ticket_by) and dropped into a
-- "Tickets" section for the managers to hand out.
--   * A project takes tickets only once a manager (or a super admin) turns it on.
--   * Whoever raised a ticket can read it and its comments, and comment on it.
--     They can't edit it and see nothing else in the project.
-- Run after 028. Safe to re-run.

alter table projects add column if not exists accepts_tickets boolean not null default false;

alter table tasks add column if not exists ticket_by uuid references auth.users(id) on delete set null;
create index if not exists idx_tasks_ticket_by on tasks(ticket_by) where ticket_by is not null;

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('comment', 'mention', 'assigned', 'due_soon', 'completed', 'updated', 'ticket'));

-- who can see a ticket ---------------------------------------------------------

-- Read-only: the "Visible projects only" policy (016/017) is still the only one that allows writes.
drop policy if exists "Own tickets" on tasks;
create policy "Own tickets" on tasks
  for select using (ticket_by = auth.uid());

-- Comments, followers, activity and notifications all go through this (016/017), so
-- the person who raised a ticket can follow and comment on it like a project member.
create or replace function can_see_task(p_task_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    (select can_see_project(t.project_id) or t.ticket_by = auth.uid() from tasks t where t.id = p_task_id),
    false
  )
$$;

-- turning tickets on for a project ------------------------------------------------

create or replace function set_accepts_tickets(p_project_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_project_manager(p_project_id) then
    raise exception 'Only a project manager can change this';
  end if;
  if project_is_private(p_project_id) then
    raise exception 'A private project can''t take tickets';
  end if;
  update projects set accepts_tickets = p_on where id = p_project_id;
end
$$;

-- The teams you can send a ticket to. A function because the projects policy
-- hides projects you're not in; this gives out the name and icon only.
create or replace function ticket_projects()
returns table (id uuid, name text, icon text, color text)
language sql security definer stable set search_path = public as $$
  select p.id, p.name, p.icon, p.color
  from projects p
  where p.accepts_tickets and not p.archived and not p.is_private and auth.uid() is not null
  order by p.name
$$;

-- raising a ticket --------------------------------------------------------------

create or replace function create_ticket(p_project_id uuid, p_name text, p_description text default null, p_due_date date default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_heading uuid;
  v_task uuid := gen_random_uuid();
begin
  if v_me is null then raise exception 'Not signed in'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'A ticket needs a title'; end if;
  if not exists (select 1 from projects where id = p_project_id and accepts_tickets and not archived and not is_private) then
    raise exception 'That team isn''t taking tickets';
  end if;

  -- an ordinary section: managers can rename it, or move a ticket out once it's handed to someone
  select h.id into v_heading from headings h
  where h.project_id = p_project_id and h.name = 'Tickets' order by h.created_at limit 1;
  if v_heading is null then
    insert into headings (project_id, name, position)
    values (p_project_id, 'Tickets', (select coalesce(max(position), -1) + 1 from headings where project_id = p_project_id))
    returning id into v_heading;
  end if;

  insert into tasks (id, project_id, heading_id, name, description, due_date, position, created_by, ticket_by)
  values (
    v_task, p_project_id, v_heading, trim(p_name), nullif(trim(p_description), ''), p_due_date,
    (select coalesce(max(position), -1) + 1 from tasks where project_id = p_project_id and parent_task_id is null),
    v_me, v_me
  );

  -- following it is how they hear about comments, a new due date and completion
  insert into followers (task_id, user_id) values (v_task, v_me) on conflict do nothing;

  insert into notifications (user_id, task_id, type, actor_id)
  select pm.profile_id, v_task, 'ticket', v_me
  from project_members pm
  where pm.project_id = p_project_id
    and pm.role in ('owner', 'admin')
    and pm.profile_id is not null
    and pm.profile_id <> v_me;

  return v_task;
end
$$;

-- The tickets I raised, with the team's name and who has it. A function for the
-- same reason as ticket_projects(): I can't read that project or its members.
create or replace function my_tickets()
returns table (
  id uuid, name text, description text, due_date date, completed boolean, completed_at timestamptz,
  deleted_at timestamptz, created_at timestamptz,
  project_name text, project_icon text, project_color text, assignee_name text
)
language sql security definer stable set search_path = public as $$
  select t.id, t.name, t.description, t.due_date, t.completed, t.completed_at, t.deleted_at, t.created_at,
         p.name, p.icon, p.color, a.name
  from tasks t
  left join projects p on p.id = t.project_id
  left join profiles a on a.id = t.assignee_id
  where t.ticket_by = auth.uid()
  order by t.created_at desc
$$;
