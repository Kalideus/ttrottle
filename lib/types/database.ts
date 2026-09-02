export type Priority = 'low' | 'medium' | 'high'

export type Project = {
  id: string
  name: string
  color: string
  icon: string
  archived: boolean
  position: number
  created_by: string | null
  created_at: string
}

export type Heading = {
  id: string
  project_id: string
  name: string
  position: number
  created_at: string
}

export type Task = {
  id: string
  project_id: string
  heading_id: string | null
  parent_task_id: string | null
  name: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  priority: Priority | null
  completed: boolean
  completed_at: string | null
  position: number
  created_by: string | null
  created_at: string
}

export type Comment = {
  id: string
  task_id: string
  author_id: string
  body: string
  mentions: string[]
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

export type Tag = {
  id: string
  name: string
  color: string
  created_by: string | null
  created_at: string
}

export type TaskTag = {
  task_id: string
  tag_id: string
}

export type Profile = {
  id: string
  name: string
  email: string
  initials: string
  avatar_url: string | null
}

export type Notification = {
  id: string
  user_id: string
  task_id: string
  type: 'comment' | 'mention' | 'assigned' | 'due_soon' | 'completed'
  actor_id: string
  comment_id: string | null
  read_at: string | null
  created_at: string
}

export type UserViewPrefs = {
  user_id: string
  view_key: string
  filters: FilterDef[]
  sort_field: string | null
  sort_direction: 'asc' | 'desc'
  updated_at: string
}

export type FilterDef = {
  field: 'assignee' | 'due_date' | 'priority' | 'tag' | 'completion'
  operator: string
  value: string | string[] | null
}

export type TaskWithRelations = Task & {
  assignee: Profile | null
  subtasks: Task[]
  tags: Tag[]
  comment_count: number
}
