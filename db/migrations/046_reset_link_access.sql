-- 046_reset_link_access.sql
-- Who besides super admins can copy a password-reset link (Team & permissions): only for people who
-- share a project with them, never for a super admin (checked in /api/admin/reset-link). A reset link
-- signs whoever opens it in, so only a super admin can hand this out, and nobody can give it to themselves.
-- Run after 045. Safe to re-run.

alter table profiles add column if not exists can_reset_passwords boolean not null default false;

-- 045's guard, plus the new column
create or replace function protect_privilege_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.is_super_admin is distinct from OLD.is_super_admin
     or NEW.can_create_projects is distinct from OLD.can_create_projects
     or NEW.can_see_performance is distinct from OLD.can_see_performance
     or NEW.can_reset_passwords is distinct from OLD.can_reset_passwords then
    if auth.uid() is not null
       and not exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
      NEW.is_super_admin := OLD.is_super_admin;
      NEW.can_create_projects := OLD.can_create_projects;
      NEW.can_see_performance := OLD.can_see_performance;
      NEW.can_reset_passwords := OLD.can_reset_passwords;
    end if;
  end if;
  return NEW;
end;
$$;
