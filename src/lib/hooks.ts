import { useEffect, useState } from 'react';
import {
  fetchProjects,
  fetchHeadings,
  fetchTasksByProject,
  fetchTask,
  fetchTaskComments,
  fetchAllUsers,
} from '@/src/lib/queries';
import { Project, Heading, Task, Comment, User } from '@/src/lib/types';

/**
 * Hook to fetch all projects
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchProjects();
        setProjects(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { projects, loading, error };
}

/**
 * Hook to fetch headings for a project
 */
export function useHeadings(projectId: string) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      try {
        const data = await fetchHeadings(projectId);
        setHeadings(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId]);

  return { headings, loading, error };
}

/**
 * Hook to fetch tasks for a project
 */
export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<(Task & { subtasks: Task[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const load = async () => {
      try {
        const data = await fetchTasksByProject(projectId);
        setTasks(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId]);

  return { tasks, loading, error };
}

/**
 * Hook to fetch a single task
 */
export function useTask(taskId: string) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const load = async () => {
      try {
        const data = await fetchTask(taskId);
        setTask(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [taskId]);

  return { task, loading, error };
}

/**
 * Hook to fetch comments for a task
 */
export function useTaskComments(taskId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const load = async () => {
      try {
        const data = await fetchTaskComments(taskId);
        setComments(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [taskId]);

  return { comments, loading, error };
}

/**
 * Hook to fetch all users
 */
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAllUsers();
        setUsers(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { users, loading, error };
}
