'use client';

import { useEffect, useState, useCallback } from 'react';
import { markAllNotificationsRead } from '@/src/lib/mutations-extended';

interface ViewPreferences {
  filters: string[];
  sortField: 'due_date' | 'priority' | 'name' | 'created_at';
  sortDirection: 'asc' | 'desc';
}

export function useViewPreferences(viewKey: string) {
  const [prefs, setPrefs] = useState<ViewPreferences>({
    filters: [],
    sortField: 'due_date',
    sortDirection: 'asc',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch from Supabase when authenticated
    // For now, load from localStorage
    const saved = localStorage.getItem(`view-prefs-${viewKey}`);
    if (saved) {
      try {
        setPrefs(JSON.parse(saved));
      } catch (err) {
        console.error('Error parsing saved prefs:', err);
      }
    }
    setLoading(false);
  }, [viewKey]);

  const updatePrefs = useCallback(
    async (updates: Partial<ViewPreferences>) => {
      const newPrefs = { ...prefs, ...updates };
      setPrefs(newPrefs);
      localStorage.setItem(`view-prefs-${viewKey}`, JSON.stringify(newPrefs));
    },
    [prefs, viewKey]
  );

  return { prefs, loading, updatePrefs };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Implement real-time subscription to notifications table when authenticated
    // For now, return empty state
    setLoading(false);
  }, []);

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((notifs) =>
      notifs.map((n) => ({ ...n, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, loading, markAllAsRead };
}
