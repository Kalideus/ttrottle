-- 008_task_activity_rls.sql
-- task_activity was created without an RLS policy (unlike tags/project_members in
-- migrations 004/005, which explicitly enable RLS + grant authenticated access).
-- If this project enforces RLS by default, inserts/selects on task_activity would
-- silently fail with no policy present, matching the "activity log stays empty" symptom.

alter table task_activity enable row level security;

create policy "Authenticated users full access" on task_activity
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
