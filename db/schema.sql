-- schema.sql
-- The whole database in one go, for a NEW, empty Supabase project. It is the end state of
-- migrations 001-042 (not a replay of them: 001/002 never ran as written), plus the pieces that
-- used to live only in the old database: the profiles table, the sign-up trigger that fills it,
-- and get_comment_counts. Paste it into the SQL editor and run it once.
-- Keep new migrations in db/migrations/ as before, and fold them in here too.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'priority') then
    create type priority as enum ('low', 'medium', 'high');
  end if;
end $$;

-- tables -----------------------------------------------------------------------

-- Palette must match AVATAR_COLORS in lib/avatar.ts.
create or replace function random_avatar_color()
returns text language sql volatile as $$
  select (array['#4573D2', '#F06A6A', '#A970D1', '#4ECBC4', '#E8A5C8', '#F1BD6C', '#5DA283', '#6D6E6F'])[floor(random() * 8 + 1)::int]
$$;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null,
  initials text not null,
  avatar_url text,
  avatar_color text default random_avatar_color(),
  can_create_projects boolean not null default false,
  is_super_admin boolean not null default false,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default '#4573D2',
  icon text default '📋',
  "position" float default 0,
  archived boolean default false,
  is_private boolean not null default false,
  accepts_tickets boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- one private project per person
create unique index projects_one_private_per_user on projects (created_by) where is_private;

create table headings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  "position" float default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_headings_project_id on headings(project_id);

alter table projects add column ticket_heading_id uuid references headings(id) on delete set null;

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  -- the app embeds profiles through this constraint's name: project_members_profile_id_fkey
  profile_id uuid references profiles(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  invited_at timestamptz default now(),
  joined_at timestamptz,
  primary key (project_id, email)
);
create index idx_project_members_project_id on project_members(project_id);
create index idx_project_members_profile_id on project_members(profile_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  heading_id uuid references headings(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete set null,
  name text not null,
  description text,
  assignee_id uuid references auth.users(id) on delete set null,
  due_date date,
  due_locked boolean not null default false,
  priority priority,
  repeat text check (repeat in ('daily', 'weekly', 'monthly', 'monthly_weekday', 'monthly_last_weekday', 'yearly')),
  completed boolean not null default false,
  completed_at timestamptz,
  "position" float default 0,
  ticket_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null
);
create index idx_tasks_project_id on tasks(project_id);
create index idx_tasks_heading_id on tasks(heading_id);
create index idx_tasks_parent_task_id on tasks(parent_task_id);
create index idx_tasks_assignee_id on tasks(assignee_id);
create index idx_tasks_completed on tasks(completed);
create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_deleted_at on tasks(deleted_at) where deleted_at is not null;
create index idx_tasks_ticket_by on tasks(ticket_by) where ticket_by is not null;

create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null,
  mentions text[] default array[]::text[],
  requested_due_date date,
  request_status text check (request_status in ('pending', 'approved', 'declined')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index idx_comments_task_id on comments(task_id);
create index idx_comments_author_id on comments(author_id);

create table followers (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, user_id)
);
create index idx_followers_user_id on followers(user_id);

create table tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#4573D2',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table task_tags (
  task_id uuid not null references tasks(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (task_id, tag_id)
);
create index idx_task_tags_tag on task_tags(tag_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- the app embeds tasks through this constraint's name: notifications_task_id_fkey
  task_id uuid not null references tasks(id) on delete cascade,
  type text not null check (type in ('comment', 'mention', 'assigned', 'due_soon', 'completed', 'updated', 'ticket', 'liked')),
  actor_id uuid references auth.users(id) on delete set null,
  comment_id uuid references comments(id) on delete cascade,
  detail text,
  read_at timestamptz,
  created_at timestamptz default now()
);
create index idx_notifications_user_id on notifications(user_id);
create index idx_notifications_task_id on notifications(task_id);
create index idx_notifications_read_at on notifications(read_at);

create table task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz default now()
);
create index idx_task_activity_task_id on task_activity(task_id);

