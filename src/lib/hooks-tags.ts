'use client';

import { useEffect, useState, useCallback } from 'react';
import { Tag } from '@/src/lib/types';

export function useTags() {
  const [allTags, setAllTags] = useState<Tag[]>([
    { id: '1', name: 'Bug', color: '#FF8F8F', createdBy: 'system', createdAt: new Date().toISOString() },
    { id: '2', name: 'Feature', color: '#4573D2', createdBy: 'system', createdAt: new Date().toISOString() },
    { id: '3', name: 'Enhancement', color: '#FFA766', createdBy: 'system', createdAt: new Date().toISOString() },
    { id: '4', name: 'Documentation', color: '#FFD15E', createdBy: 'system', createdAt: new Date().toISOString() },
    { id: '5', name: 'Review', color: '#4CAF50', createdBy: 'system', createdAt: new Date().toISOString() },
  ]);
  const [loading, setLoading] = useState(false);

  // TODO: Implement real fetch from Supabase
  // useEffect(() => {
  //   async function loadTags() {
  //     try {
  //       const tags = await fetchAllTags();
  //       setAllTags(tags);
  //     } catch (err) {
  //       console.error('Error loading tags:', err);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  //   loadTags();
  // }, []);

  const createTag = useCallback(async (name: string, color: string) => {
    const newTag: Tag = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      color,
      createdBy: 'user',
      createdAt: new Date().toISOString(),
    };
    setAllTags((prev) => [...prev, newTag]);
    return newTag;
  }, []);

  return { allTags, loading, createTag };
}

export function useTaskTags(taskId: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // TODO: Implement real fetch from Supabase
  // useEffect(() => {
  //   async function loadTags() {
  //     try {
  //       const taskTags = await fetchTaskTags(taskId);
  //       setTags(taskTags);
  //     } catch (err) {
  //       console.error('Error loading task tags:', err);
  //     } finally {
  //       setLoading(false);
  //     }
  //   }
  //   loadTags();
  // }, [taskId]);

  useEffect(() => {
    setLoading(false);
  }, []);

  const addTag = useCallback((tag: Tag) => {
    setTags((prev) => [...prev, tag]);
    // TODO: Call setTaskTags mutation to persist
  }, []);

  const removeTag = useCallback((tagId: string) => {
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    // TODO: Call setTaskTags mutation to persist
  }, []);

  const setTags_ = useCallback((newTags: Tag[]) => {
    setTags(newTags);
    // TODO: Call setTaskTags mutation to persist
  }, []);

  return { tags, loading, addTag, removeTag, setTags: setTags_ };
}
