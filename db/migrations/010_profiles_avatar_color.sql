-- 010_profiles_avatar_color.sql
-- Per-user avatar colour, chosen in the in-app profile section. Initials are
-- derived from the name (first initial + last initial) and kept in profiles.initials.

alter table profiles add column if not exists avatar_color text default '#4573D2';
