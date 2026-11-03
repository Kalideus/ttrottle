-- 045_performance_access.sql
-- Who sees the Performance dashboard (and the 🎯 marks on tasks): off for everyone until a super admin
-- ticks them in /admin/team. Super admins always see it. 🎯 flags keep being set either way, so the
-- numbers are there when it's switched on.
-- Like can_create_projects (014), nobody can switch it on for themselves.
-- Run after 044. Safe to re-run.

alter table profiles add column if not exists can_see_performance boolean not null default false;

-- 014's guard, plus the new column
create or replace function protect_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.is_super_admin is distinct from OLD.is_super_admin
     or NEW.can_create_projects is distinct from OLD.can_create_projects
     or NEW.can_see_performance is distinct from OLD.can_see_performance then
    if auth.uid() is not null
       and not exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
      NEW.is_super_admin := OLD.is_super_admin;
      NEW.can_create_projects := OLD.can_create_projects;
      NEW.can_see_performance := OLD.can_see_performance;
    end if;
  end if;
  return NEW;
end;
$$;
