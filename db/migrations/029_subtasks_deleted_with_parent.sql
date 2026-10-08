-- 029_subtasks_deleted_with_parent.sql
-- Deleting a task now deletes its subtasks with it (lib/supabase/queries.ts deleteTask).
-- This catches up the ones left behind by earlier deletes: they were still showing in
-- My tasks and search with no parent to open. Same deleted_at as the parent, so
-- restoring the parent from /admin/deleted-tasks brings them back. Safe to re-run.

update tasks s
set deleted_at = p.deleted_at, deleted_by = p.deleted_by
from tasks p
where s.parent_task_id = p.id
  and p.deleted_at is not null
  and s.deleted_at is null;
