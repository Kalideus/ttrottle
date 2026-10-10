-- 035_ticket_mentions.sql
-- Whoever raised a ticket can @mention the team it went to. They can't read that
-- project's member list (031), so this hands out names only, and only for their own ticket.
-- Run after 034. Safe to re-run.

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
