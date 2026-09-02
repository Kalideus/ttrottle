-- 003: Add user_view_prefs table for per-user filter/sort persistence
-- Run this in Supabase SQL Editor after 001_initial_schema.sql

create table public.user_view_prefs (
  user_id        uuid not null references auth.users(id) on delete cascade,
  view_key       text not null,  -- 'my-tasks' or 'project:<projectId>'
  filters        jsonb not null default '[]',
  sort_field     text check (sort_field in ('due_date', 'priority', 'name', 'created_at')),
  sort_direction text not null default 'asc' check (sort_direction in ('asc', 'desc')),
  updated_at     timestamptz not null default now(),
  primary key (user_id, view_key)
);

alter table public.user_view_prefs enable row level security;

create policy "Own prefs only" on public.user_view_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
