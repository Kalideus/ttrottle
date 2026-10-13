-- 038_notifications_realtime.sql
-- The app listens for new notification rows over Supabase Realtime (src/pages/app.tsx), which only
-- sends changes for tables in the supabase_realtime publication. No migration ever added this one,
-- so unless it was switched on in the dashboard, notifications only showed up on the next reload.
-- Safe to run twice.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
