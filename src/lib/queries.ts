'use server';

import { supabase } from '@/src/lib/supabaseClient';
import { Project, Heading, Task, Comment, Notification, User } from '@/src/lib/types';

/**
 * Fetch all projects visible to the current user
 */
export async function fetchProjects(): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('archived', false)
      .order('position', { ascending: true });

    if (error) throw error;

    return (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color || '#4573D2',
      icon: p.icon || '📋',
      archived: p.archived,
      position: p.position || 0,
      owner_id: p.owner_id,
    }));
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
}

/**
 * Fetch headings for a project
 */
export async function fetchHeadings(projectId: string): Promise<Heading[]> {
  try {
    const { data, error } = await supabase
      .from('headings')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) throw error;

    return (data || []).map((h) => ({
      id: h.id,
      projectId: h.project_id,
      name: h.name,
      position: h.position || 0,
    }));
  } catch (error) {
    console.error('Error fetching headings:', error);
    return [];
  }
}

/**
 * Fetch all tasks for a project, organized by heading
 */
export async function fetchTasksByProject(projectId: string) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .is('parent_task_id', null) // Only level 1 tasks
      .order('position', { ascending: true });

    if (error) throw error;

    // Fetch subtasks for each task
    const tasksWithSubtasks = await Promise.all(
      (data || []).map(async (task) => {
        const { data: subtasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('parent_task_id', task.id)
          .order('position', { ascending: true });

        return {
          id: task.id,
          projectId: task.project_id,
          headingId: task.heading_id || null,
          parentTaskId: task.parent_task_id,
          name: task.name,
          description: task.description,
          assigneeId: task.assignee_id,
          dueDate: task.due_date,
          priority: task.priority,
          completed: task.completed,
          completedAt: task.completed_at,
          position: task.position || 0,
          createdBy: task.created_by,
          createdAt: task.created_at,
          subtasks: (subtasks || []).map((st) => ({
            id: st.id,
            projectId: st.project_id,
            headingId: st.heading_id || null,
            parentTaskId: st.parent_task_id,
            name: st.name,
            description: st.description,
            assigneeId: st.assignee_id,
            dueDate: st.due_date,
            priority: st.priority,
            completed: st.completed,
            completedAt: st.completed_at,
            position: st.position || 0,
            createdBy: st.created_by,
            createdAt: st.created_at,
          })),
        } as Task & { subtasks: Task[] };
      })
    );

    return tasksWithSubtasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

/**
 * Fetch a single task with all details
 */
export async function fetchTask(taskId: string) {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) throw error;

    // Fetch comments
    const { data: comments } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    // Fetch followers
    const { data: followers } = await supabase
      .from('followers')
      .select('user_id')
      .eq('task_id', taskId);

    return {
      id: data.id,
      projectId: data.project_id,
      headingId: data.heading_id || null,
      parentTaskId: data.parent_task_id,
      name: data.name,
      description: data.description,
      assigneeId: data.assignee_id,
      dueDate: data.due_date,
      priority: data.priority,
      completed: data.completed,
      completedAt: data.completed_at,
      createdBy: data.created_by,
      createdAt: data.created_at,
      comments: comments || [],
      followers: followers?.map((f) => f.user_id) || [],
    };
  } catch (error) {
    console.error('Error fetching task:', error);
    return null;
  }
}

/**
 * Fetch comments for a task
 */
export async function fetchTaskComments(taskId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((c) => ({
      id: c.id,
      taskId: c.task_id,
      authorId: c.author_id,
      body: c.body,
      mentions: c.mentions || [],
      createdAt: c.created_at,
      editedAt: c.edited_at || null,
      deletedAt: c.deleted_at || null,
    }));
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

/**
 * Fetch user info
 */
export async function fetchUser(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.full_name || data.email,
      email: data.email,
      initials: data.initials || 'U',
      avatarUrl: data.avatar_url || null,
    };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Fetch all users (for member lists, assignee dropdowns, etc.)
 */
export async function fetchAllUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from('users').select('*');

    if (error) throw error;

    return (data || []).map((u) => ({
      id: u.id,
      name: u.full_name || u.email,
      email: u.email,
      initials: u.initials || 'U',
      avatarUrl: u.avatar_url || null,
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}
