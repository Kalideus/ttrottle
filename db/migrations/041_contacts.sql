-- 041_contacts.sql
-- A shared contacts list: staff, suppliers, subcontractors, clients, venues. One row per person
-- (or a company-only row). Everyone signed in can see, add and edit; only whoever added a contact,
-- or a site admin, can delete it. Departments are a fixed list that only site admins change.
-- Run after 021 (is_super_admin). Safe to re-run.

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 0,
  created_at timestamptz default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'Supplier'
    check (kind in ('Staff', 'Supplier', 'Subcontractor', 'Client', 'Venue', 'Other')),
  name text not null default '',
  company text not null default '',
  role text not null default '',
  phone text not null default '',
  email text not null default '',
  -- free tags: what they supply or do ("Printing", "Bus hire")
  services text[] not null default '{}',
  -- departments.id; a deleted department just stops showing
  department_ids uuid[] not null default '{}',
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint contacts_has_a_name check (name <> '' or company <> '')
);

alter table departments enable row level security;
alter table contacts enable row level security;

drop policy if exists "Everyone reads departments" on departments;
create policy "Everyone reads departments" on departments
  for select using (auth.role() = 'authenticated');
drop policy if exists "Admins change departments" on departments;
create policy "Admins change departments" on departments
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists "Everyone reads contacts" on contacts;
create policy "Everyone reads contacts" on contacts
  for select using (auth.role() = 'authenticated');
drop policy if exists "Everyone adds contacts" on contacts;
create policy "Everyone adds contacts" on contacts
  for insert with check (auth.role() = 'authenticated' and created_by = auth.uid());
drop policy if exists "Everyone edits contacts" on contacts;
create policy "Everyone edits contacts" on contacts
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Adder or admin deletes contacts" on contacts;
create policy "Adder or admin deletes contacts" on contacts
  for delete using (created_by = auth.uid() or is_super_admin());

-- editing can't change who added a contact (that's who may delete it)
revoke update on contacts from authenticated;
grant update (kind, name, company, role, phone, email, services, department_ids, notes, updated_at) on contacts to authenticated;

insert into departments (name, position) values
  ('Marketing', 1),
  ('Sales', 2),
  ('Customer Service', 3),
  ('Ops & Fleet', 4),
  ('Mechanics & Spares', 5),
  ('Emergency Response', 6),
  ('Finance', 7),
  ('People and Culture', 8),
  ('Tech', 9),
  ('Public Relations', 10),
  ('Facilities & Admin', 11)
on conflict (name) do nothing;
