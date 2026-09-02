'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

interface ViewPreferences {
  filters: string[];
  sortField: 'due_date' | 'priority' | 'name' | 'created_at';
  sortDirection: 'asc' | 'desc';
}

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

export async function getUserViewPrefs(viewKey: string): Promise<ViewPreferences | null> {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from('user_view_prefs')
      .select('filters, sort_field, sort_direction')
      .eq('user_id', user.id)
      .eq('view_key', viewKey)
      .single();

    if (error) return null;

    return {
      filters: data.filters || [],
      sortField: data.sort_field || 'due_date',
      sortDirection: data.sort_direction || 'asc',
    };
  } catch (err) {
    console.error('Error fetching view prefs:', err);
    return null;
  }
}

export async function saveUserViewPrefs(
  viewKey: string,
  prefs: ViewPreferences
): Promise<boolean> {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { error } = await supabase.from('user_view_prefs').upsert(
      {
        user_id: user.id,
        view_key: viewKey,
        filters: prefs.filters,
        sort_field: prefs.sortField,
        sort_direction: prefs.sortDirection,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,view_key' }
    );

    if (error) {
      console.error('Error saving view prefs:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in saveUserViewPrefs:', err);
    return false;
  }
}

// Comment mutations
export async function createComment(taskId: string, body: string, mentions: string[] = []) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('comments')
      .insert({
        task_id: taskId,
        author_id: user.id,
        body,
        mentions,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creating comment:', err);
    throw err;
  }
}

export async function updateComment(commentId: string, body: string) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('comments')
      .update({
        body,
        edited_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .eq('author_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating comment:', err);
    throw err;
  }
}

export async function deleteComment(commentId: string) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('author_id', user.id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting comment:', err);
    throw err;
  }
}

// Notification mutations
export async function markNotificationRead(notificationId: string) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking notification read:', err);
    throw err;
  }
}

export async function markAllNotificationsRead() {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    throw err;
  }
}
