-- 009_profiles_last_seen.sql
-- Tracks when each user last opened the app, so "My tasks" can badge how many
-- tasks were assigned to them since their previous session (cross-device).

alter table profiles add column if not exists last_seen_at timestamptz;
