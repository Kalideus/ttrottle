-- 015_comment_likes.sql
-- Heart button on comments. One row per (comment, user).

create table if not exists comment_likes (
  comment_id uuid not null references comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

alter table comment_likes enable row level security;

create policy "Authenticated users full access" on comment_likes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
