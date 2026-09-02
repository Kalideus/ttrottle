-- 002_tuktur_tasks_schema.sql
-- Schema for TukTuk Tasks app based on spec
-- This migration adjusts the existing schema to support the task management app spec

-- Drop and recreate priority enum with correct values
DROP TYPE IF EXISTS priority CASCADE;
CREATE TYPE priority AS ENUM ('low', 'medium', 'high');

-- Create heading/section table
CREATE TABLE IF NOT EXISTS headings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  "position" float DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_headings_project_id ON headings(project_id);

-- Update tasks table to match the spec
-- We'll keep the existing table and migrate columns

ALTER TABLE tasks
  DROP COLUMN IF EXISTS level CASCADE,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS task_status CASCADE,
  ADD COLUMN IF NOT EXISTS heading_id uuid REFERENCES headings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "position" float DEFAULT 0,
  RENAME COLUMN title TO name;

-- Handle due_date and add completed_at
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Update priority enum for tasks (in case it gets used)
ALTER TABLE tasks
  ALTER COLUMN priority TYPE priority USING CASE priority
    WHEN 'Low' THEN 'low'
    WHEN 'Normal' THEN 'medium'
    WHEN 'High' THEN 'high'
    WHEN 'Urgent' THEN 'high'
    ELSE 'medium'
  END;

-- Create followers table
CREATE TABLE IF NOT EXISTS followers (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followers_user_id ON followers(user_id);

-- Update comments table to match spec
ALTER TABLE comments
  RENAME COLUMN content TO body,
  RENAME COLUMN user_id TO author_id,
  ADD COLUMN IF NOT EXISTS mentions text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('comment', 'mention', 'assigned', 'due_soon', 'completed')),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);

-- Update projects table to add color and icon fields
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#4573D2',
  ADD COLUMN IF NOT EXISTS icon text DEFAULT '📋',
  ADD COLUMN IF NOT EXISTS "position" float DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_heading_id ON tasks(heading_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);

-- Update users table to add initials if needed
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS initials text;

-- Set default initials from full_name
UPDATE users
SET initials = SUBSTRING(full_name, 1, 1) || SUBSTRING(full_name, POSITION(' ' IN full_name) + 1, 1)
WHERE initials IS NULL AND full_name IS NOT NULL;

-- Seed some test data
INSERT INTO users (email, full_name, initials, avatar_url) VALUES
  ('alice@example.com', 'Alice Brown', 'AB', NULL),
  ('charlie@example.com', 'Charlie Davis', 'CD', NULL),
  ('emma@example.com', 'Emma Foster', 'EF', NULL),
  ('jamie@example.com', 'Jamie Kim', 'JK', NULL)
ON CONFLICT (email) DO NOTHING;

-- Create test projects if they don't exist
INSERT INTO projects (name, color, icon, position) VALUES
  ('Marketing Campaign', '#F06A6A', '📱', 0),
  ('Product Design', '#A970D1', '🎨', 1),
  ('Website Redesign', '#4ECBC4', '🌐', 2),
  ('Q4 Planning', '#E8A5C8', '📊', 3),
  ('Team Onboarding', '#F1BD6C', '👥', 4)
ON CONFLICT DO NOTHING;
