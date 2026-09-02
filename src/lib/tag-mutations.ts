'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Tag, TaskTag } from '@/src/lib/types';

async function getServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// Fetch all tags
export async function fetchAllTags(): Promise<Tag[]> {
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching tags:', err);
    return [];
  }
}

// Fetch tags for a specific task
export async function fetchTaskTags(taskId: string): Promise<Tag[]> {
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from('task_tags')
      .select('tags(*)')
      .eq('task_id', taskId);

    if (error) throw error;
    return data?.map((tt: any) => tt.tags) || [];
  } catch (err) {
    console.error('Error fetching task tags:', err);
    return [];
  }
}

// Create new tag
export async function createTag(name: string, color: string = '#4573D2'): Promise<Tag | null> {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('tags')
      .insert({
        name,
        color,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creating tag:', err);
    return null;
  }
}

// Update tag
export async function updateTag(tagId: string, updates: Partial<Tag>): Promise<Tag | null> {
  try {
    const supabase = await getServerClient();
    const { data, error } = await supabase
      .from('tags')
      .update({
        name: updates.name,
        color: updates.color,
      })
      .eq('id', tagId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating tag:', err);
    return null;
  }
}

// Delete tag (cascade deletes task_tags)
export async function deleteTag(tagId: string): Promise<boolean> {
  try {
    const supabase = await getServerClient();
    const { error } = await supabase.from('tags').delete().eq('id', tagId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting tag:', err);
    return false;
  }
}

// Add tag to task
export async function addTagToTask(taskId: string, tagId: string): Promise<boolean> {
  try {
    const supabase = await getServerClient();
    const { error } = await supabase
      .from('task_tags')
      .insert({
        task_id: taskId,
        tag_id: tagId,
      });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error adding tag to task:', err);
    return false;
  }
}

// Remove tag from task
export async function removeTagFromTask(taskId: string, tagId: string): Promise<boolean> {
  try {
    const supabase = await getServerClient();
    const { error } = await supabase
      .from('task_tags')
      .delete()
      .eq('task_id', taskId)
      .eq('tag_id', tagId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error removing tag from task:', err);
    return false;
  }
}

// Set tags for a task (replaces all existing tags)
export async function setTaskTags(taskId: string, tagIds: string[]): Promise<boolean> {
  try {
    const supabase = await getServerClient();

    // Delete existing tags for this task
    const { error: deleteError } = await supabase
      .from('task_tags')
      .delete()
      .eq('task_id', taskId);

    if (deleteError) throw deleteError;

    // Insert new tags if any
    if (tagIds.length > 0) {
      const { error: insertError } = await supabase
        .from('task_tags')
        .insert(tagIds.map((tagId) => ({ task_id: taskId, tag_id: tagId })));

      if (insertError) throw insertError;
    }

    return true;
  } catch (err) {
    console.error('Error setting task tags:', err);
    return false;
  }
}
