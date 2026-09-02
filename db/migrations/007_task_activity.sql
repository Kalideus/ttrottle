-- 007_task_activity.sql
-- A per-task activity log: "due date changed", "tag added", "follower added", etc.
-- Separate from comments (which are user-authored) and from notifications (which are
-- per-recipient inbox rows) — this is a single shared, chronological record per task.

CREATE TABLE IF NOT EXISTS task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity(task_id);
