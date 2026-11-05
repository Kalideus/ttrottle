-- 047_ticket_access.sql
-- Who sees tickets (Create ticket and My tickets in the sidebar): on for everyone until a super admin
-- unticks them in /admin/team. Super admins always see them.
-- Like can_see_performance (045), nobody can change it for themselves.
-- Run after 046. Safe to re-run.

alter table profiles add column if not exists can_see_tickets boolean not null default true;

-- 046's guard, plus the new column
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
     or NEW.can_reset_passwords is distinct from OLD.can_reset_passwords
     or NEW.can_see_tickets is distinct from OLD.can_see_tickets then
    if auth.uid() is not null
       and not exists (select 1 from profiles where id = auth.uid() and is_super_admin = true) then
      NEW.is_super_admin := OLD.is_super_admin;
      NEW.can_create_projects := OLD.can_create_projects;
      NEW.can_see_performance := OLD.can_see_performance;
      NEW.can_reset_passwords := OLD.can_reset_passwords;
      NEW.can_see_tickets := OLD.can_see_tickets;
    end if;
  end if;
  return NEW;
end;
$$;
