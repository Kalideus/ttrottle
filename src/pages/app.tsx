'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { TopBar } from '@/components/TopBar';
import { ProfileModal } from '@/components/ProfileModal';
import { avatarInitials } from '@/lib/avatar';
import { Sidebar } from '@/components/Sidebar';
import { ProjectHeader } from '@/components/ProjectHeader';
import { Toolbar, type FilterValue, type SortField } from '@/components/Toolbar';
import { TaskTable } from '@/components/TaskTable';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { Inbox, type NotificationItem } from '@/components/Inbox';
import type { CommentItem } from '@/components/Comments';
import { createClient } from '@/lib/supabase/client';
import {
  getProjects,
  getTasksForProject,
  createProject,
  updateProject,
  createTask,
  updateTask,
  deleteTask,
  getProjectMembers,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  getHeadings,
  createHeading,
  updateHeading,
  deleteHeading,
  getMyTasks,
  getCurrentProfile,
  updateProfile,
  getLastSeen,
  touchLastSeen,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getTags,
  createTag,
  addTagToTask,
  removeTagFromTask,
  getFollowers,
  addFollower,
  removeFollower,
  getTaskActivity,
  logActivity,
  type ProjectMember,
  type Project,
  type Task,
  type Heading,
  type Profile,
  type Tag,
  type Follower,
  type TaskActivity,
} from '@/lib/supabase/queries';

function mapComments(rows: any[], currentUserId: string | null): CommentItem[] {
  return (rows ?? []).map((c) => ({
    id: c.id,
    authorId: c.author_id,
    authorName: c.author?.name ?? 'Unknown',
    authorInitials: c.author?.initials ?? '?',
    body: c.body,
    createdAt: c.created_at,
    editedAt: c.edited_at ?? undefined,
    likes: 0,
    liked: false,
    isOwn: c.author_id === currentUserId,
  }));
}

