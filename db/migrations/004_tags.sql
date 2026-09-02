-- 004: Add tags and task_tags for tagging tasks
-- Run this in Supabase SQL Editor after 003

-- Tags (shared across all projects)
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#4573D2',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Join table: which tasks have which tags
create table public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  primary key (task_id, tag_id)
);

create index idx_task_tags_tag on public.task_tags(tag_id);

alter table public.tags enable row level security;
alter table public.task_tags enable row level security;

create policy "Authenticated users full access" on public.tags
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated users full access" on public.task_tags
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
