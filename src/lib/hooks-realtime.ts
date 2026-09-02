'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Comment } from '@/src/lib/types';

interface UseCommentsOptions {
  taskId: string;
  enabled?: boolean;
}

export function useCommentsRealtime({ taskId, enabled = true }: UseCommentsOptions) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createClient();

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;

    async function fetchComments() {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from('comments')
          .select('*')
          .eq('task_id', taskId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });

        if (fetchError) throw fetchError;
        setComments(data || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch comments'));
      } finally {
        setLoading(false);
      }
    }

    fetchComments();
  }, [taskId, enabled, supabase]);

  // Real-time subscription
  useEffect(() => {
    if (!enabled) return;

    const subscription = supabase
      .channel(`task-${taskId}-comments`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setComments((prev) => [...prev, payload.new as Comment]);
          } else if (payload.eventType === 'UPDATE') {
            setComments((prev) =>
              prev.map((c) => (c.id === payload.new.id ? (payload.new as Comment) : c))
            );
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [taskId, enabled, supabase]);

  return { comments, loading, error };
}

export function useNotificationsRealtime() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchNotifications() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setNotifications(data || []);
        setUnreadCount((data || []).filter((n) => !n.read_at).length);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();

    // Set up real-time subscription
    const subscribeToNotifications = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const subscription = supabase
        .channel(`user-${user.id}-notifications`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setNotifications((prev) => [payload.new as any, ...prev]);
              setUnreadCount((prev) => prev + 1);
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as any;
              if (updated.read_at && !payload.old.read_at) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              }
              setNotifications((prev) =>
                prev.map((n) => (n.id === updated.id ? updated : n))
              );
            }
          }
        )
        .subscribe();

      return subscription;
    };

    subscribeToNotifications();
  }, [supabase]);

  return { notifications, unreadCount, loading };
}
