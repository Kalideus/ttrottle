'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { TopBar } from '@/components/TopBar';
import { ProfileModal } from '@/components/ProfileModal';
import { InviteModal } from '@/components/InviteModal';
import { ProjectImportModal, ProjectDuplicateModal } from '@/components/ProjectImportModal';
import type { NewTaskSpec } from '@/lib/csvImport';
import { repeatLabel, type Repeat } from '@/lib/repeat';
import { CreateTaskModal, type NewTaskInput } from '@/components/CreateTaskModal';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { MembersModal } from '@/components/MembersModal';
import { GlobalSearch } from '@/components/GlobalSearch';
import { TukTukCelebration } from '@/components/TukTukCelebration';
import { avatarInitials, squareAvatarBlob, AVATAR_COLORS } from '@/lib/avatar';
import { Sidebar } from '@/components/Sidebar';
import { ProjectHeader } from '@/components/ProjectHeader';
import { Toolbar, type FilterValue, type SortField } from '@/components/Toolbar';
import { TaskTable } from '@/components/TaskTable';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { Inbox, type NotificationItem } from '@/components/Inbox';
import type { CommentItem } from '@/components/Comments';
import { createClient } from '@/lib/supabase/client';
import { createSaveQueue } from '@/lib/saveQueue';
import {
  getProjects,
  getTasksForProject,
  createProject,
  createProjectWithContent,
  getMyProjectRoles,
  answerExtensionRequest,
  projectToPlan,
  updateProject,
  deleteProject,
  createTask,
  updateTask,
  deleteTask,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  getProfiles,
  searchTasks,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  setCommentLike,
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
  markNotificationsRead,
  clearNotifications,
  clearAllNotifications,
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

const DAY_MS = 86400000;

// Supabase returns { error } instead of throwing; background saves need a throw to report the failure.
function must<T extends { error: unknown }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}