create table comment_likes (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

create table task_likes (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, user_id)
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'Supplier'
    check (kind in ('Staff', 'Supplier', 'Subcontractor', 'Client', 'Venue', 'Other')),
  name text not null default '',
  company text not null default '',
  role text not null default '',
  phone text not null default '',
  email text not null default '',
  tags text[] not null default '{}',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint contacts_has_a_name check (name <> '' or company <> '')
);

-- access helpers (security definer so policies can call them without RLS recursing) -----

create or replace function project_role(p_project_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from project_members where project_id = p_project_id and profile_id = auth.uid()
$$;

create or replace function is_super_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false)
$$;

create or replace function project_is_private(p_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_private from projects where id = p_project_id), false)
$$;

-- members, the creator, and super admins (shared projects only)
create or replace function can_see_project(p_project_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select auth.role() = 'authenticated' and (
    exists (select 1 from project_members where project_id = p_project_id and profile_id = auth.uid())
    or exists (select 1 from projects where id = p_project_id and created_by = auth.uid())
    or (not project_is_private(p_project_id) and is_super_admin())
  )
$$;

-- ...plus whoever raised it, if it's a ticket
create or replace function can_see_task(p_task_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    (select can_see_project(t.project_id) or t.ticket_by = auth.uid() from tasks t where t.id = p_task_id),
    false
  )
$$;

create or replace function task_is_private(p_task_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(project_is_private((select project_id from tasks where id = p_task_id)), false)
$$;

create or replace function can_see_comment(p_comment_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select can_see_task((select task_id from comments where id = p_comment_id))
$$;

create or replace function is_project_manager(p_project_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(project_role(p_project_id) in ('owner', 'admin'), false) or is_super_admin()
$$;

-- The folder name is checked before the cast, so a file with an odd name is simply hidden.
create or replace function can_see_task_photo(p_name text)
returns boolean language sql stable set search_path = public as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then can_see_task(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;

-- profiles ---------------------------------------------------------------------

-- Same rule as avatarInitials() in lib/avatar.ts.
create or replace function name_initials(p_name text)
returns text language sql immutable as $$
  select case
    when array_length(w, 1) >= 2 then upper(left(w[1], 1) || left(w[array_length(w, 1)], 1))
    else upper(left(coalesce(w[1], '?'), 2))
  end
  from (select regexp_split_to_array(trim(coalesce(p_name, '')), '\s+') as w) x
$$;

-- Sign-up (including an accepted invite) makes the profile. api/invite.ts upserts one too, as a fallback.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
begin
  insert into profiles (id, email, name, initials)
  values (new.id, coalesce(lower(new.email), ''), v_name, name_initials(v_name))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Whoever made the row can't have picked a colour yet, so blue/null gets a random one.
create or replace function profiles_random_avatar_color()
returns trigger language plpgsql as $$
begin
  if NEW.avatar_color is null or NEW.avatar_color = '#4573D2' then
    NEW.avatar_color := random_avatar_color();
  end if;
  return NEW;
end $$;

create trigger profiles_random_avatar_color_trigger
  before insert on profiles
  for each row execute function profiles_random_avatar_color();

-- Nobody can grant themselves admin. A null auth.uid() (service role: /api/admin/*, the SQL
-- editor) is let through; those routes check the real caller first.
create or replace function protect_privilege_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.is_super_admin is distinct from OLD.is_super_admin
     or NEW.can_create_projects is distinct from OLD.can_create_projects then
    if auth.uid() is not null
       and not exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
      NEW.is_super_admin := OLD.is_super_admin;
      NEW.can_create_projects := OLD.can_create_projects;
    end if;
  end if;
  return NEW;
end $$;

create trigger protect_privilege_columns_trigger
  before update on profiles
  for each row execute function protect_privilege_columns();

-- Everyone gets one "My Private Project". Idempotent.
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

create or replace function profiles_create_private_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform create_private_project(NEW.id, NEW.email);
  return NEW;
end $$;

create trigger profiles_private_project_trigger
  after insert on profiles
  for each row execute function profiles_create_private_project();

-- tasks: repeats ---------------------------------------------------------------

create or replace function next_repeat_date(d date, r text) returns date
language plpgsql immutable as $$
declare
  next_month date := (date_trunc('month', d) + interval '1 month')::date;
  next_month_end date := (date_trunc('month', d) + interval '2 months' - interval '1 day')::date;
  dow int := extract(dow from d);
  nth int := (extract(day from d)::int - 1) / 7 + 1;
  first_dow date;
begin
  if r = 'daily' then return d + 1; end if;
  if r = 'weekly' then return d + 7; end if;
  if r = 'yearly' then return (d + interval '1 year')::date; end if;

  if r = 'monthly' then
    -- ponytail: a "28th of every month" task drifts to the 31st after February; store the anchor day if needed.
    if d = (date_trunc('month', d) + interval '1 month' - interval '1 day')::date then
      return next_month_end;
    end if;
    return (d + interval '1 month')::date;
  end if;

  -- a 5th weekday doesn't exist every month, so it's treated as "the last"
  if r = 'monthly_last_weekday' or (r = 'monthly_weekday' and nth = 5) then
    return next_month_end - ((extract(dow from next_month_end)::int - dow + 7) % 7);
  end if;

  if r = 'monthly_weekday' then
    first_dow := next_month + ((dow - extract(dow from next_month)::int + 7) % 7);
    return first_dow + 7 * (nth - 1);
  end if;

  return null;
end
$$;

-- Ticking a repeating task makes its next copy; a repeating subtask rolls on in place.
create or replace function spawn_repeat() returns trigger
language plpgsql as $$
declare
  -- ponytail: one zone for everyone; make it per-profile if the team spreads across zones
  today date := (now() at time zone 'Asia/Colombo')::date;
  base date := coalesce(new.due_date, today);
  next_due date;
  new_id uuid := gen_random_uuid();
  next_task tasks%rowtype;
begin
  if new.repeat is null or new.deleted_at is not null or not new.completed or old.completed then
    return new;
  end if;

  next_due := next_repeat_date(base, new.repeat);
  while next_due < today loop
    next_due := next_repeat_date(next_due, new.repeat);
  end loop;

  if new.parent_task_id is not null then
    new.due_date := next_due;
    new.completed := false;
    new.completed_at := null;
    return new;
  end if;

  -- copy the whole row, so columns added later carry over without touching this
  next_task := new;
  next_task.id := new_id;
  next_task.due_date := next_due;
  next_task.completed := false;
  next_task.completed_at := null;
  next_task.position := (select coalesce(max(position), -1) + 1 from tasks where project_id = new.project_id and parent_task_id is null);
  next_task.created_by := auth.uid();
  next_task.created_at := now();
  insert into tasks select next_task.*;

  insert into tasks (project_id, parent_task_id, name, description, assignee_id, due_date, priority, position, repeat, created_by)
  select project_id, new_id, name, description, assignee_id, due_date + (next_due - base), priority, position, repeat, auth.uid()
  from tasks where parent_task_id = new.id and deleted_at is null;

  insert into task_tags (task_id, tag_id) select new_id, tag_id from task_tags where task_id = new.id;
  insert into followers (task_id, user_id) select new_id, user_id from followers where task_id = new.id;

  -- the repeat moves to the new copy, so un-ticking and re-ticking this one can't spawn a second
  new.repeat := null;
  return new;
end
$$;

create trigger tasks_spawn_repeat
  before update of completed on tasks
  for each row execute function spawn_repeat();

-- tasks/comments: locked due dates and extension requests ---------------------------

create or replace function guard_locked_due_date() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null or is_project_manager(old.project_id) then return new; end if;
  if new.due_locked is distinct from old.due_locked then
    raise exception 'Only a project manager can lock or unlock a due date';
  end if;
  if old.due_locked and new.due_date is distinct from old.due_date then
    raise exception 'This due date is locked. Ask for an extension instead';
  end if;
  return new;
end
$$;

create trigger tasks_guard_locked_due_date
  before update of due_locked, due_date on tasks
  for each row execute function guard_locked_due_date();

-- Comments belong to their author; only managers answer extension requests.
-- merge_tasks sets app.merging_tasks to move other people's comments.
create or replace function guard_extension_request() returns trigger
language plpgsql as $$
declare
  p uuid := (select project_id from tasks where id = new.task_id);
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.author_id is distinct from auth.uid() then
      raise exception 'You can only comment as yourself';
    end if;
    if new.request_status is not null and new.request_status <> 'pending' then
      raise exception 'A new extension request must be pending';
    end if;
    return new;
  end if;

  if current_setting('app.merging_tasks', true) = '1' then return new; end if;

  if auth.uid() is not null and (
       new.author_id is distinct from old.author_id
       or new.task_id is distinct from old.task_id
       or (old.author_id is distinct from auth.uid() and (
            new.body is distinct from old.body
            or new.mentions is distinct from old.mentions
            or new.edited_at is distinct from old.edited_at
            or new.deleted_at is distinct from old.deleted_at))
     ) then
    raise exception 'Only the author can edit or delete a comment';
  end if;

  if new.request_status is distinct from old.request_status
     or new.requested_due_date is distinct from old.requested_due_date then
    if auth.uid() is not null and not is_project_manager(p) then
      raise exception 'Only a project manager can approve or decline an extension';
    end if;
  end if;
  return new;
end
$$;

create trigger comments_guard_extension_request
  before insert or update on comments
  for each row execute function guard_extension_request();

create or replace function notify_extension_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, task_id, type, actor_id, comment_id, detail)
  select pm.profile_id, new.task_id, 'comment', new.author_id, new.id,
         'asked to move the due date to ' || to_char(new.requested_due_date, 'FMDD Mon YYYY')
  from tasks t
  join project_members pm on pm.project_id = t.project_id and pm.role in ('owner', 'admin')
  where t.id = new.task_id
    and pm.profile_id is not null
    and pm.profile_id <> new.author_id
    and not exists (select 1 from followers f where f.task_id = new.task_id and f.user_id = pm.profile_id);
  return new;
end
$$;

create trigger comments_notify_extension_request
  after insert on comments
  for each row when (new.requested_due_date is not null)
  execute function notify_extension_request();

-- Comment count per task for the task list (lib/supabase/queries.ts). Runs as the caller, so RLS applies.
create or replace function get_comment_counts(task_ids uuid[])
returns table (task_id uuid, count int)
language sql stable as $$
  select c.task_id, count(*)::int from comments c
  where c.task_id = any(task_ids) and c.deleted_at is null
  group by c.task_id
$$;

-- likes ------------------------------------------------------------------------

-- Tells whoever last ticked the task off, or failing that its assignee. Never the liker.
create or replace function notify_task_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_to uuid;
begin
  select actor_id into v_to from task_activity
  where task_id = new.task_id and message = 'marked the task complete'
  order by created_at desc limit 1;
  if v_to is null then
    select assignee_id into v_to from tasks where id = new.task_id;
  end if;
  if v_to is not null and v_to <> new.user_id then
    insert into notifications (user_id, task_id, type, actor_id) values (v_to, new.task_id, 'liked', new.user_id);
  end if;
  return new;
end
$$;

create trigger task_likes_notify
  after insert on task_likes
  for each row execute function notify_task_like();

-- tickets ----------------------------------------------------------------------

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

create or replace function ticket_projects()
returns table (id uuid, name text, icon text, color text)
language sql security definer stable set search_path = public as $$
  select p.id, p.name, p.icon, p.color
  from projects p
  where p.accepts_tickets and not p.archived and not p.is_private and auth.uid() is not null
  order by p.name
$$;

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

create or replace function ticket_people(p_task_id uuid)
returns table (id uuid, name text)
language sql security definer stable set search_path = public as $$
  select pr.id, pr.name
  from tasks t
  join project_members pm on pm.project_id = t.project_id
  join profiles pr on pr.id = pm.profile_id
  where t.id = p_task_id and t.ticket_by = auth.uid() and pr.id <> auth.uid()
  order by pr.name
$$;

-- merging ----------------------------------------------------------------------

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

  insert into comments (task_id, author_id, body)
  values (p_keep, v_me, replace(
    'Merged in "' || r.name || '"'
      || coalesce(E'\nAssignee: ' || (select name from profiles where id = r.assignee_id), '')
      || coalesce(E'\nDue: ' || to_char(r.due_date, 'FMDD Mon YYYY'), '')
      || coalesce(E'\nPriority: ' || r.priority::text, '')
      || case when r.completed then E'\nIt was completed' else '' end
      || coalesce(E'\n\n' || nullif(trim(r.description), ''), ''),
    v_from, v_to));

  perform set_config('app.merging_tasks', '1', true);
  update comments set
    task_id = p_keep,
    body = replace(body, v_from, v_to),
    -- asked about the other task's date, so it can't be approved here
    request_status = case when request_status = 'pending' then 'declined' else request_status end
  where task_id = p_remove;
  perform set_config('app.merging_tasks', '', true);

  update task_activity set task_id = p_keep where task_id = p_remove;
  insert into task_activity (task_id, actor_id, message)
  values (p_keep, v_me, 'merged "' || r.name || '" into this task');

  -- a private project's tasks are only ever its owner's
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

  update notifications set task_id = p_keep where task_id = p_remove and user_id = any(v_allowed);

  update tasks set deleted_at = now(), deleted_by = v_me where id = p_remove;

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

-- row-level security -------------------------------------------------------------

alter table profiles enable row level security;
create policy "Authenticated users can view profiles" on profiles
  for select using (auth.role() = 'authenticated');
create policy "Users can edit their own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

alter table projects enable row level security;
-- inline, not can_see_project(): INSERT ... RETURNING runs before the creator's member row exists
create policy "Authenticated users can view projects" on projects
  for select using (
    auth.role() = 'authenticated' and (
      created_by = auth.uid()
      or project_role(id) is not null
      or (not is_private and is_super_admin())
    )
  );
create policy "Permitted users can create projects" on projects
  for insert with check (
    is_private = false
    and exists (select 1 from profiles where id = auth.uid() and can_create_projects = true)
  );
create policy "Owners and admins can edit their project" on projects
  for update using (
    project_role(id) in ('owner', 'admin')
    or not exists (select 1 from project_members where project_id = projects.id)
  )
  with check (
    is_private = project_is_private(id)
    and (not is_private or archived = false)
  );
create policy "Owners can delete their project" on projects
  for delete using (
    not is_private
    and (
      project_role(id) = 'owner'
      or is_super_admin()
      or not exists (select 1 from project_members where project_id = projects.id)
    )
  );

alter table project_members enable row level security;
create policy "Authenticated users can view members" on project_members
  for select using (can_see_project(project_id));
create policy "Owners and admins can add members" on project_members
  for insert with check (
    not project_is_private(project_id)
    and (
      project_role(project_id) = 'owner'
      or (project_role(project_id) = 'admin' and role <> 'owner')
      or (
        profile_id = auth.uid() and role in ('owner', 'admin')
        and not exists (select 1 from project_members m where m.project_id = project_members.project_id)
      )
    )
  );
create policy "Owners and admins can remove non-owner members" on project_members
  for delete using (
    not project_is_private(project_id)
    and (
      project_role(project_id) = 'owner'
      or (project_role(project_id) = 'admin' and role <> 'owner')
    )
  );
create policy "Owners can change member roles" on project_members
  for update using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

alter table tasks enable row level security;
create policy "Visible projects only" on tasks
  for all
  using (can_see_project(project_id))
  with check (
    can_see_project(project_id)
    and (assignee_id is null or assignee_id = auth.uid() or not project_is_private(project_id))
  );
-- read-only: "Visible projects only" is the only policy that allows writes
create policy "Own tickets" on tasks
  for select using (ticket_by = auth.uid());

alter table headings enable row level security;
create policy "Visible projects only" on headings
  for all using (can_see_project(project_id)) with check (can_see_project(project_id));

alter table comments enable row level security;
create policy "Visible projects only" on comments
  for all using (can_see_task(task_id)) with check (can_see_task(task_id));

alter table task_tags enable row level security;
create policy "Visible projects only" on task_tags
  for all using (can_see_task(task_id)) with check (can_see_task(task_id));

alter table task_activity enable row level security;
create policy "Visible projects only" on task_activity
  for all using (can_see_task(task_id)) with check (can_see_task(task_id));

alter table followers enable row level security;
create policy "Visible projects only" on followers
  for all
  using (can_see_task(task_id))
  with check (can_see_task(task_id) and (user_id = auth.uid() or not task_is_private(task_id)));

alter table notifications enable row level security;
create policy "Own notifications only" on notifications
  for select using (user_id = auth.uid());
create policy "Own notifications update" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own notifications delete" on notifications
  for delete using (user_id = auth.uid());
-- notifying other people is how follows/assignments/mentions work; private tasks only notify yourself
create policy "Notify only people who can see the task" on notifications
  for insert with check (
    auth.role() = 'authenticated'
    and can_see_task(task_id)
    and (user_id = auth.uid() or not task_is_private(task_id))
  );

alter table comment_likes enable row level security;
create policy "Visible comments only" on comment_likes
  for all using (can_see_comment(comment_id)) with check (can_see_comment(comment_id) and user_id = auth.uid());

alter table task_likes enable row level security;
create policy "Visible tasks only" on task_likes
  for all using (can_see_task(task_id)) with check (can_see_task(task_id) and user_id = auth.uid());

alter table tags enable row level security;
create policy "Authenticated users full access" on tags
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table contacts enable row level security;
create policy "Everyone reads contacts" on contacts
  for select using (auth.role() = 'authenticated');
create policy "Everyone adds contacts" on contacts
  for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
create policy "Everyone edits contacts" on contacts
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Adder or admin deletes contacts" on contacts
  for delete using (created_by = auth.uid() or is_super_admin());
-- editing can't change who added a contact (that's who may delete it)
revoke update on contacts from authenticated;
grant update (kind, name, company, role, phone, email, tags, notes, updated_at) on contacts to authenticated;

-- storage ------------------------------------------------------------------------

-- Profile photos: public, each person writes only in avatars/<their id>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar upload own folder" on storage.objects;
drop policy if exists "Avatar update own folder" on storage.objects;
drop policy if exists "Avatar delete own folder" on storage.objects;
create policy "Avatar upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Avatar update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Avatar delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Task photos and files: private, task-photos/<task id>/..., for whoever can see the task.
-- No update/delete policy: the nightly purge (service role) clears them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 10485760, array[
  'image/jpeg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Task photos visible with the task" on storage.objects;
drop policy if exists "Task photos added with the task" on storage.objects;
create policy "Task photos visible with the task" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-photos' and can_see_task_photo(name));
create policy "Task photos added with the task" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-photos' and can_see_task_photo(name));

-- realtime: the inbox listens for new notifications (lib/useInbox.ts) --------------

alter publication supabase_realtime add table notifications;

-- first users ----------------------------------------------------------------------

-- Anyone already added under Authentication > Users gets a profile (and private project) now.
insert into profiles (id, email, name, initials)
select u.id, coalesce(lower(u.email), ''), split_part(coalesce(u.email, ''), '@', 1), name_initials(split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
on conflict (id) do nothing;

-- The site admin. If you add this account after running this file, run this line again.
update profiles set is_super_admin = true, can_create_projects = true where email = 'tom@tuktukrental.com';

-- self-checks: the editor shows an error here if something is wrong
do $$ begin
  assert next_repeat_date('2026-04-30', 'monthly') = '2026-05-31';
  assert next_repeat_date('2026-01-31', 'monthly') = '2026-02-28';
  assert next_repeat_date('2026-10-15', 'monthly_weekday') = '2026-11-19';
  assert next_repeat_date('2026-10-29', 'monthly_last_weekday') = '2026-11-26';
  assert name_initials('Ada Lovelace') = 'AL';
  assert name_initials('tom') = 'TO';
  assert name_initials('  Mary Ann  Smith ') = 'MS';
end $$;
