-- 013_soft_delete_tasks.sql
-- Soft-delete for tasks: deleting now just stamps deleted_at/deleted_by
-- instead of removing the row, so it's recoverable and anyone can delete
-- (not just the creator/project owner/admin) without it being permanent.
-- Purged for real after 90 days by the cron route. A site-wide admin flag
-- (separate from the per-project owner/admin roles) can see and restore
-- deleted tasks across every project via /admin/deleted-tasks.

alter table tasks add column if not exists deleted_at timestamptz;
alter table tasks add column if not exists deleted_by uuid references auth.users(id);
create index if not exists idx_tasks_deleted_at on tasks(deleted_at) where deleted_at is not null;

alter table profiles add column if not exists is_super_admin boolean not null default false;
update profiles set is_super_admin = true where email = 't.j.cornish@gmail.com';
