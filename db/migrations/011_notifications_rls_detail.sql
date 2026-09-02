-- 011_notifications_rls_detail.sql
-- If RLS got enabled on notifications (e.g. via the dashboard) with no policy,
-- every insert/select is silently dropped -- the same failure task_activity hit
-- in migration 008. Make the state explicit and permissive for signed-in users.

alter table notifications enable row level security;

drop policy if exists "Authenticated users full access" on notifications;
create policy "Authenticated users full access" on notifications
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Human summary of what changed ("changed the due date to 12 Sep", comment text, ...).
alter table notifications add column if not exists detail text;
