// Data types for TukTuk Tasks app based on the spec

export type Priority = 'low' | 'medium' | 'high';

export type Project = {
  id: string;
  name: string;
  color: string;
  icon: string;
  archived: boolean;
  position: number;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type Heading = {
  id: string;
  projectId: string;
  name: string;
  position: number;
  created_at?: string;
};

export type Task = {
  id: string;
  projectId: string;
  headingId: string | null;
  parentTaskId: string | null;
  name: string;
  description: string | null;
  assigneeId: string | null;
  dueDate: string | null; // ISO date
  priority: Priority | null;
  completed: boolean;
  completedAt: string | null;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  subtasks?: Task[];
  assignee?: { id?: string; name?: string; initials?: string; email?: string } | null;
  comment_count?: number;
  tags?: Array<{ id?: string; name?: string; color?: string }>;
};

export type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  mentions: string[]; // user ids
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null; // soft delete
};

export type Follower = {
  taskId: string;
  userId: string;
};

export type NotificationType = 'comment' | 'mention' | 'assigned' | 'due_soon' | 'completed';

export type Notification = {
  id: string;
  userId: string;
  taskId: string;
  type: NotificationType;
  actorId: string;
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
  createdAt?: string;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: string;
};

export type TaskTag = {
  taskId: string;
  tagId: string;
  tag?: Tag; // optional populated tag object
};
