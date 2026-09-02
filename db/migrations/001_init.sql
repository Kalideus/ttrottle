-- 001_init.sql
-- Initial database schema for ttrottle (Supabase/Postgres)

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE project_status AS ENUM ('Not Started','Active','On Hold','Completed','Archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('Not Started','In Progress','Waiting','Completed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority') THEN
        CREATE TYPE priority AS ENUM ('Low','Normal','High','Urgent');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'frequency') THEN
        CREATE TYPE frequency AS ENUM ('daily','weekly','monthly','annually');
    END IF;
END $$;

-- Users / profiles
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  role text DEFAULT 'user',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status project_status DEFAULT 'Not Started',
  start_date date,
  target_date date,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tasks (initially created without recurrence FK because task_recurrences references tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  parent_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  level smallint NOT NULL CHECK (level IN (1,2)),
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status task_status DEFAULT 'Not Started',
  priority priority DEFAULT 'Normal',
  due_date date,
  completed_at timestamptz,
  -- recurrence_id to be added after task_recurrences exists
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived boolean DEFAULT false
);

-- Task recurrences
CREATE TABLE IF NOT EXISTS task_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  level smallint NOT NULL CHECK (level IN (1,2)),
  parent_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  parent_recurrence_id uuid REFERENCES task_recurrences(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  priority priority DEFAULT 'Normal',
  frequency frequency,
  interval_count integer DEFAULT 1,
  anchor_date date,
  next_due_date date,
  due_offset_days integer DEFAULT 0,
  active boolean DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT task_recurrences_parent_mode_check CHECK (
    (level = 1 AND parent_task_id IS NULL AND parent_recurrence_id IS NULL)
    OR (level = 2 AND ((parent_task_id IS NOT NULL)::int + (parent_recurrence_id IS NOT NULL)::int = 1))
  ),
  CONSTRAINT task_recurrences_schedule_check CHECK (
    (
      level = 1
      AND parent_task_id IS NULL
      AND parent_recurrence_id IS NULL
      AND frequency IS NOT NULL
      AND interval_count IS NOT NULL
      AND anchor_date IS NOT NULL
      AND next_due_date IS NOT NULL
    )
    OR (
      level = 2
      AND parent_task_id IS NOT NULL
      AND parent_recurrence_id IS NULL
      AND frequency IS NOT NULL
      AND interval_count IS NOT NULL
      AND anchor_date IS NOT NULL
      AND next_due_date IS NOT NULL
    )
    OR (
      level = 2
      AND parent_task_id IS NULL
      AND parent_recurrence_id IS NOT NULL
      AND frequency IS NULL
      AND interval_count IS NULL
      AND anchor_date IS NULL
      AND next_due_date IS NULL
    )
  )
);

-- Now add recurrence_id FK and unique constraint on (recurrence_id, due_date)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurrence_id uuid,
  ADD CONSTRAINT IF NOT EXISTS tasks_recurrence_unique UNIQUE (recurrence_id, due_date);

ALTER TABLE tasks
  ADD CONSTRAINT IF NOT EXISTS tasks_recurrence_fk FOREIGN KEY (recurrence_id) REFERENCES task_recurrences(id) ON DELETE SET NULL;

-- Task dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now()
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Attachments (store storage path, signed URLs will be used for access)
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz DEFAULT now()
);

-- Task activity log
CREATE TABLE IF NOT EXISTS task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

-- Trigger: set level based on parent_task_id and enforce parent level = 1; inherit project_id for level 2
CREATE OR REPLACE FUNCTION tasks_set_level_and_validate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_level smallint;
  parent_project uuid;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.parent_task_id IS NULL THEN
      NEW.level := 1;
    ELSE
      -- ensure parent exists and is level 1
      SELECT level, project_id INTO parent_level, parent_project FROM tasks WHERE id = NEW.parent_task_id;
      IF parent_level IS NULL THEN
        RAISE EXCEPTION 'parent task % does not exist', NEW.parent_task_id;
      END IF;
      IF parent_level != 1 THEN
        RAISE EXCEPTION 'parent task % is not level 1', NEW.parent_task_id;
      END IF;
      NEW.level := 2;
      -- ensure child inherits parent's project
      NEW.project_id := parent_project;
    END IF;

    -- If status changed to Completed set completed_at, if changed from Completed clear it (application may also manage)
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'Completed' AND (OLD.status IS DISTINCT FROM 'Completed') THEN
        NEW.completed_at := now();
      ELSIF OLD.status = 'Completed' AND NEW.status != 'Completed' THEN
        NEW.completed_at := NULL;
      END IF;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tasks_level_trigger ON tasks;
CREATE TRIGGER tasks_level_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_set_level_and_validate();

CREATE OR REPLACE FUNCTION task_recurrences_validate_parent_and_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_task_level smallint;
  parent_recurrence_level smallint;
BEGIN
  IF NEW.level = 1 THEN
    IF NEW.parent_task_id IS NOT NULL OR NEW.parent_recurrence_id IS NOT NULL THEN
      RAISE EXCEPTION 'level 1 recurrences cannot have a parent task or parent recurrence';
    END IF;
    IF NEW.frequency IS NULL OR NEW.interval_count IS NULL OR NEW.anchor_date IS NULL OR NEW.next_due_date IS NULL THEN
      RAISE EXCEPTION 'level 1 recurrences require a frequency, interval count, anchor date and next due date';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.parent_task_id IS NOT NULL AND NEW.parent_recurrence_id IS NOT NULL THEN
    RAISE EXCEPTION 'a recurrence cannot have both a parent task and a parent recurrence';
  END IF;

  IF NEW.parent_task_id IS NOT NULL THEN
    SELECT level INTO parent_task_level FROM tasks WHERE id = NEW.parent_task_id;
    IF parent_task_level IS NULL THEN
      RAISE EXCEPTION 'parent task % does not exist', NEW.parent_task_id;
    END IF;
    IF parent_task_level != 1 THEN
      RAISE EXCEPTION 'parent task % is not level 1', NEW.parent_task_id;
    END IF;
    IF NEW.frequency IS NULL OR NEW.interval_count IS NULL OR NEW.anchor_date IS NULL OR NEW.next_due_date IS NULL THEN
      RAISE EXCEPTION 'mode 2 recurrences require an independent schedule';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.parent_recurrence_id IS NOT NULL THEN
    SELECT level INTO parent_recurrence_level FROM task_recurrences WHERE id = NEW.parent_recurrence_id;
    IF parent_recurrence_level IS NULL THEN
      RAISE EXCEPTION 'parent recurrence % does not exist', NEW.parent_recurrence_id;
    END IF;
    IF parent_recurrence_level != 1 THEN
      RAISE EXCEPTION 'parent recurrence % is not level 1', NEW.parent_recurrence_id;
    END IF;
    IF NEW.frequency IS NOT NULL OR NEW.interval_count IS NOT NULL OR NEW.anchor_date IS NOT NULL OR NEW.next_due_date IS NOT NULL THEN
      RAISE EXCEPTION 'mode 3 recurrences inherit the parent schedule and must not define their own';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_recurrences_validate_trigger ON task_recurrences;
CREATE TRIGGER task_recurrences_validate_trigger
  BEFORE INSERT OR UPDATE ON task_recurrences
  FOR EACH ROW EXECUTE FUNCTION task_recurrences_validate_parent_and_schedule();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Simple trigger to keep projects.updated_at current
CREATE OR REPLACE FUNCTION projects_update_timestamp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS projects_update_ts ON projects;
CREATE TRIGGER projects_update_ts
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION projects_update_timestamp();