export default function AppPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<'my-tasks' | 'inbox' | 'projects'>('my-tasks');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterValue[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortField, setSortField] = useState<SortField>('position');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsBadge, setNotificationsBadge] = useState(0);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  // Timestamp of my previous session; "My tasks" badges tasks assigned since then.
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const myTasksBadge = useMemo(
    () => (lastLoginAt ? myTasks.filter((t) => t.created_at && t.created_at > lastLoginAt).length : 0),
    [myTasks, lastLoginAt]
  );

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        await router.push('/login');
        return;
      }

      setCurrentUserId(user.id);
      getCurrentProfile(supabase).then(setCurrentProfile);
      getTags(supabase).then(({ data }) => setAvailableTags(data ?? []));

      const { data: projectRows } = await getProjects(supabase);
      const nextProjects = projectRows ?? [];
      setProjects(nextProjects);

      if (nextProjects.length > 0 && !activeProjectId) {
        setActiveProjectId(nextProjects[0].id);
      }

      if (activeProjectId) {
        const { data: taskRows } = await getTasksForProject(supabase, activeProjectId);
        setTasks((taskRows ?? []) as Task[]);
        const { data: memberRows } = await getProjectMembers(supabase, activeProjectId);
        setProjectMembers(memberRows ?? []);
        const { data: headingRows } = await getHeadings(supabase, activeProjectId);
        setHeadings(headingRows ?? []);
      }

      setLoading(false);
    };

    void load();
  }, [activeProjectId, router, supabase]);

  useEffect(() => {
    if (!currentUserId) return;
    // Loaded regardless of section so the sidebar "My tasks" badge stays accurate.
    getMyTasks(supabase, currentUserId).then(({ data }) => {
      // My Tasks spans every project, so per-project heading ids don't map to anything here —
      // grouping by heading_id would silently drop any task whose heading isn't in an (empty) heading list.
      const withAssignee = (data ?? []).map((t: Task) => ({ ...t, assignee: currentProfile, heading_id: null }));
      setMyTasks(withAssignee as Task[]);
    });
  }, [activeSection, currentUserId, currentProfile, supabase]);

  useEffect(() => {
    if (!currentUserId) return;
    // Read my previous session time (badge cutoff), then stamp this session.
    getLastSeen(supabase, currentUserId).then((ts) => {
      setLastLoginAt(ts);
      void touchLastSeen(supabase, currentUserId);
    });
  }, [currentUserId, supabase]);

  const loadNotificationsBadge = useCallback(async () => {
    if (!currentUserId) return;
    setNotificationsBadge(await getUnreadCount(supabase, currentUserId));
  }, [currentUserId, supabase]);

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await getNotifications(supabase, currentUserId);
    setNotifications(
      (data ?? []).map((n: any) => ({
        id: n.id,
        type: n.type,
        taskName: n.task?.name ?? 'a task',
        taskId: n.task?.id ?? null,
        projectId: n.task?.project_id ?? null,
        actorName: n.actor?.name ?? 'Someone',
        detail: n.detail ?? null,
        createdAt: n.created_at,
        readAt: n.read_at,
      }))
    );
  }, [currentUserId, supabase]);

  useEffect(() => {
    void loadNotificationsBadge();
  }, [loadNotificationsBadge, activeSection]);

  useEffect(() => {
    if (activeSection !== 'inbox') return;
    setNotificationsLoading(true);
    loadNotifications().finally(() => setNotificationsLoading(false));
  }, [activeSection, loadNotifications]);

  // Live push: Supabase Realtime on my notification rows. Any insert/update
  // refreshes the badge and the list so it lands without navigating.
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`notifications:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
        () => {
          void loadNotificationsBadge();
          void loadNotifications();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase, loadNotifications, loadNotificationsBadge]);

  useEffect(() => {
    if (!selectedTaskId) {
      setComments([]);
      return;
    }

    setCommentsLoading(true);
    getComments(supabase, selectedTaskId).then(({ data }) => {
      setComments(mapComments(data ?? [], currentUserId));
      setCommentsLoading(false);
    });
  }, [selectedTaskId, supabase, currentUserId]);

  useEffect(() => {
    if (!selectedTaskId) {
      setFollowers([]);
      return;
    }

    getFollowers(supabase, selectedTaskId).then(({ data }) => setFollowers(data ?? []));
  }, [selectedTaskId, supabase]);

  const refreshActivity = async (taskId: string) => {
    const { data } = await getTaskActivity(supabase, taskId);
    setActivity(data ?? []);
  };

  useEffect(() => {
    if (!selectedTaskId) {
      setActivity([]);
      return;
    }

    refreshActivity(selectedTaskId);
  }, [selectedTaskId, supabase]);

  const currentProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [projects, activeProjectId]
  );

  const taskPool = activeSection === 'my-tasks' ? myTasks : tasks;

  const selectedTask = useMemo(
    () => taskPool.find((t) => t.id === selectedTaskId) ?? taskPool.flatMap((t) => t.subtasks ?? []).find((t) => t.id === selectedTaskId),
    [taskPool, selectedTaskId]
  );

  const parentTask = useMemo(
    () => (selectedTask?.parent_task_id ? taskPool.find((t) => t.id === selectedTask.parent_task_id) ?? null : null),
    [taskPool, selectedTask]
  );

  const displayedTasks = useMemo(() => {
    let result = [...taskPool];

    if (!showCompleted) {
      result = result.filter((task) => !task.completed);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((task) => task.name.toLowerCase().includes(query));
    }

    if (activeFilters.length > 0) {
      result = result.filter((task) => {
        return activeFilters.some((filter) => {
          if (filter === 'priority:high') return task.priority === 'high';
          if (filter === 'priority:medium') return task.priority === 'medium';
          if (filter === 'priority:low') return task.priority === 'low';
          if (filter === 'no-due-date') return !task.due_date;
          if (filter === 'overdue') return task.due_date && new Date(task.due_date) < new Date() && !task.completed;
          if (filter.startsWith('tag:')) return (task.tags ?? []).some((t) => t.id === filter.slice(4));
          return true;
        });
      });
    }

    if (activeSection === 'my-tasks') {
      // My Tasks is always due-date order, overdue-first — not subject to the toolbar's sort picker.
      result.sort((a, b) => (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity));
      return result;
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'position') cmp = (a.position ?? 0) - (b.position ?? 0);
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === 'due_date') cmp = (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity);
      else if (sortField === 'priority') {
        const rank = { high: 0, medium: 1, low: 2 };
        cmp = (rank[a.priority ?? 'low']) - (rank[b.priority ?? 'low']);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [taskPool, activeFilters, searchQuery, showCompleted, sortField, sortDirection, activeSection]);

  const refreshTasks = async () => {
    if (!activeProjectId) return;
    const { data: taskRows } = await getTasksForProject(supabase, activeProjectId);
    setTasks((taskRows ?? []) as Task[]);
  };

  const handleTaskAdd = async (headingId: string | null, name: string) => {
    await createTask(supabase, { project_id: activeProjectId, heading_id: headingId, name, created_by: currentUserId });
    await refreshTasks();
  };

  const handleSubtaskAdd = async (parentTaskId: string, name: string) => {
    await createTask(supabase, { project_id: activeProjectId, parent_task_id: parentTaskId, name, created_by: currentUserId });
    await refreshTasks();
  };

  const handleTaskDelete = async (taskId: string) => {
    await deleteTask(supabase, taskId);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    if (activeSection === 'my-tasks' && currentUserId) {
      const { data } = await getMyTasks(supabase, currentUserId);
      setMyTasks(((data ?? []) as Task[]).map((t) => ({ ...t, assignee: currentProfile, heading_id: null })));
    } else {
      await refreshTasks();
    }
  };

  const handleFollowerAdd = async (userId: string) => {
    if (!selectedTaskId) return;
    await addFollower(supabase, selectedTaskId, userId);
    const { data } = await getFollowers(supabase, selectedTaskId);
    setFollowers(data ?? []);

    const name = projectMembers.find((m) => m.profile_id === userId)?.profile?.name ?? 'someone';
    if (currentUserId) await logActivity(supabase, { task_id: selectedTaskId, actor_id: currentUserId, message: `added ${name} as a follower` });
    await refreshActivity(selectedTaskId);
  };

  const handleFollowerRemove = async (userId: string) => {
    if (!selectedTaskId) return;
    const name = followers.find((f) => f.user_id === userId)?.profile?.name
      ?? projectMembers.find((m) => m.profile_id === userId)?.profile?.name
      ?? 'a follower';
    await removeFollower(supabase, selectedTaskId, userId);
    const { data } = await getFollowers(supabase, selectedTaskId);
    setFollowers(data ?? []);

    if (currentUserId) {
      const message = userId === currentUserId ? 'stopped following the task' : `removed ${name} as a follower`;
      await logActivity(supabase, { task_id: selectedTaskId, actor_id: currentUserId, message });
    }
    await refreshActivity(selectedTaskId);
  };

  const buildActivityMessages = (updates: Record<string, unknown>): string[] => {
    const messages: string[] = [];

    if ('name' in updates && typeof updates.name === 'string') {
      messages.push(`renamed the task to "${updates.name}"`);
    }
    if ('description' in updates) {
      messages.push('updated the description');
    }
    if ('assignee_id' in updates) {
      const id = updates.assignee_id as string | null;
      const member = id ? projectMembers.find((m) => m.profile_id === id) : null;
      messages.push(id ? `assigned the task to ${member?.profile?.name ?? member?.email ?? 'someone'}` : 'unassigned the task');
    }
    if ('due_date' in updates) {
      const date = updates.due_date as string | null;
      messages.push(date ? `set the due date to ${new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'cleared the due date');
    }
    if ('priority' in updates) {
      const p = updates.priority as string | null;
      messages.push(p ? `set priority to ${p.charAt(0).toUpperCase() + p.slice(1)}` : 'cleared the priority');
    }
    if ('heading_id' in updates) {
      const heading = headings.find((h) => h.id === (updates.heading_id as string | null));
      messages.push(heading ? `moved the task to "${heading.name}"` : 'moved the task to (no heading)');
    }
    if ('completed' in updates) {
      messages.push(updates.completed ? 'marked the task complete' : 'marked the task incomplete');
    }

    return messages;
  };

  const handleTaskUpdate = async (taskId: string, updates: Record<string, unknown>) => {
    const messages = buildActivityMessages(updates);
    // Feeds the follower notification's "detail" line, e.g. "set the due date to 12 Sep 2026".
    await updateTask(supabase, taskId, updates as any, messages.join(', ') || undefined);

    if (currentUserId) {
      const results = await Promise.all(messages.map((message) => logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message })));
      results.forEach((r) => {
        if (r.error) console.error('Failed to log task activity:', r.error);
      });
      if (selectedTaskId === taskId && messages.length) await refreshActivity(taskId);
    }

    if (activeSection === 'my-tasks' && currentUserId) {
      const { data } = await getMyTasks(supabase, currentUserId);
      setMyTasks(((data ?? []) as Task[]).map((t) => ({ ...t, assignee: currentProfile, heading_id: null })));
    } else {
      await refreshTasks();
    }
  };

  const handleHeadingRename = async (headingId: string, name: string) => {
    await updateHeading(supabase, headingId, { name });
    const { data } = await getHeadings(supabase, activeProjectId);
    setHeadings(data ?? []);
  };

  const handleHeadingAdd = async (name: string) => {
    await createHeading(supabase, { project_id: activeProjectId, name });
    const { data } = await getHeadings(supabase, activeProjectId);
    setHeadings(data ?? []);
  };

  const handleHeadingDelete = async (headingId: string) => {
    await deleteHeading(supabase, headingId);
    const { data } = await getHeadings(supabase, activeProjectId);
    setHeadings(data ?? []);
    await refreshTasks();
  };

  const handleNoHeadingRename = async (name: string, taskIds: string[]) => {
    const { data: heading } = await createHeading(supabase, { project_id: activeProjectId, name });
    if (heading) {
      await Promise.all(taskIds.map((id) => updateTask(supabase, id, { heading_id: heading.id })));
    }
    const { data } = await getHeadings(supabase, activeProjectId);
    setHeadings(data ?? []);
    await refreshTasks();
  };

  const handleTaskReorder = async (taskId: string, swapWithTaskId: string) => {
    const a = tasks.find((t) => t.id === taskId) ?? tasks.flatMap((t) => t.subtasks ?? []).find((t) => t.id === taskId);
    const b = tasks.find((t) => t.id === swapWithTaskId) ?? tasks.flatMap((t) => t.subtasks ?? []).find((t) => t.id === swapWithTaskId);
    if (!a || !b) return;
    await Promise.all([
      updateTask(supabase, a.id, { position: b.position }),
      updateTask(supabase, b.id, { position: a.position }),
    ]);
    await refreshTasks();
  };

  const handleTagAdd = async (tag: Tag) => {
    if (!selectedTaskId) return;
    await addTagToTask(supabase, selectedTaskId, tag.id);
    if (currentUserId) await logActivity(supabase, { task_id: selectedTaskId, actor_id: currentUserId, message: `added the tag "${tag.name}"` });
    await refreshTasks();
    await refreshActivity(selectedTaskId);
  };

  const handleTagRemove = async (tagId: string) => {
    if (!selectedTaskId) return;
    const tagName = selectedTask?.tags?.find((t) => t.id === tagId)?.name ?? availableTags.find((t) => t.id === tagId)?.name ?? 'a tag';
    await removeTagFromTask(supabase, selectedTaskId, tagId);
    if (currentUserId) await logActivity(supabase, { task_id: selectedTaskId, actor_id: currentUserId, message: `removed the tag "${tagName}"` });
    await refreshTasks();
    await refreshActivity(selectedTaskId);
  };

  const handleNewTag = async (name: string, color: string) => {
    const { data: tag } = await createTag(supabase, { name, color, created_by: currentUserId });
    if (tag) {
      setAvailableTags((prev) => [...prev, tag]);
      await handleTagAdd(tag);
    }
  };

  const handleProjectCreate = async () => {
    const name = window.prompt('Project name?');
    if (!name || !name.trim()) return;
    const colors = ['#4573D2', '#F06A6A', '#A970D1', '#4ECBC4', '#E8A5C8', '#F1BD6C'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const { data } = await createProject(supabase, { name: name.trim(), color, icon: '📋', created_by: currentUserId });
    if (data) {
      const { data: projectRows } = await getProjects(supabase);
      setProjects(projectRows ?? []);
      setActiveSection('projects');
      setActiveProjectId(data.id);
    }
  };

  const handleCreateTaskClick = async () => {
    if (!activeProjectId) {
      window.alert('Create or open a project first, then add tasks to it.');
      return;
    }
    // Create a blank task in the current project and open it in the right-hand
    // panel to fill out inline — no separate modal.
    const { data } = await createTask(supabase, {
      project_id: activeProjectId,
      name: 'Untitled task',
      created_by: currentUserId,
    });
    await refreshTasks();
    if (data) {
      setActiveSection('projects');
      setSelectedTaskId(data.id);
    }
  };

  const handleProjectUpdate = async (updates: { name?: string; color?: string; icon?: string }) => {
    if (!activeProjectId) return;
    await updateProject(supabase, activeProjectId, updates);
    const { data: projectRows } = await getProjects(supabase);
    setProjects(projectRows ?? []);
  };

  const handleInvite = async () => {
    if (!activeProjectId) {
      window.alert('Select a project first.');
      return;
    }
    const email = window.prompt('Invite by email:');
    if (!email || !email.trim()) return;

    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ email: email.trim(), projectId: activeProjectId }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      window.alert(`Could not invite: ${result.error ?? resp.statusText}`);
      return;
    }
    window.alert(result.emailSent ? `Invite email sent to ${email.trim()}.` : `${email.trim()} already has an account and was added to the project.`);
    const { data: memberRows } = await getProjectMembers(supabase, activeProjectId);
    setProjectMembers(memberRows ?? []);
  };

  const handleProfileSave = async (updates: { name: string; initials: string; avatar_color: string }) => {
    if (!currentUserId) return;
    const { data } = await updateProfile(supabase, currentUserId, updates);
    if (data) setCurrentProfile(data);
  };

  const handleChangePassword = async () => {
    const next = window.prompt('New password (at least 6 characters):');
    if (!next) return;
    if (next.length < 6) {
      window.alert('Password must be at least 6 characters.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    window.alert(error ? `Could not update password: ${error.message}` : 'Password updated.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleCommentAdd = async (body: string) => {
    if (!selectedTaskId || !currentUserId) return;
    await createComment(supabase, { task_id: selectedTaskId, author_id: currentUserId, body });
    const { data } = await getComments(supabase, selectedTaskId);
    setComments(mapComments(data ?? [], currentUserId));
  };

  const handleCommentEdit = async (commentId: string, body: string) => {
    await updateComment(supabase, commentId, { body });
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, body, editedAt: new Date().toISOString() } : c)));
  };

  const handleCommentDelete = async (commentId: string) => {
    await deleteComment(supabase, commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleNotificationClick = async (notificationId: string) => {
    const notif = notifications.find((n) => n.id === notificationId);
    if (notif && !notif.readAt) {
      await markNotificationRead(supabase, notificationId);
      // Slack-style: the item stays in the feed as history, just loses its unread state.
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n)));
      setNotificationsBadge((c) => Math.max(0, c - 1));
    }
    // Clicking a notification jumps you to the task it's about.
    if (notif?.projectId && notif?.taskId) {
      setActiveProjectId(notif.projectId);
      setSelectedTaskId(notif.taskId);
      setActiveSection('projects');
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUserId) return;
    await markAllNotificationsRead(supabase, currentUserId);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setNotificationsBadge(0);
  };

  return (
    <div className="app-container">
      <TopBar
        onHamburgerClick={() => {}}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        avatarInitials={currentProfile?.initials || avatarInitials(currentProfile?.name, currentProfile?.email)}
        avatarColor={currentProfile?.avatar_color ?? 'var(--accent)'}
        onOpenProfile={() => setShowProfile(true)}
        onChangePassword={handleChangePassword}
        onLogout={handleLogout}
      />

      {showProfile && currentProfile && (
        <ProfileModal
          profile={currentProfile}
          onSave={handleProfileSave}
          onClose={() => setShowProfile(false)}
        />
      )}

      <div className="app-main">
        <Sidebar
          activeSection={activeSection}
          activeProjectId={activeProjectId}
          projects={projects}
          myTasksBadge={myTasksBadge}
          notificationsBadge={notificationsBadge}
          onSectionChange={setActiveSection}
          onProjectSelect={setActiveProjectId}
          onProjectCreate={handleProjectCreate}
          onCreateTask={handleCreateTaskClick}
          onInvite={handleInvite}
        />

        <div className="app-workspace">
          {activeSection === 'projects' && (
            <>
              <ProjectHeader
                projectName={currentProject?.name ?? 'Project'}
                projectColor={currentProject?.color ?? '#4573D2'}
                projectIcon={currentProject?.icon ?? '📋'}
                members={projectMembers}
                onInvite={handleInvite}
                onProjectUpdate={handleProjectUpdate}
              />

              <Toolbar
                onAddTask={handleCreateTaskClick}
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
                onSortChange={setSortField}
                onSortDirectionChange={setSortDirection}
                onSearchChange={setSearchQuery}
                showCompleted={showCompleted}
                onShowCompletedChange={setShowCompleted}
                sortField={sortField}
                sortDirection={sortDirection}
                availableTags={availableTags}
              />

              <div className="app-content">
                {!loading && activeProjectId ? (
                  <>
                    <TaskTable
                      tasks={displayedTasks}
                      headings={headings}
                      onTaskSelect={setSelectedTaskId}
                      selectedTaskId={selectedTaskId}
                      currentUserId={currentUserId}
                      onTaskAdd={handleTaskAdd}
                      onSubtaskAdd={handleSubtaskAdd}
                      onTaskUpdate={handleTaskUpdate}
                      onTaskDelete={handleTaskDelete}
                      onHeadingRename={handleHeadingRename}
                      onHeadingAdd={handleHeadingAdd}
                      onHeadingDelete={handleHeadingDelete}
                      onNoHeadingRename={handleNoHeadingRename}
                      onTaskReorder={handleTaskReorder}
                      manualOrder={sortField === 'position'}
                    />
                    {selectedTask && (
                      <div className="detail-panel-backdrop" onClick={() => setSelectedTaskId(null)} />
                    )}
                    {selectedTask && (
                      <TaskDetailPanel
                        key={selectedTask.id}
                        task={selectedTask}
                        projectMembers={projectMembers}
                        headings={headings}
                        availableTags={availableTags}
                        comments={comments}
                        commentsLoading={commentsLoading}
                        followers={followers}
                        activity={activity}
                        currentUserId={currentUserId}
                        onFollowerAdd={handleFollowerAdd}
                        onFollowerRemove={handleFollowerRemove}
                        onSubtaskAdd={handleSubtaskAdd}
                        onSubtaskSelect={setSelectedTaskId}
                        parentTaskName={parentTask?.name ?? null}
                        onParentSelect={() => parentTask && setSelectedTaskId(parentTask.id)}
                        onClose={() => setSelectedTaskId(null)}
                        onTaskUpdate={handleTaskUpdate}
                        onTaskDelete={handleTaskDelete}
                        onTagAdd={handleTagAdd}
                        onTagRemove={handleTagRemove}
                        onNewTag={handleNewTag}
                        onCommentAdd={handleCommentAdd}
                        onCommentEdit={handleCommentEdit}
                        onCommentDelete={handleCommentDelete}
                      />
                    )}
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Loading projects…
                  </div>
                )}
              </div>
            </>
          )}

          {activeSection === 'my-tasks' && (
            <>
              <Toolbar
                onAddTask={handleCreateTaskClick}
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
                onSortChange={setSortField}
                onSortDirectionChange={setSortDirection}
                onSearchChange={setSearchQuery}
                showCompleted={showCompleted}
                onShowCompletedChange={setShowCompleted}
                sortField={sortField}
                sortDirection={sortDirection}
              />

              <div className="app-content">
                <TaskTable
                  tasks={displayedTasks}
                  headings={[]}
                  flat
                  onTaskSelect={setSelectedTaskId}
                  selectedTaskId={selectedTaskId}
                  currentUserId={currentUserId}
                  onTaskAdd={async () => window.alert('Open a project to add tasks there.')}
                  onSubtaskAdd={async () => window.alert('Open a project to add subtasks there.')}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskDelete={handleTaskDelete}
                  onHeadingRename={async () => {}}
                  onHeadingAdd={async () => window.alert('Open a project to add sections there.')}
                  onHeadingDelete={async () => {}}
                  onNoHeadingRename={async () => window.alert('Open a project to add sections there.')}
                  onTaskReorder={async () => {}}
                />
                {selectedTask && (
                  <div className="detail-panel-backdrop" onClick={() => setSelectedTaskId(null)} />
                )}
                {selectedTask && (
                  <TaskDetailPanel
                    key={selectedTask.id}
                    task={selectedTask}
                    projectMembers={projectMembers}
                    headings={[]}
                    availableTags={availableTags}
                    comments={comments}
                    commentsLoading={commentsLoading}
                    followers={followers}
                    activity={activity}
                    currentUserId={currentUserId}
                    onFollowerAdd={handleFollowerAdd}
                    onFollowerRemove={handleFollowerRemove}
                    onSubtaskAdd={async () => window.alert('Open the task from its project to add subtasks there.')}
                    onSubtaskSelect={setSelectedTaskId}
                    parentTaskName={parentTask?.name ?? null}
                    onParentSelect={() => parentTask && setSelectedTaskId(parentTask.id)}
                    onClose={() => setSelectedTaskId(null)}
                    onTaskUpdate={handleTaskUpdate}
                    onTaskDelete={handleTaskDelete}
                    onTagAdd={handleTagAdd}
                    onTagRemove={handleTagRemove}
                    onNewTag={handleNewTag}
                    onCommentAdd={handleCommentAdd}
                    onCommentEdit={handleCommentEdit}
                    onCommentDelete={handleCommentDelete}
                  />
                )}
              </div>
            </>
          )}

          {activeSection === 'inbox' && (
            <Inbox
              notifications={notifications}
              loading={notificationsLoading}
              onNotificationClick={handleNotificationClick}
              onMarkAllRead={handleMarkAllRead}
            />
          )}
        </div>
      </div>
    </div>
  );
}
