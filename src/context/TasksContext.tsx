'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Task } from '@/src/lib/types';

interface TasksContextType {
  tasks: Map<string, Task & { subtasks?: Task[] }>;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  addTask: (task: Task & { subtasks?: Task[] }) => void;
  deleteTask: (taskId: string) => void;
}

const TasksContext = createContext<TasksContextType | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Map<string, Task & { subtasks?: Task[] }>>(new Map());

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    const task = tasks.get(taskId);
    if (task) {
      setTasks(new Map(tasks).set(taskId, { ...task, ...updates }));
    }
  };

  const addTask = (task: Task & { subtasks?: Task[] }) => {
    setTasks(new Map(tasks).set(task.id, task));
  };

  const deleteTask = (taskId: string) => {
    const newTasks = new Map(tasks);
    newTasks.delete(taskId);
    setTasks(newTasks);
  };

  return (
    <TasksContext.Provider value={{ tasks, updateTask, addTask, deleteTask }}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within TasksProvider');
  }
  return context;
}
