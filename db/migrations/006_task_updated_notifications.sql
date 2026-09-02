-- 006_task_updated_notifications.sql
-- Adds an 'updated' notification type so followers can be notified when a
-- task's fields change (not just on comments/assignment).

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('comment', 'mention', 'assigned', 'due_soon', 'completed', 'updated'));