// Local-time YYYY-MM-DD, `plusDays` from today (due_date is a plain date, so compare as strings).
function localYmd(plusDays: number) {
  const d = new Date(Date.now() + plusDays * DAY_MS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapComments(rows: any[], currentUserId: string | null): CommentItem[] {
  return (rows ?? []).map((c) => ({
    id: c.id,
    authorId: c.author_id,
    authorName: c.author?.name ?? 'Unknown',
    authorInitials: c.author?.initials ?? '?',
    authorColor: c.author?.avatar_color,
    authorAvatarUrl: c.author?.avatar_url,
    body: c.body,
    createdAt: c.created_at,
    editedAt: c.edited_at ?? undefined,
    likes: c.like_user_ids?.length ?? 0,
    liked: !!currentUserId && !!c.like_user_ids?.includes(currentUserId),
    isOwn: c.author_id === currentUserId,
    requestedDueDate: c.requested_due_date ?? null,
    requestStatus: c.request_status ?? null,
  }));
}

export default function AppPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<'my-tasks' | 'inbox' | 'projects'>('my-tasks');
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [headings, setHeadings] = useState<Heading[]>([]);
  // headings always display A→Z (numeric-aware, so "2." sorts before "10."); position is just creation order
  const sortedHeadings = useMemo(() => [...headings].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })), [headings]);
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
  // comment a notification click wants scrolled into view once the panel's comments load
  const [focusCommentId, setFocusCommentId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusCommentId) return;
    const el = document.getElementById(`comment-${focusCommentId}`);
    if (!el) return; // not rendered yet (or deleted) -- retries when comments change
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('comment-flash');
    void el.offsetWidth; // restart the animation if it's the same comment again
    el.classList.add('comment-flash');
    setFocusCommentId(null);
  }, [focusCommentId, comments]);
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
  const [showInvite, setShowInvite] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // project_id → my role there; drives the manager-only due-date lock and extension answers
  const [myRoles, setMyRoles] = useState<Map<string, ProjectMember['role']>>(new Map());
  const [duplicateFrom, setDuplicateFrom] = useState<Project | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [celebration, setCelebration] = useState<number | null>(null);
  const endCelebration = useCallback(() => setCelebration(null), []);
  // Super-admin bulk select: null = off, a Set = on (possibly empty).
  const [bulk, setBulk] = useState<Set<string> | null>(null);
  const [allPeople, setAllPeople] = useState<Profile[]>([]);

  const supabase = useMemo(() => createClient(), []);

  // Invite-created profiles default to an email-derived single-word name
  // (e.g. "jsmith23") -- treat anything with no space as "not set yet" and
  // force the profile modal until they enter a real first + last name.
  const needsFullName = !!currentProfile && !currentProfile.name?.trim().includes(' ');

  const myTasksBadge = useMemo(
    () => (lastLoginAt ? myTasks.filter((t) => t.created_at && t.created_at > lastLoginAt).length : 0),
    [myTasks, lastLoginAt]
  );

  // Shared task links: /app?project=<id>&task=<id> opens that task in its project.
  // The query is then cleared so a refresh or later navigation doesn't re-open it.
  useEffect(() => {
    if (!router.isReady) return;
    const { project, task } = router.query;
    if (typeof project !== 'string') return;
    setActiveSection('projects');
    setActiveProjectId(project);
    if (typeof task === 'string') setSelectedTaskId(task);
    void router.replace('/app', undefined, { shallow: true });
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // come back to the same place (e.g. a shared task link) after signing in
        await router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }

      setCurrentUserId(user.id);
      getCurrentProfile(supabase).then(setCurrentProfile);
      getTags(supabase).then(({ data }) => setAvailableTags(data ?? []));

      const { data: projectRows } = await getProjects(supabase);
      const nextProjects = projectRows ?? [];
      setProjects(nextProjects);

      // functional update: a shared task link may already have chosen the project
      if (nextProjects.length > 0) setActiveProjectId((current) => current || nextProjects[0].id);
      else setLoading(false);
    };

    void load();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-project data. A project seen before renders instantly from cache, then refreshes in the background.
  // ponytail: in-memory only, lost on reload; fine since the refetch always follows.
  type ProjectData = { tasks: Task[]; members: ProjectMember[]; headings: Heading[] };
  const projectCache = useRef(new Map<string, ProjectData>());
  const projectLoads = useRef(new Map<string, Promise<ProjectData>>());
  // Shared by hover-prefetch and opening a project, so a click right after a hover reuses the same request.
  // `fresh` skips reusing a load that started before the cached copy we're already showing.
  const loadProject = (id: string, fresh = false): Promise<ProjectData> => {
    const inflight = projectLoads.current.get(id);
    if (inflight && !fresh) return inflight;
    const load = Promise.all([getTasksForProject(supabase, id), getProjectMembers(supabase, id), getHeadings(supabase, id)])
      .then(([t, m, h]) => {
        const d = { tasks: (t.data ?? []) as Task[], members: m.data ?? [], headings: h.data ?? [] };
        projectCache.current.set(id, d);
        return d;
      })
      .finally(() => {
        if (projectLoads.current.get(id) === load) projectLoads.current.delete(id);
      });
    projectLoads.current.set(id, load);
    return load;
  };
  const prefetchProject = (id: string) => {
    if (!projectCache.current.has(id)) void loadProject(id);
  };
  // Current values for code that finishes after a later render (background saves and their resyncs).
  const latest = useRef({ activeProjectId, selectedTaskId, currentUserId, currentProfile });
  latest.current = { activeProjectId, selectedTaskId, currentUserId, currentProfile };
  useEffect(() => {
    if (!activeProjectId) return;
    let stale = false;
    const apply = (d: { tasks: Task[]; members: ProjectMember[]; headings: Heading[] }) => {
      setTasks(d.tasks);
      setProjectMembers(d.members);
      setHeadings(d.headings);
      setLoading(false);
    };
    const cached = projectCache.current.get(activeProjectId);
    if (cached) apply(cached);

    loadProject(activeProjectId, !!cached).then((d) => {
      if (!stale) apply(d); // a quick click to another project must not be overwritten by this slower response
    });
    return () => {
      stale = true;
    };
  }, [activeProjectId, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUserId) return;
    // Loaded regardless of section so the sidebar "My tasks" badge stays accurate.
    getMyTasks(supabase, currentUserId).then(({ data }) => {
      // My Tasks spans every project, so per-project heading ids don't map to anything here —
      // grouping by heading_id would silently drop any task whose heading isn't in an (empty) heading list.
      const withAssignee = (data ?? []).map((t: Task) => ({ ...t, assignee: currentProfile, heading_id: null }));
      setMyTasks(withAssignee as Task[]);
      // the stale cached list rendered first and froze its order; sort the fresh one
      if (activeSection === 'my-tasks') setResortToken((n) => n + 1);
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
        commentId: n.comment_id ?? null,
        dueDate: n.task?.due_date ?? null,
        priority: n.task?.priority ?? null,
        completed: !!n.task?.completed,
        assignee: n.task_assignee ?? null,
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

  const notificationsLoaded = useRef(false);
  const inboxOpen = useRef(false);
  inboxOpen.current = activeSection === 'inbox';

  useEffect(() => {
    if (activeSection !== 'inbox') return;
    // reopening shows the last list straight away and refreshes it underneath
    if (!notificationsLoaded.current) setNotificationsLoading(true);
    loadNotifications().finally(() => {
      notificationsLoaded.current = true;
      setNotificationsLoading(false);
    });
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
          // my own clears/reads still saving would come back stale; the save queue reloads once they land
          if (saves.pending > 0) return;
          void loadNotificationsBadge();
          // the full list only matters while it's on screen; opening the inbox loads it anyway
          if (inboxOpen.current) void loadNotifications();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase, loadNotifications, loadNotificationsBadge]);

  // Task panel extras, cached per task like projects: reopening a task is instant, and resting the
  // pointer on a row loads them before the click.
  type TaskExtras = { comments: CommentItem[]; followers: Follower[]; activity: TaskActivity[] };
  const taskCache = useRef(new Map<string, TaskExtras>());
  const taskLoads = useRef(new Map<string, Promise<TaskExtras>>());
  const loadTaskExtras = (id: string, fresh = false): Promise<TaskExtras> => {
    const inflight = taskLoads.current.get(id);
    if (inflight && !fresh) return inflight;
    const load = Promise.all([getComments(supabase, id), getFollowers(supabase, id), getTaskActivity(supabase, id)])
      .then(([c, f, a]) => {
        const d = { comments: mapComments(c.data ?? [], latest.current.currentUserId), followers: f.data ?? [], activity: a.data ?? [] };
        taskCache.current.set(id, d);
        return d;
      })
      .finally(() => {
        if (taskLoads.current.get(id) === load) taskLoads.current.delete(id);
      });
    taskLoads.current.set(id, load);
    return load;
  };
  // waits for the pointer to settle so sweeping across the list doesn't load every row
  const hoverTimer = useRef<number | undefined>(undefined);
  const prefetchTask = (id: string) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      if (!taskCache.current.has(id)) void loadTaskExtras(id);
    }, 150);
  };

  useEffect(() => {
    const apply = (d: TaskExtras) => {
      setComments(d.comments);
      setFollowers(d.followers);
      setActivity(d.activity);
      setCommentsLoading(false);
    };
    if (!selectedTaskId) {
      apply({ comments: [], followers: [], activity: [] });
      return;
    }
    let stale = false;
    const cached = taskCache.current.get(selectedTaskId);
    if (cached) apply(cached);
    else {
      // don't show the previous task's comments while this one loads
      apply({ comments: [], followers: [], activity: [] });
      setCommentsLoading(true);
    }
    loadTaskExtras(selectedTaskId, !!cached).then((d) => {
      if (!stale) apply(d);
    });
    return () => {
      stale = true;
    };
  }, [selectedTaskId, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const frozenOrder = useRef<{ key: string; ids: string[] }>({ key: '', ids: [] });
  // bumped by deliberate moves (reorder arrows, drag between headings) so those do re-sort
  const [resortToken, setResortToken] = useState(0);

  const displayedTasks = useMemo(() => {
    let result = [...taskPool];

    if (!showCompleted && !activeFilters.includes('completed-7d')) {
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
          if (filter === 'due-today') return task.due_date?.slice(0, 10) === localYmd(0);
          if (filter === 'due-7d') return !!task.due_date && task.due_date.slice(0, 10) >= localYmd(0) && task.due_date.slice(0, 10) <= localYmd(7);
          if (filter === 'due-month') return !!task.due_date && task.due_date.slice(0, 10) >= localYmd(0) && task.due_date.slice(0, 7) === localYmd(0).slice(0, 7);
          if (filter === 'created-7d') return Date.now() - new Date(task.created_at).getTime() <= 7 * DAY_MS;
          if (filter === 'created-30d') return Date.now() - new Date(task.created_at).getTime() <= 30 * DAY_MS;
          if (filter === 'completed-7d') return !!task.completed_at && Date.now() - new Date(task.completed_at).getTime() <= 7 * DAY_MS;
          if (filter.startsWith('tag:')) return (task.tags ?? []).some((t) => t.id === filter.slice(4));
          return true;
        });
      });
    }

    // Due date and priority break each other's ties: same day → highest priority first, and vice versa.
    // ponytail: fixed pairing, add a "then by" picker if other combinations are wanted
    const byDue = (a: Task, b: Task) => (a.due_date ? new Date(a.due_date).getTime() : Infinity) - (b.due_date ? new Date(b.due_date).getTime() : Infinity);
    const rank = { high: 0, medium: 1, low: 2 };
    const byPriority = (a: Task, b: Task) => (a.priority ? rank[a.priority] : 3) - (b.priority ? rank[b.priority] : 3);
    if (activeSection === 'my-tasks') {
      // My Tasks is always due-date order, overdue-first — not subject to the toolbar's sort picker.
      result.sort((a, b) => byDue(a, b) || byPriority(a, b));
    } else result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'position') cmp = (a.position ?? 0) - (b.position ?? 0);
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'created_at') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === 'due_date') cmp = byDue(a, b) || byPriority(a, b);
      else if (sortField === 'priority') cmp = byPriority(a, b) || byDue(a, b);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    // Rows don't move while you edit them (changing a date mid-list made the next click land on the wrong task).
    // The order is re-sorted only when the view itself changes; rows added meanwhile go at the bottom.
    const viewKey = JSON.stringify([activeSection, activeProjectId, sortField, sortDirection, activeFilters, searchQuery, showCompleted, resortToken]);
    const prev = frozenOrder.current;
    if (prev.key === viewKey) {
      const byId = new Map(result.map((t) => [t.id, t]));
      const kept = prev.ids.flatMap((id) => byId.get(id) ?? []);
      const known = new Set(prev.ids);
      result = [...kept, ...result.filter((t) => !known.has(t.id))];
    }
    frozenOrder.current = { key: viewKey, ids: result.map((t) => t.id) };

    return result;
  }, [taskPool, activeFilters, searchQuery, showCompleted, sortField, sortDirection, activeSection, activeProjectId, resortToken]);

  const allVisibleTaskIds = useMemo(
    () => displayedTasks.flatMap((t) => [t.id, ...(t.subtasks ?? []).map((s) => s.id)]),
    [displayedTasks]
  );

  // leave select mode when switching project
  useEffect(() => setBulk(null), [activeProjectId]);
  // every project and view opens with completed tasks hidden; "Show completed" is a per-visit choice
  useEffect(() => setShowCompleted(false), [activeProjectId, activeSection]);

  const handleBulkDelete = async () => {
    if (!bulk?.size) return;
    if (!window.confirm(`Delete ${bulk.size} task${bulk.size === 1 ? '' : 's'}? They can be restored from Admin → Deleted tasks.`)) return;
    const ids = new Set(bulk);
    removeTasks(ids);
    setBulk(new Set());
    persist(() => Promise.all([...ids].map((id) => deleteTask(supabase, id, currentUserId).then(must))), 'tasks');
  };

  const refreshTasks = async () => {
    const projectId = latest.current.activeProjectId;
    if (!projectId) return;
    const { data: taskRows } = await getTasksForProject(supabase, projectId);
    const cached = projectCache.current.get(projectId);
    if (cached) cached.tasks = (taskRows ?? []) as Task[];
    // skip if the user switched project, or made newer changes this response predates (their resync follows)
    if (projectId === latest.current.activeProjectId && saves.pending === 0) setTasks((taskRows ?? []) as Task[]);
  };

  const refreshMyTasks = async () => {
    const { currentUserId: uid, currentProfile: me } = latest.current;
    if (!uid) return;
    const { data } = await getMyTasks(supabase, uid);
    if (saves.pending === 0) setMyTasks(((data ?? []) as Task[]).map((t) => ({ ...t, assignee: me, heading_id: null })));
  };

  // What a finished save may have changed; each reloads from the server for whatever is on screen now.
  const resyncers = {
    notifications: () => Promise.all([loadNotificationsBadge(), inboxOpen.current ? loadNotifications() : null]),
    tasks: () => Promise.all([refreshTasks(), refreshMyTasks()]),
    headings: async () => {
      const id = latest.current.activeProjectId;
      if (!id) return;
      const { data } = await getHeadings(supabase, id);
      if (id === latest.current.activeProjectId) setHeadings(data ?? []);
    },
    members: async () => {
      const id = latest.current.activeProjectId;
      if (!id) return;
      const { data } = await getProjectMembers(supabase, id);
      if (id === latest.current.activeProjectId) setProjectMembers(data ?? []);
    },
    projects: async () => {
      const { data } = await getProjects(supabase);
      setProjects(data ?? []);
    },
    followers: async () => {
      const id = latest.current.selectedTaskId;
      if (!id) return;
      const { data } = await getFollowers(supabase, id);
      const cached = taskCache.current.get(id);
      if (cached) cached.followers = data ?? [];
      if (id === latest.current.selectedTaskId) setFollowers(data ?? []);
    },
    activity: async () => {
      const id = latest.current.selectedTaskId;
      if (!id) return;
      const { data } = await getTaskActivity(supabase, id);
      const cached = taskCache.current.get(id);
      if (cached) cached.activity = data ?? [];
      if (id === latest.current.selectedTaskId) setActivity(data ?? []);
    },
    comments: async () => {
      const { selectedTaskId: id, currentUserId: uid } = latest.current;
      if (!id) return;
      const { data } = await getComments(supabase, id);
      const comments = mapComments(data ?? [], uid);
      const cached = taskCache.current.get(id);
      if (cached) cached.comments = comments;
      if (id === latest.current.selectedTaskId) setComments(comments);
    },
  };
  type Resync = keyof typeof resyncers;
  const resyncRef = useRef(resyncers);
  resyncRef.current = resyncers;

  // Optimistic saves: handlers update the screen first, then hand the write to persist().
  // Once the queue drains, everything the writes touched is reloaded, which also undoes a failed write.
  // ponytail: one global queue; per-task queues if bulk edits ever take noticeably long to settle
  const [saves] = useState(() =>
    createSaveQueue<Resync>(
      (keys) => keys.forEach((k) => void resyncRef.current[k]()),
      (e) => {
        console.error('Save failed:', e);
        window.alert(`Couldn't save that change: ${(e as Error)?.message ?? 'unknown error'}. Showing the latest saved data.`);
      }
    )
  );
  const persist = (write: () => Promise<unknown>, ...touches: Resync[]) => void saves.add(write, touches);

  // Apply a change to one task wherever it's shown (project list, My tasks, as a subtask).
  const patchTask = (taskId: string, fn: (t: Task) => Task) => {
    const p = (t: Task): Task => (t.id === taskId ? fn(t) : t.subtasks ? { ...t, subtasks: t.subtasks.map(p) } : t);
    setTasks((ts) => ts.map(p));
    setMyTasks((ts) => ts.map(p));
  };

  const removeTasks = (ids: Set<string>) => {
    const drop = (ts: Task[]): Task[] => ts.filter((t) => !ids.has(t.id)).map((t) => (t.subtasks ? { ...t, subtasks: drop(t.subtasks) } : t));
    setTasks(drop);
    setMyTasks(drop);
    if (selectedTaskId && ids.has(selectedTaskId)) setSelectedTaskId(null);
  };

  const nextPosition = (items: { position?: number | null }[]) => Math.max(-1, ...items.map((t) => t.position ?? 0)) + 1;

  const newTask = (fields: Partial<Task>): Task => ({
    id: crypto.randomUUID(),
    project_id: activeProjectId,
    heading_id: null,
    parent_task_id: null,
    name: '',
    description: null,
    assignee_id: null,
    due_date: null,
    priority: null,
    completed: false,
    completed_at: null,
    position: 0,
    created_by: currentUserId,
    created_at: new Date().toISOString(),
    assignee: null,
    subtasks: [],
    tags: [],
    comment_count: 0,
    ...fields,
  });

  const handleTaskAdd = async (headingId: string | null, name: string) => {
    const task = newTask({ heading_id: headingId, name, position: nextPosition(tasks) });
    setTasks((ts) => [...ts, task]);
    persist(async () => must(await createTask(supabase, { id: task.id, position: task.position, project_id: task.project_id, heading_id: headingId, name, created_by: currentUserId })), 'tasks');
  };

  const handleSubtaskAdd = async (parentTaskId: string, name: string) => {
    // from My tasks the parent may belong to any project, so the subtask goes in the parent's project
    const parent = [...tasks, ...myTasks].find((t) => t.id === parentTaskId);
    const sub = newTask({ parent_task_id: parentTaskId, name, position: nextPosition(parent?.subtasks ?? []), project_id: parent?.project_id ?? activeProjectId });
    patchTask(parentTaskId, (t) => ({ ...t, subtasks: [...(t.subtasks ?? []), sub] }));
    persist(async () => must(await createTask(supabase, { id: sub.id, position: sub.position, project_id: sub.project_id, parent_task_id: parentTaskId, name, created_by: currentUserId })), 'tasks');
  };

  const handleTaskDelete = async (taskId: string) => {
    removeTasks(new Set([taskId]));
    persist(async () => must(await deleteTask(supabase, taskId, currentUserId)), 'tasks');
  };

  const handleFollowerAdd = async (userId: string) => {
    if (!selectedTaskId) return;
    const taskId = selectedTaskId;
    const profile = projectMembers.find((m) => m.profile_id === userId)?.profile ?? null;
    setFollowers((fs) => (fs.some((f) => f.user_id === userId) ? fs : [...fs, { task_id: taskId, user_id: userId, created_at: new Date().toISOString(), profile }]));
    persist(async () => {
      must(await addFollower(supabase, taskId, userId));
      if (currentUserId) must(await logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message: `added ${profile?.name ?? 'someone'} as a follower` }));
    }, 'followers', 'activity');
  };

  const handleFollowerRemove = async (userId: string) => {
    if (!selectedTaskId) return;
    const taskId = selectedTaskId;
    const name = followers.find((f) => f.user_id === userId)?.profile?.name
      ?? projectMembers.find((m) => m.profile_id === userId)?.profile?.name
      ?? 'a follower';
    setFollowers((fs) => fs.filter((f) => f.user_id !== userId));
    persist(async () => {
      must(await removeFollower(supabase, taskId, userId));
      if (currentUserId) {
        const message = userId === currentUserId ? 'stopped following the task' : `removed ${name} as a follower`;
        must(await logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message }));
      }
    }, 'followers', 'activity');
  };

  const buildActivityMessages = (updates: Record<string, unknown>, taskId?: string): string[] => {
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
    if ('due_locked' in updates) {
      messages.push(updates.due_locked ? 'locked the due date' : 'unlocked the due date');
    }
    if ('repeat' in updates) {
      const due = [...tasks, ...myTasks].flatMap((t) => [t, ...(t.subtasks ?? [])]).find((t) => t.id === taskId)?.due_date ?? null;
      const label = updates.repeat ? repeatLabel(updates.repeat as Repeat, due) : '';
      messages.push(label ? `set the task to repeat ${label.charAt(0).toLowerCase() + label.slice(1)}` : 'stopped the task repeating');
    }
    if ('completed' in updates) {
      messages.push(updates.completed ? 'marked the task complete' : 'marked the task incomplete');
    }

    return messages;
  };

  const handleTaskUpdate = async (taskId: string, updates: Record<string, unknown>) => {
    // new key each time so a second completion mid-animation restarts it
    if (updates.completed === true) setCelebration(Date.now());
    const optimistic: Partial<Task> = { ...updates };
    if ('assignee_id' in updates) optimistic.assignee = projectMembers.find((m) => m.profile_id === updates.assignee_id)?.profile ?? null;
    if ('completed' in updates) optimistic.completed_at = updates.completed ? new Date().toISOString() : null;
    patchTask(taskId, (t) => ({ ...t, ...optimistic }));
    // My Tasks is due-date ordered, so a new date moves the row to its place straight away
    if ('position' in updates || ('due_date' in updates && activeSection === 'my-tasks')) setResortToken((n) => n + 1);

    const messages = buildActivityMessages(updates, taskId);
    persist(async () => {
      // Feeds the follower notification's "detail" line, e.g. "set the due date to 12 Sep 2026".
      must(await updateTask(supabase, taskId, updates as any, messages.join(', ') || undefined));
      // the new assignee follows the task (creating a task already does this)
      if (updates.assignee_id) must(await addFollower(supabase, taskId, updates.assignee_id as string));
      if (!currentUserId) return;
      const results = await Promise.all(messages.map((message) => logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message })));
      results.forEach((r) => {
        if (r.error) console.error('Failed to log task activity:', r.error);
      });
    }, 'tasks', 'activity', 'followers');
  };

  const handleHeadingRename = async (headingId: string, name: string) => {
    setHeadings((hs) => hs.map((h) => (h.id === headingId ? { ...h, name } : h)));
    persist(async () => must(await updateHeading(supabase, headingId, { name })), 'headings');
  };

  const addHeadingLocally = (name: string): Heading => {
    const heading = { id: crypto.randomUUID(), project_id: activeProjectId, name, position: nextPosition(headings), created_at: new Date().toISOString() };
    setHeadings((hs) => [...hs, heading]);
    return heading;
  };
  const saveHeading = async (h: Heading) => must(await createHeading(supabase, { id: h.id, position: h.position, project_id: h.project_id, name: h.name }));

  const handleHeadingAdd = async (name: string) => {
    const heading = addHeadingLocally(name);
    persist(() => saveHeading(heading), 'headings');
  };

  const handleHeadingDelete = async (headingId: string) => {
    setHeadings((hs) => hs.filter((h) => h.id !== headingId));
    // tasks.heading_id is ON DELETE SET NULL
    setTasks((ts) => ts.map((t) => (t.heading_id === headingId ? { ...t, heading_id: null } : t)));
    persist(async () => must(await deleteHeading(supabase, headingId)), 'headings', 'tasks');
  };

  const handleNoHeadingRename = async (name: string, taskIds: string[]) => {
    const heading = addHeadingLocally(name);
    const moved = new Set(taskIds);
    setTasks((ts) => ts.map((t) => (moved.has(t.id) ? { ...t, heading_id: heading.id } : t)));
    persist(async () => {
      await saveHeading(heading);
      await Promise.all(taskIds.map(async (id) => must(await updateTask(supabase, id, { heading_id: heading.id }))));
    }, 'headings', 'tasks');
  };

  // Dragging a task onto another makes it a subtask (TaskTable only offers this for valid drops).
  const findAnyTask = (id: string) => tasks.find((t) => t.id === id) ?? tasks.flatMap((t) => t.subtasks ?? []).find((t) => t.id === id);
  // take a task out of wherever it sits: the top level or a parent's subtasks
  const detach = (ts: Task[], id: string) =>
    ts.filter((t) => t.id !== id).map((t) => (t.subtasks?.some((s) => s.id === id) ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== id) } : t));

  const handleMakeSubtask = (taskId: string, parentId: string) => {
    const task = findAnyTask(taskId);
    const parent = tasks.find((t) => t.id === parentId);
    if (!task || !parent || task.subtasks?.length || task.parent_task_id === parentId) return;
    // subtasks live under their parent, not a heading (same as ones created as subtasks)
    const moved: Task = { ...task, parent_task_id: parentId, heading_id: null, position: nextPosition(parent.subtasks ?? []), subtasks: [] };
    setTasks((ts) => detach(ts, taskId).map((t) => (t.id === parentId ? { ...t, subtasks: [...(t.subtasks ?? []), moved] } : t)));
    persist(async () => {
      must(await updateTask(supabase, taskId, { parent_task_id: parentId, heading_id: null, position: moved.position }));
      if (currentUserId) must(await logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message: `made this a subtask of "${parent.name}"` }));
    }, 'tasks', 'activity');
  };

  // Dragging a subtask onto a heading turns it back into a top-level task there.
  const handlePromoteSubtask = (taskId: string, headingId: string | null, position: number) => {
    const task = findAnyTask(taskId);
    if (!task?.parent_task_id) return;
    const parentName = tasks.find((t) => t.id === task.parent_task_id)?.name;
    setTasks((ts) => [...detach(ts, taskId), { ...task, parent_task_id: null, heading_id: headingId, position, subtasks: [] }]);
    persist(async () => {
      must(await updateTask(supabase, taskId, { parent_task_id: null, heading_id: headingId, position }));
      const message = parentName ? `moved this out of "${parentName}" into its own task` : 'made this a top-level task';
      if (currentUserId) must(await logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message }));
    }, 'tasks', 'activity');
  };

  const handleTaskReorder = async (taskId: string, swapWithTaskId: string) => {
    const a = tasks.find((t) => t.id === taskId) ?? tasks.flatMap((t) => t.subtasks ?? []).find((t) => t.id === taskId);
    const b = tasks.find((t) => t.id === swapWithTaskId) ?? tasks.flatMap((t) => t.subtasks ?? []).find((t) => t.id === swapWithTaskId);
    if (!a || !b) return;
    patchTask(a.id, (t) => ({ ...t, position: b.position }));
    patchTask(b.id, (t) => ({ ...t, position: a.position }));
    setResortToken((n) => n + 1);
    persist(() => Promise.all([
      updateTask(supabase, a.id, { position: b.position }).then(must),
      updateTask(supabase, b.id, { position: a.position }).then(must),
    ]), 'tasks');
  };

  const handleTagAdd = async (tag: Tag) => {
    if (!selectedTaskId) return;
    const taskId = selectedTaskId;
    patchTask(taskId, (t) => ({ ...t, tags: [...(t.tags ?? []).filter((x) => x.id !== tag.id), tag] }));
    persist(async () => {
      must(await addTagToTask(supabase, taskId, tag.id));
      if (currentUserId) must(await logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message: `added the tag "${tag.name}"` }));
    }, 'tasks', 'activity');
  };

  const handleTagRemove = async (tagId: string) => {
    if (!selectedTaskId) return;
    const taskId = selectedTaskId;
    const tagName = selectedTask?.tags?.find((t) => t.id === tagId)?.name ?? availableTags.find((t) => t.id === tagId)?.name ?? 'a tag';
    patchTask(taskId, (t) => ({ ...t, tags: (t.tags ?? []).filter((x) => x.id !== tagId) }));
    persist(async () => {
      must(await removeTagFromTask(supabase, taskId, tagId));
      if (currentUserId) must(await logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message: `removed the tag "${tagName}"` }));
    }, 'tasks', 'activity');
  };

  // Shows the new tag at once; its insert is queued, so anything tagged with it afterwards saves after it exists.
  const addTagLocally = (name: string, color: string): Tag => {
    const tag = { id: crypto.randomUUID(), name, color, created_by: currentUserId, created_at: new Date().toISOString() };
    setAvailableTags((prev) => [...prev, tag]);
    persist(async () => must(await createTag(supabase, { id: tag.id, name, color, created_by: currentUserId })));
    return tag;
  };

  const handleNewTag = async (name: string, color: string) => {
    await handleTagAdd(addTagLocally(name, color));
  };

  const handleProjectCreate = async () => {
    const name = window.prompt('Project name?');
    if (!name || !name.trim()) return;
    const colors = ['#4573D2', '#F06A6A', '#A970D1', '#4ECBC4', '#E8A5C8', '#F1BD6C'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const project: Project = { id: crypto.randomUUID(), name: name.trim(), color, icon: '📋', archived: false, position: 0, created_by: currentUserId, created_at: new Date().toISOString() };
    setProjects((ps) => [...ps, project]);
    setActiveSection('projects');
    setActiveProjectId(project.id);
    persist(async () => must(await createProject(supabase, { id: project.id, name: project.name, color, icon: project.icon, created_by: currentUserId })), 'projects', 'members');
  };

  // Import and Duplicate write the whole project before showing it (unlike the optimistic single creates),
  // so a failure shows in the dialog instead of leaving half a project on screen.
  const openNewProject = (project: Project) => {
    setProjects((ps) => [...ps, project]);
    setActiveSection('projects');
    setActiveProjectId(project.id);
    void resyncRef.current.projects();
  };

  const openImport = async () => {
    setShowImport(true);
    const { data } = await getProfiles(supabase);
    setAllPeople(data ?? []);
  };

  const handleProjectImport = async (name: string, plan: { sections: string[]; tasks: NewTaskSpec[] }) => {
    const colors = ['#4573D2', '#F06A6A', '#A970D1', '#4ECBC4', '#E8A5C8', '#F1BD6C'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    openNewProject(await createProjectWithContent(supabase, { name, color, icon: '📋', created_by: currentUserId!, ...plan }));
    setShowImport(false);
  };

  const handleProjectDuplicate = async (name: string, opts: { assignees: boolean; dueDates: boolean; completion: boolean; members: boolean }) => {
    const source = duplicateFrom!;
    const [t, h, m] = await Promise.all([getTasksForProject(supabase, source.id), getHeadings(supabase, source.id), getProjectMembers(supabase, source.id)]);
    if (t.error || h.error) throw t.error ?? h.error;
    const plan = projectToPlan(h.data ?? [], (t.data ?? []) as Task[], opts);
    const member_ids = opts.members ? (m.data ?? []).map((pm) => pm.profile_id).filter((id): id is string => !!id) : [];
    openNewProject(await createProjectWithContent(supabase, { name, color: source.color, icon: source.icon, created_by: currentUserId!, member_ids, ...plan }));
    setDuplicateFrom(null);
  };

  const handleCreateTaskClick = () => {
    if (!activeProjectId) {
      window.alert('Create or open a project first, then add tasks to it.');
      return;
    }
    setShowCreateTask(true);
  };

  // Global shortcuts: "c" opens Create task, "?" toggles the cheat sheet.
  // Ignored while typing anywhere (input/textarea/contentEditable) so they
  // don't fight with actually typing a "c" or "?" into a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCreateTaskClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeProjectId]);

  const submitCreateTask = async ({ tag_ids, new_heading, subtasks, comment, ...fields }: NewTaskInput) => {
    if (!activeProjectId) return;

    const heading = new_heading ? addHeadingLocally(new_heading) : null;
    const { follower_ids, ...taskFields } = fields;
    const task = newTask({
      ...taskFields,
      heading_id: heading?.id ?? fields.heading_id,
      position: nextPosition(tasks),
      assignee: projectMembers.find((m) => m.profile_id === fields.assignee_id)?.profile ?? null,
      tags: availableTags.filter((t) => tag_ids.includes(t.id)),
      comment_count: comment ? 1 : 0,
    });
    // positions keep subtasks in the order they were typed
    task.subtasks = subtasks.map((name, i) => newTask({ name, parent_task_id: task.id, position: i }));
    setTasks((ts) => [...ts, task]);
    setActiveSection('projects');
    setSelectedTaskId(task.id);

    persist(async () => {
      if (heading) await saveHeading(heading);
      must(await createTask(supabase, { ...taskFields, follower_ids, id: task.id, position: task.position, heading_id: task.heading_id, project_id: task.project_id, created_by: currentUserId }));
      await Promise.all([
        ...tag_ids.map((tagId) => addTagToTask(supabase, task.id, tagId).then(must)),
        ...(task.subtasks ?? []).map((s) =>
          createTask(supabase, { id: s.id, position: s.position, project_id: task.project_id, parent_task_id: task.id, name: s.name, created_by: currentUserId }).then(must)
        ),
        comment && currentUserId ? createComment(supabase, { task_id: task.id, author_id: currentUserId, body: comment, mentions: [] }).then(must) : null,
      ]);
    }, 'tasks', 'headings', 'comments', 'followers');
  };

  const handleProjectUpdate = async (updates: { name?: string; color?: string; icon?: string }) => {
    if (!activeProjectId) return;
    const projectId = activeProjectId;
    setProjects((ps) => ps.map((p) => (p.id === projectId ? { ...p, ...updates } : p)));
    persist(async () => must(await updateProject(supabase, projectId, updates)), 'projects');
  };

  const dropToNextProject = (remaining: Project[]) => {
    setProjects(remaining);
    setActiveProjectId(remaining[0]?.id ?? '');
  };

  const handleProjectArchive = async () => {
    if (!activeProjectId) return;
    if (!window.confirm('Archive this project? It\'ll disappear from the sidebar; an admin can bring it back later.')) return;
    const projectId = activeProjectId;
    dropToNextProject(projects.filter((p) => p.id !== projectId));
    persist(async () => must(await updateProject(supabase, projectId, { archived: true })), 'projects');
  };

  const handleProjectDelete = async (projectId: string = activeProjectId) => {
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId);
    const typed = window.prompt(
      `This permanently deletes "${project?.name}" and every task/comment in it. This cannot be undone.\n\nType the project name to confirm:`
    );
    if (typed !== project?.name) return;
    await deleteProject(supabase, projectId);
    const { data: projectRows } = await getProjects(supabase);
    const remaining = projectRows ?? [];
    // RLS silently skips a delete you're not allowed to do, so check it actually went
    if (remaining.some((p) => p.id === projectId)) {
      window.alert(`Couldn't delete "${project?.name}": only the project's owner or a super admin can do that.`);
      return;
    }
    if (projectId === activeProjectId) dropToNextProject(remaining);
    else setProjects(remaining);
  };

  const handleInvite = () => {
    if (!activeProjectId) {
      window.alert('Select a project first.');
      return;
    }
    setShowInvite(true);
  };

  const submitInvite = async (email: string, sendEmail: boolean) => {
    if (!activeProjectId) return { ok: false, message: 'Select a project first.' };

    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ email, projectId: activeProjectId, sendEmail }),
    });
    const result = await resp.json();
    if (!resp.ok) return { ok: false, message: result.error ?? resp.statusText };

    const { data: memberRows } = await getProjectMembers(supabase, activeProjectId);
    setProjectMembers(memberRows ?? []);

    if (result.link) {
      return { ok: true, message: `Link ready for ${email}.`, link: result.link as string };
    }
    return {
      ok: true,
      message: result.emailSent ? `Invite email sent to ${email}.` : `${email} already has an account and was added to the project.`,
    };
  };

  const openMembers = async () => {
    setShowMembers(true);
    const { data } = await getProfiles(supabase);
    setAllPeople(data ?? []);
  };

  const handleMemberAdd = async (profile: Profile) => {
    const projectId = activeProjectId;
    const now = new Date().toISOString();
    setProjectMembers((ms) => [...ms, { project_id: projectId, profile_id: profile.id, email: profile.email, role: 'member', invited_at: now, joined_at: now, profile }]);
    persist(async () => must(await addProjectMember(supabase, projectId, profile)), 'members');
  };

  const handleMemberRemove = async (member: ProjectMember) => {
    const name = member.profile?.name ?? member.email;
    if (!window.confirm(`Remove ${name} from this project? They'll lose access to its tasks.`)) return;
    const projectId = activeProjectId;
    setProjectMembers((ms) => ms.filter((m) => m.email !== member.email));
    persist(async () => must(await removeProjectMember(supabase, projectId, member.email)), 'members');
  };

  const handleProfileSave = async (updates: { name: string; initials: string; avatar_color: string; avatar_url: string | null }) => {
    if (!currentUserId || !currentProfile) return;
    const me = { ...currentProfile, ...updates };
    setCurrentProfile(me);
    // my avatar also shows in the member list
    setProjectMembers((ms) => ms.map((m) => (m.profile_id === currentUserId ? { ...m, profile: me } : m)));
    persist(async () => {
      const { data } = must(await updateProfile(supabase, currentUserId, updates));
      if (data) setCurrentProfile(data);
    }, 'members');
  };

  // ponytail: each upload gets a new file name (no stale browser cache); old photos stay in the bucket, clean up if storage ever matters
  const handlePhotoUpload = async (file: File) => {
    if (!currentUserId) throw new Error('Not signed in');
    const blob = await squareAvatarBlob(file);
    const path = `${currentUserId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
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

  const handleCommentAdd = async (body: string, mentions: string[]) => {
    if (!selectedTaskId || !currentUserId) return;
    const taskId = selectedTaskId;
    const [comment] = mapComments([{ id: crypto.randomUUID(), author_id: currentUserId, author: currentProfile, body, created_at: new Date().toISOString() }], currentUserId);
    setComments((prev) => [...prev, comment]);
    patchTask(taskId, (t) => ({ ...t, comment_count: (t.comment_count ?? 0) + 1 }));
    persist(async () => must(await createComment(supabase, { id: comment.id, task_id: taskId, author_id: currentUserId, body, mentions })), 'comments', 'followers', 'tasks');
  };

  // reloaded with the project list, so a project just created or joined counts straight away
  useEffect(() => {
    if (currentUserId) getMyProjectRoles(supabase, currentUserId).then(setMyRoles);
  }, [currentUserId, projects, supabase]);
  const canManage = (projectId: string | undefined) => {
    const role = projectId ? myRoles.get(projectId) : undefined;
    return !!currentProfile?.is_super_admin || role === 'owner' || role === 'admin';
  };
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // A request on a locked due date is a comment carrying the wanted date; managers get notified by the database (026).
  const handleExtensionRequest = (date: string, reason: string) => {
    if (!selectedTaskId || !currentUserId) return;
    const taskId = selectedTaskId;
    const body = reason || 'Could the due date move?';
    const [comment] = mapComments([{ id: crypto.randomUUID(), author_id: currentUserId, author: currentProfile, body, created_at: new Date().toISOString(), requested_due_date: date, request_status: 'pending' }], currentUserId);
    setComments((prev) => [...prev, comment]);
    patchTask(taskId, (t) => ({ ...t, comment_count: (t.comment_count ?? 0) + 1 }));
    persist(async () => {
      must(await createComment(supabase, { id: comment.id, task_id: taskId, author_id: currentUserId, body, requested_due_date: date }));
      await logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message: `asked for an extension to ${formatDate(date)}` });
    }, 'comments', 'followers', 'tasks', 'activity');
  };

  const handleRequestAnswer = (commentId: string, approve: boolean) => {
    const c = comments.find((x) => x.id === commentId);
    if (!selectedTaskId || !currentUserId || !c?.requestedDueDate) return;
    const taskId = selectedTaskId;
    setComments((prev) => prev.map((x) => (x.id === commentId ? { ...x, requestStatus: approve ? 'approved' : 'declined' } : x)));
    persist(async () => {
      must(await answerExtensionRequest(supabase, commentId, approve));
      await logActivity(supabase, { task_id: taskId, actor_id: currentUserId, message: `${approve ? 'approved' : 'declined'} ${c.authorName}'s extension request` });
    }, 'comments', 'activity');
    // logs "set the due date to …" itself
    if (approve) void handleTaskUpdate(taskId, { due_date: c.requestedDueDate });
  };

  const handleCommentEdit = async (commentId: string, body: string) => {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, body, editedAt: new Date().toISOString() } : c)));
    persist(async () => must(await updateComment(supabase, commentId, { body })), 'comments');
  };

  const handleCommentLike = async (commentId: string) => {
    const c = comments.find((x) => x.id === commentId);
    if (!c || !currentUserId) return;
    const liked = !c.liked;
    const apply = (l: boolean) =>
      setComments((prev) =>
        prev.map((x) => (x.id === commentId ? { ...x, liked: l, likes: Math.max(0, x.likes + (l ? 1 : -1)) } : x))
      );
    apply(liked);
    const { error } = await setCommentLike(supabase, commentId, currentUserId, liked);
    if (error) {
      console.error('Error liking comment:', error);
      apply(!liked);
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    if (selectedTaskId) patchTask(selectedTaskId, (t) => ({ ...t, comment_count: Math.max(0, (t.comment_count ?? 0) - 1) }));
    persist(async () => must(await deleteComment(supabase, commentId)), 'comments', 'tasks');
  };

  // `ids` is one inbox row: a single notification, or a task's grouped run of updates
  const handleNotificationClick = async (ids: string[]) => {
    const notif = notifications.find((n) => n.id === ids[0]);
    const unread = new Set(notifications.filter((n) => ids.includes(n.id) && !n.readAt).map((n) => n.id));
    if (unread.size) {
      // Slack-style: the item stays in the feed as history, just loses its unread state.
      setNotifications((prev) => prev.map((n) => (unread.has(n.id) ? { ...n, readAt: new Date().toISOString() } : n)));
      setNotificationsBadge((c) => Math.max(0, c - unread.size));
      persist(async () => must(await markNotificationsRead(supabase, [...unread])), 'notifications');
    }
    // Asana-style: stay in the inbox and open the task in the side panel. Loading
    // the task's project in the background is what makes the panel able to find it.
    if (notif?.projectId && notif?.taskId) {
      setActiveProjectId(notif.projectId);
      setSelectedTaskId(notif.taskId);
      setFocusCommentId(notif.commentId ?? null);
    }
  };

  // right-click on an inbox row
  const handleNotificationsMarkRead = (ids: string[], read: boolean) => {
    const changing = new Set(notifications.filter((n) => ids.includes(n.id) && !n.readAt === read).map((n) => n.id));
    if (!changing.size) return;
    setNotifications((prev) => prev.map((n) => (changing.has(n.id) ? { ...n, readAt: read ? new Date().toISOString() : null } : n)));
    setNotificationsBadge((c) => Math.max(0, c + (read ? -changing.size : changing.size)));
    persist(async () => must(await markNotificationsRead(supabase, [...changing], read)), 'notifications');
  };

  // stable identity so GlobalSearch's debounce effect doesn't re-run every render
  const runTaskSearch = useCallback((q: string) => searchTasks(supabase, q), [supabase]);

  const openInProject = (projectId: string, taskId?: string | null) => {
    setActiveProjectId(projectId);
    setSelectedTaskId(taskId ?? null);
    setActiveSection('projects');
  };

  const handleMarkAllRead = async () => {
    if (!currentUserId) return;
    const uid = currentUserId;
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setNotificationsBadge(0);
    persist(async () => must(await markAllNotificationsRead(supabase, uid)), 'notifications');
  };

  // Ticking a row off clears it from the inbox.
  const handleNotificationsClear = (ids: string[]) => {
    const gone = new Set(ids);
    const unreadGone = notifications.filter((n) => gone.has(n.id) && !n.readAt).length;
    setNotifications((prev) => prev.filter((n) => !gone.has(n.id)));
    setNotificationsBadge((c) => Math.max(0, c - unreadGone));
    persist(async () => must(await clearNotifications(supabase, ids)), 'notifications');
  };

  const handleClearAllNotifications = () => {
    if (!currentUserId) return;
    const uid = currentUserId;
    setNotifications([]);
    setNotificationsBadge(0);
    persist(async () => must(await clearAllNotifications(supabase, uid)), 'notifications');
  };

  return (
    <div className="app-container">
      <TopBar
        onHamburgerClick={() => setSidebarOpen((o) => !o)}
        sidebarOpen={sidebarOpen}
        onCreateTask={handleCreateTaskClick}
        userName={currentProfile?.name}
        userEmail={currentProfile?.email}
        search={
          <GlobalSearch
            projects={projects}
            searchTasks={runTaskSearch}
            onOpenTask={openInProject}
            onOpenProject={(projectId) => openInProject(projectId)}
          />
        }
        avatarInitials={currentProfile?.initials || avatarInitials(currentProfile?.name, currentProfile?.email)}
        avatarColor={currentProfile?.avatar_color ?? 'var(--accent)'}
        avatarUrl={currentProfile?.avatar_url}
        isSuperAdmin={!!currentProfile?.is_super_admin}
        onOpenProfile={() => setShowProfile(true)}
        onChangePassword={handleChangePassword}
        onLogout={handleLogout}
        onShowShortcuts={() => setShowShortcuts(true)}
      />

      {(showProfile || needsFullName) && currentProfile && (
        <ProfileModal
          profile={currentProfile}
          onSave={handleProfileSave}
          onUploadPhoto={handlePhotoUpload}
          requireFullName={needsFullName}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showInvite && (
        <InviteModal onInvite={submitInvite} onClose={() => setShowInvite(false)} />
      )}
      {showImport && <ProjectImportModal people={allPeople} onImport={handleProjectImport} onClose={() => setShowImport(false)} />}
      {duplicateFrom && <ProjectDuplicateModal sourceName={duplicateFrom.name} onDuplicate={handleProjectDuplicate} onClose={() => setDuplicateFrom(null)} />}

      {showCreateTask && (
        <CreateTaskModal
          members={projectMembers}
          headings={sortedHeadings}
          tags={availableTags}
          onCreateTag={async (name) => {
            const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
            return addTagLocally(name, color);
          }}
          onCreate={submitCreateTask}
          onClose={() => setShowCreateTask(false)}
        />
      )}

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {celebration && <TukTukCelebration key={celebration} onDone={endCelebration} />}

      {showMembers && (
        <MembersModal
          projectName={currentProject?.name ?? 'Project'}
          members={projectMembers}
          people={allPeople}
          currentUserId={currentUserId}
          isPrivate={!!currentProject?.is_private}
          onAdd={handleMemberAdd}
          onRemove={handleMemberRemove}
          onClose={() => setShowMembers(false)}
        />
      )}

      <div className={`app-main ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
        <Sidebar
          activeSection={activeSection}
          activeProjectId={activeProjectId}
          projects={projects}
          myTasksBadge={myTasksBadge}
          notificationsBadge={notificationsBadge}
          onSectionChange={(section) => {
            // don't carry a task open elsewhere into the inbox's side panel
            if (section === 'inbox') setSelectedTaskId(null);
            setActiveSection(section);
          }}
          onProjectSelect={setActiveProjectId}
          onProjectHover={prefetchProject}
          onProjectCreate={handleProjectCreate}
          onProjectImport={openImport}
          canCreateProjects={!!currentProfile?.can_create_projects}
          onProjectDuplicate={(id) => setDuplicateFrom(projects.find((p) => p.id === id) ?? null)}
          onProjectDelete={handleProjectDelete}
          onProjectRename={(projectId, name) => {
            setProjects((ps) => ps.map((p) => (p.id === projectId ? { ...p, name } : p)));
            // RLS lets only owners/admins rename; a blocked update errors and the resync restores the old name
            persist(async () => must(await updateProject(supabase, projectId, { name })), 'projects');
          }}
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
                isPrivate={!!currentProject?.is_private}
                isSuperAdmin={!!currentProfile?.is_super_admin}
                members={projectMembers}
                currentUserId={currentUserId}
                onInvite={handleInvite}
                onShowMembers={openMembers}
                onProjectUpdate={handleProjectUpdate}
                onProjectArchive={handleProjectArchive}
                onProjectDelete={() => handleProjectDelete()}
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

              {currentProfile?.is_super_admin && (
                <div className="bulk-bar">
                  {bulk ? (
                    <>
                      <span className="bulk-count">{bulk.size} selected</span>
                      <button type="button" className="bulk-btn" onClick={() => setBulk(new Set(allVisibleTaskIds))}>
                        Select all ({allVisibleTaskIds.length})
                      </button>
                      <button type="button" className="bulk-btn" onClick={() => setBulk(new Set())} disabled={bulk.size === 0}>
                        Clear
                      </button>
                      <button type="button" className="bulk-btn is-danger" onClick={handleBulkDelete} disabled={bulk.size === 0}>
                        {`Delete ${bulk.size || ''}`}
                      </button>
                      <button type="button" className="bulk-btn" onClick={() => setBulk(null)}>Done</button>
                    </>
                  ) : (
                    <button type="button" className="bulk-btn" onClick={() => setBulk(new Set())}>
                      Select tasks
                    </button>
                  )}
                </div>
              )}

              <div className="app-content">
                {!loading && activeProjectId ? (
                  <>
                    <TaskTable
                      canManage={(projectId: string) => canManage(projectId)}
                      members={projectMembers}
                      onTaskHover={prefetchTask}
                      onMakeSubtask={handleMakeSubtask}
                      onPromoteSubtask={handlePromoteSubtask}
                      showCompleted={showCompleted}
                      tasks={displayedTasks}
                      headings={sortedHeadings}
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
                      bulkSelected={bulk}
                      onBulkToggle={(id) =>
                        setBulk((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        })
                      }
                    />
                    {selectedTask && (
                      <div className="detail-panel-backdrop" onClick={() => setSelectedTaskId(null)} />
                    )}
                    {selectedTask && (
                      <TaskDetailPanel
                        key={selectedTask.id}
                        task={selectedTask}
                        projectMembers={projectMembers}
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
                        onCommentLike={handleCommentLike}
                        canManage={canManage(selectedTask?.project_id)}
                        onExtensionRequest={handleExtensionRequest}
                        onRequestAnswer={handleRequestAnswer}
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
                  canManage={(projectId: string) => canManage(projectId)}
                  members={projectMembers}
                  onTaskHover={prefetchTask}
                  onMakeSubtask={handleMakeSubtask}
                  onPromoteSubtask={handlePromoteSubtask}
                  showCompleted={showCompleted}
                  tasks={displayedTasks}
                  headings={[]}
                  flat
                  onOpenProject={openInProject}
                  onTaskSelect={setSelectedTaskId}
                  selectedTaskId={selectedTaskId}
                  currentUserId={currentUserId}
                  onTaskAdd={async () => window.alert('Open a project to add tasks there.')}
                  onSubtaskAdd={handleSubtaskAdd}
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
                    availableTags={availableTags}
                    comments={comments}
                    commentsLoading={commentsLoading}
                    followers={followers}
                    activity={activity}
                    currentUserId={currentUserId}
                    onFollowerAdd={handleFollowerAdd}
                    onFollowerRemove={handleFollowerRemove}
                    onSubtaskAdd={handleSubtaskAdd}
                    onOpenInProject={() => selectedTask.project_id && openInProject(selectedTask.project_id, selectedTask.id)}
                    project={projects.find((p) => p.id === selectedTask.project_id)}
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
                    onCommentLike={handleCommentLike}
                    canManage={canManage(selectedTask?.project_id)}
                    onExtensionRequest={handleExtensionRequest}
                    onRequestAnswer={handleRequestAnswer}
                  />
                )}
              </div>
            </>
          )}

          {activeSection === 'inbox' && (
            <div className="app-content">
              <Inbox
                notifications={notifications}
                loading={notificationsLoading}
                openTaskId={selectedTask?.id ?? null}
                projects={projects}
                onNotificationClick={handleNotificationClick}
                onOpenProject={openInProject}
                onMarkAllRead={handleMarkAllRead}
                onMarkRead={handleNotificationsMarkRead}
                onClear={handleNotificationsClear}
                onClearAll={handleClearAllNotifications}
              />
              {selectedTask && (
                <div className="detail-panel-backdrop" onClick={() => setSelectedTaskId(null)} />
              )}
              {selectedTask && (
                <TaskDetailPanel
                  key={selectedTask.id}
                  task={selectedTask}
                  projectMembers={projectMembers}
                  availableTags={availableTags}
                  comments={comments}
                  commentsLoading={commentsLoading}
                  followers={followers}
                  activity={activity}
                  currentUserId={currentUserId}
                  onFollowerAdd={handleFollowerAdd}
                  onFollowerRemove={handleFollowerRemove}
                  onSubtaskAdd={handleSubtaskAdd}
                  onOpenInProject={() => selectedTask.project_id && openInProject(selectedTask.project_id, selectedTask.id)}
                  project={projects.find((p) => p.id === selectedTask.project_id)}
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
                  onCommentLike={handleCommentLike}
                  canManage={canManage(selectedTask?.project_id)}
                  onExtensionRequest={handleExtensionRequest}
                  onRequestAnswer={handleRequestAnswer}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
