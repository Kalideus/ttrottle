-- 018_projects_policy_cleanup.sql
-- Private projects were still visible to everyone: policies are OR'd together, so
-- a leftover permissive policy on projects/project_members (created outside the
-- migration files, e.g. in the Supabase dashboard) defeats the privacy rule in 016.
-- Drops every policy on those two tables that isn't one of ours.

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and (
        (tablename = 'projects' and policyname not in (
          'Authenticated users can view projects',
          'Permitted users can create projects',
          'Owners and admins can edit their project',
          'Owners can delete their project'
        ))
        or
        (tablename = 'project_members' and policyname not in (
          'Authenticated users can view members',
          'Owners and admins can add members',
          'Owners and admins can remove non-owner members',
          'Owners can change member roles'
        ))
      )
  loop
    raise notice 'dropping % on %', r.policyname, r.tablename;
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Should list exactly 4 policies per table.
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('projects', 'project_members')
order by tablename, cmd;
