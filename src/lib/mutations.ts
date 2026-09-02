'use server';

import { supabase } from '@/src/lib/supabaseClient';
import { Task, Comment } from '@/src/lib/types';

/**
 * Create a new task
 */
export async function createTask(data: {
  projectId: string;
  headingId?: string | null;
  name: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  position?: number;
}) {
  try {
    const { data: task, error } = await supabase
      .from('tasks')
      .insert([
        {
          project_id: data.projectId,
          heading_id: data.headingId || null,
          name: data.name,
          description: data.description || null,
          assignee_id: data.assigneeId || null,
          due_date: data.dueDate || null,
          priority: data.priority || null,
          position: data.position || 0,
          completed: false,
          created_by: 'system',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return task;
  } catch (error) {
    console.error('Error creating task:', error);
    return null;
  }
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  updates: Partial<{
    name: string;
    description: string | null;
    assigneeId: string | null;
    dueDate: string | null;
    priority: 'low' | 'medium' | 'high' | null;
    completed: boolean;
    headingId: string | null;
  }>
) {
  try {
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.assigneeId !== undefined) updateData.assignee_id = updates.assigneeId;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.completed !== undefined) {
      updateData.completed = updates.completed;
      updateData.completed_at = updates.completed ? new Date().toISOString() : null;
    }
    if (updates.headingId !== undefined) updateData.heading_id = updates.headingId;

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating task:', error);
    return null;
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string) {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting task:', error);
    return false;
  }
}

/**
 * Create a comment on a task
 */
export async function createComment(data: {
  taskId: string;
  authorId: string;
  body: string;
  mentions?: string[];
}) {
  try {
    const { data: comment, error } = await supabase
      .from('comments')
      .insert([
        {
          task_id: data.taskId,
          author_id: data.authorId,
          body: data.body,
          mentions: data.mentions || [],
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return comment;
  } catch (error) {
    console.error('Error creating comment:', error);
    return null;
  }
}

/**
 * Update a comment
 */
export async function updateComment(
  commentId: string,
  body: string
) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .update({
        body,
        edited_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating comment:', error);
    return null;
  }
}

/**
 * Delete a comment (soft delete)
 */
export async function deleteComment(commentId: string) {
  try {
    const { error } = await supabase
      .from('comments')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', commentId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting comment:', error);
    return false;
  }
}

/**
 * Create a heading/section
 */
export async function createHeading(data: {
  projectId: string;
  name: string;
  position?: number;
}) {
  try {
    const { data: heading, error } = await supabase
      .from('headings')
      .insert([
        {
          project_id: data.projectId,
          name: data.name,
          position: data.position || 0,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return heading;
  } catch (error) {
    console.error('Error creating heading:', error);
    return null;
  }
}

/**
 * Update a heading/section
 */
export async function updateHeading(
  headingId: string,
  updates: Partial<{ name: string; position: number }>
) {
  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.position !== undefined) updateData.position = updates.position;

    const { data, error } = await supabase
      .from('headings')
      .update(updateData)
      .eq('id', headingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating heading:', error);
    return null;
  }
}

/**
 * Add a follower to a task
 */
export async function addFollower(taskId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('followers')
      .insert([{ task_id: taskId, user_id: userId }]);

    if (error && error.code !== '23505') throw error; // 23505 = unique violation, OK
    return true;
  } catch (error) {
    console.error('Error adding follower:', error);
    return false;
  }
}

/**
 * Remove a follower from a task
 */
export async function removeFollower(taskId: string, userId: string) {
  try {
    const { error } = await supabase
      .from('followers')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing follower:', error);
    return false;
  }
}

/**
 * Create a project
 */
export async function createProject(data: {
  name: string;
  color?: string;
  icon?: string;
  position?: number;
}) {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .insert([
        {
          name: data.name,
          color: data.color || '#4573D2',
          icon: data.icon || '📋',
          position: data.position || 0,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return project;
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<{
    name: string;
    color: string;
    icon: string;
    archived: boolean;
    position: number;
  }>
) {
  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.icon !== undefined) updateData.icon = updates.icon;
    if (updates.archived !== undefined) updateData.archived = updates.archived;
    if (updates.position !== undefined) updateData.position = updates.position;

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating project:', error);
    return null;
  }
}
