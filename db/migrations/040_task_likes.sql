-- 040_task_likes.sql
-- A heart on a finished task, given from the inbox. One row per (task, user), like
-- comment_likes (015/017). Whoever ticked the task off is told with a 'liked' notification.
-- Run after 031. Safe to re-run.

create table if not exists task_likes (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (task_id, user_id)
);

alter table task_likes enable row level security;

drop policy if exists "Visible tasks only" on task_likes;
create policy "Visible tasks only" on task_likes
  for all using (can_see_task(task_id)) with check (can_see_task(task_id) and user_id = auth.uid());

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('comment', 'mention', 'assigned', 'due_soon', 'completed', 'updated', 'ticket', 'liked'));

-- Tells whoever last ticked the task off (from its activity; the app logs 'marked the task complete'),
-- or failing that whoever it is assigned to. Never the person giving the like.
create or replace function notify_task_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_to uuid;
begin
  select actor_id into v_to from task_activity
  where task_id = new.task_id and message = 'marked the task complete'
  order by created_at desc limit 1;
  if v_to is null then
    select assignee_id into v_to from tasks where id = new.task_id;
  end if;
  if v_to is not null and v_to <> new.user_id then
    insert into notifications (user_id, task_id, type, actor_id) values (v_to, new.task_id, 'liked', new.user_id);
  end if;
  return new;
end
$$;

drop trigger if exists task_likes_notify on task_likes;
create trigger task_likes_notify
  after insert on task_likes
  for each row execute function notify_task_like();
