-- 032_task_photos.sql
-- Photos in task descriptions and comments. Private "task-photos" storage bucket;
-- each photo lives in its task's folder (task-photos/<task id>/<file>.jpg) and can
-- be read or added only by people who can see that task -- project members, and
-- whoever raised it if it's a ticket. Shown through short-lived signed links.
-- Run after 031. Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-photos', 'task-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The folder name is checked before the cast, so a file with an odd name is simply hidden.
create or replace function can_see_task_photo(p_name text)
returns boolean language sql stable set search_path = public as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then can_see_task(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;

drop policy if exists "Task photos visible with the task" on storage.objects;
drop policy if exists "Task photos added with the task" on storage.objects;

create policy "Task photos visible with the task" on storage.objects
  for select to authenticated
  using (bucket_id = 'task-photos' and can_see_task_photo(name));

-- No update or delete policy: a photo taken out of a comment stays in the bucket until the
-- nightly purge (src/pages/api/cron/purge-deleted-tasks.ts) clears its task's folder.
create policy "Task photos added with the task" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-photos' and can_see_task_photo(name));
