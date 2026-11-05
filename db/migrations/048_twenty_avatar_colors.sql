-- 048_twenty_avatar_colors.sql
-- New people get a random colour from 20 instead of 8. The sign-up default and trigger from 019
-- already call random_avatar_color(), so only the palette changes. Existing colours are kept.
-- Palette must match AVATAR_COLORS in lib/avatar.ts.
-- Run after 047. Safe to re-run.

create or replace function random_avatar_color()
returns text language sql volatile as $$
  select (array[
    '#4573D2', '#F06A6A', '#A970D1', '#4ECBC4', '#E8A5C8', '#F1BD6C', '#5DA283', '#6D6E6F',
    '#D1453B', '#E8833A', '#B8860B', '#6A9E3F', '#2E9E8F', '#1F8FB8', '#2D4FA0', '#6457C6',
    '#8E44AD', '#C2448F', '#9C6B4E', '#3F4A5A'
  ])[floor(random() * 20 + 1)::int]
$$;
