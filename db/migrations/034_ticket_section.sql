-- 034_ticket_section.sql
-- A project remembers which section its tickets go into, instead of looking for one
-- called "Tickets" each time (031): renaming that section made the next ticket create
-- a second one. Managers can also point tickets at any other section of the project.
-- Run after 033. Safe to re-run.

alter table projects add column if not exists ticket_heading_id uuid references headings(id) on delete set null;

-- projects already taking tickets: the section 031 made for them, if it's still called that
update projects p
set ticket_heading_id = (select h.id from headings h where h.project_id = p.id and h.name = 'Tickets' order by h.created_at limit 1)
where p.ticket_heading_id is null;

create or replace function set_ticket_heading(p_project_id uuid, p_heading_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_project_manager(p_project_id) then
    raise exception 'Only a project manager can change this';
  end if;
  if not exists (select 1 from headings where id = p_heading_id and project_id = p_project_id) then
    raise exception 'That section isn''t in this project';
  end if;
  update projects set ticket_heading_id = p_heading_id where id = p_project_id;
end
$$;

-- Same as 031 apart from how the section is found.
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

  select ticket_heading_id into v_heading from projects where id = p_project_id;
  -- first ticket, or the section was deleted: one called Tickets, made if need be, and remembered from here on
  if v_heading is null then
    select h.id into v_heading from headings h
    where h.project_id = p_project_id and h.name = 'Tickets' order by h.created_at limit 1;
    if v_heading is null then
      insert into headings (project_id, name, position)
      values (p_project_id, 'Tickets', (select coalesce(max(position), -1) + 1 from headings where project_id = p_project_id))
      returning id into v_heading;
    end if;
    update projects set ticket_heading_id = v_heading where id = p_project_id;
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
