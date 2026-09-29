-- 014_profiles_rls_and_admin_helpers.sql
-- profiles had NO RLS at all -- any signed-in user could write is_super_admin
-- or can_create_projects on their own row (or anyone else's) directly via the
-- client and grant themselves admin. Closes that, while still letting people
-- edit their own name/avatar like the Profile modal already does.

alter table profiles enable row level security;

drop policy if exists "Authenticated users can view profiles" on profiles;
drop policy if exists "Users can edit their own profile" on profiles;

create policy "Authenticated users can view profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can edit their own profile" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- The update policy above still lets someone include is_super_admin/
-- can_create_projects in an update to their OWN row -- RLS can't diff old
-- vs. new column values, only a trigger can. This silently reverts those two
-- columns unless the caller is already a super admin. Triggers run for
-- every role including service_role (RLS bypass doesn't skip triggers), so
-- the null-auth.uid() case (no user JWT -- i.e. our own /api/admin/* routes
-- using the service-role key) is allowed through: those routes already do
-- their own is_super_admin check on the real caller before writing.
create or replace function protect_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
end;
$$;

drop trigger if exists protect_privilege_columns_trigger on profiles;
create trigger protect_privilege_columns_trigger
  before update on profiles
  for each row execute function protect_privilege_columns();
