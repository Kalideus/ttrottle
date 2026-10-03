import type { SupabaseClient } from '@supabase/supabase-js'

export type Project = {
  id: string
  name: string
  color: string
  icon: string
  archived: boolean
  position: number
  created_by: string | null
  created_at: string
  is_private?: boolean
}

export type Heading = {
  id: string
  project_id: string
  name: string
  position: number
  created_at: string
}

export type Task = {
  id: string
  project_id: string
  heading_id: string | null
  parent_task_id: string | null
  name: string
  description: string | null
  assignee_id: string | null
  due_date: string | null
  priority: 'low' | 'medium' | 'high' | null
  completed: boolean
  completed_at: string | null
  position: number
  created_by: string | null
  created_at: string
  deleted_at?: string | null
  deleted_by?: string | null
  assignee?: Profile | null
  subtasks?: Task[]
  tags?: Tag[]
  comment_count?: number
  project?: { id: string; name: string; color: string } | null
  deletedByProfile?: Profile | null
}

export type Comment = {
  id: string
  task_id: string
  author_id: string
  body: string
  mentions: string[]
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

export type Tag = {
  id: string
  name: string
  color: string
  created_by: string | null
  created_at: string
}

export type Profile = {
  id: string
  name: string
  email: string
  initials: string
  avatar_url: string | null
  avatar_color: string | null
  can_create_projects?: boolean
  is_super_admin?: boolean
}

export type Notification = {
  id: string
  user_id: string
  task_id: string
  type: 'comment' | 'mention' | 'assigned' | 'due_soon' | 'completed' | 'updated'
  actor_id: string
  comment_id: string | null
  read_at: string | null
  created_at: string
}

export type Follower = {
  task_id: string
  user_id: string
  created_at: string
  profile?: Profile | null
}

export type TaskActivity = {
  id: string
  task_id: string
  actor_id: string | null
  message: string
  created_at: string
  actor?: Profile | null
}

export type FilterDef = {
  field: 'assignee' | 'due_date' | 'priority' | 'tag' | 'completion'
  operator: string
  value: string | string[] | null
}

export type UserViewPrefs = {
  user_id: string
  view_key: string
  filters: FilterDef[]
  sort_field: string | null
  sort_direction: 'asc' | 'desc'
  updated_at: string
}

export type TaskWithRelations = Task & {
  assignee: Profile | null
  subtasks: Task[]
  tags: Tag[]
  comment_count: number
}

// Top-bar search: task names containing `query`, across every project the
// user can see (RLS does the scoping). Open tasks first.
export async function searchTasks(supabase: SupabaseClient, query: string) {
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const { data } = await supabase
    .from('tasks')
    .select('id, name, project_id, completed, parent_task_id')
    .ilike('name', pattern)
    .is('deleted_at', null)
    .order('completed', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(10)
  return data ?? []
}

export async function getProjects(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('archived', false)

  // Private project first, then A-Z. `numeric` sorts "2. X" before "10. X",
  // so people can force an order by numbering names.
  data?.sort(
    (a, b) =>
      Number(!!b.is_private) - Number(!!a.is_private) ||
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )

  return { data, error }
}

export async function createProject(
  supabase: SupabaseClient,
  { name, color, icon, created_by, id }: { name: string; color: string; icon: string; created_by?: string | null; id?: string }
) {
  const { data: existing } = await supabase
    .from('projects')
    .select('position')
    .eq('archived', false)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing?.[0]?.position != null ? Number(existing[0].position) + 1 : 0

  const result = await supabase
    .from('projects')
    .insert({ ...(id && { id }), name, color, icon, position: nextPosition, archived: false, created_by: created_by ?? null })
    .select()
    .single()

  if (result.data && created_by) {
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', created_by).single()
    if (profile?.email) {
      await supabase.from('project_members').insert({
        project_id: result.data.id,
        profile_id: created_by,
        email: profile.email,
        // Creators start as Manager ('admin'), not Owner: deleting the project and
        // changing roles stay with super admins. Needs migration 023.
        role: 'admin',
        joined_at: new Date().toISOString(),
      })
    }
  }

  return result
}

export async function updateProject(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<Project, 'name' | 'color' | 'icon' | 'archived'>>
) {
  return supabase.from('projects').update(updates).eq('id', id).select().single()
}

export async function deleteProject(supabase: SupabaseClient, id: string) {
  return supabase.from('projects').delete().eq('id', id)
}

export async function getHeadings(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('headings')
    .select('*')
    .eq('project_id', projectId)
    .order('position', { ascending: true })

  return { data, error }
}

export async function createHeading(
  supabase: SupabaseClient,
  { project_id, name, id, position }: { project_id: string; name: string; id?: string; position?: number }
) {
  let nextPosition = position
  if (nextPosition == null) {
    const { data: existing } = await supabase
      .from('headings')
      .select('position')
      .eq('project_id', project_id)
      .order('position', { ascending: false })
      .limit(1)
    nextPosition = existing?.[0]?.position != null ? Number(existing[0].position) + 1 : 0
  }

  return supabase
    .from('headings')
    .insert({ ...(id && { id }), project_id, name, position: nextPosition })
    .select()
    .single()
}

export async function updateHeading(supabase: SupabaseClient, id: string, { name }: { name: string }) {
  return supabase.from('headings').update({ name }).eq('id', id).select().single()
}

export async function deleteHeading(supabase: SupabaseClient, id: string) {
  // tasks.heading_id has ON DELETE SET NULL, so tasks under this heading just fall back to "(no heading)".
  return supabase.from('headings').delete().eq('id', id)
}

// tasks.assignee_id / comments.author_id / notifications.actor_id have FKs that point at
// auth.users, not public.profiles — PostgREST can't embed across schemas, so these are
// resolved with a manual second lookup instead of a `!fkey` embed.
async function attachProfilesById<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  rows: T[],
  idField: keyof T,
  targetField: string
) {
  const ids = Array.from(new Set(rows.map((r) => r[idField]).filter(Boolean))) as string[]
  const profileMap = new Map<string, Profile>()

  if (ids.length) {
    const { data } = await supabase.from('profiles').select('*').in('id', ids)
    ;(data ?? []).forEach((p: Profile) => profileMap.set(p.id, p))
  }

  return rows.map((r) => ({ ...r, [targetField]: profileMap.get(r[idField] as string) ?? null }))
}

export async function getTasksForProject(supabase: SupabaseClient, projectId: string) {
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      subtasks:tasks!parent_task_id(*)
    `)
    .eq('project_id', projectId)
    .is('parent_task_id', null)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    // without this the embedded subtasks come back in arbitrary order and can shuffle on refresh
    .order('position', { referencedTable: 'subtasks', ascending: true })
    .order('created_at', { referencedTable: 'subtasks', ascending: true })

  if (tasksError) return { data: [], error: tasksError }

  const taskIds = (tasks ?? []).map((task) => task.id)
  // subtasks have tags too
  const allTaskIds = (tasks ?? []).flatMap((task) => [task.id, ...(task.subtasks ?? []).map((st: Task) => st.id)])

  const assigneeIds = new Set<string>()
  ;(tasks ?? []).forEach((task) => {
    if (task.assignee_id) assigneeIds.add(task.assignee_id)
    ;(task.subtasks ?? []).forEach((st: Task) => st.assignee_id && assigneeIds.add(st.assignee_id))
  })

  // The three lookups only depend on the task rows, so fetch them in parallel.
  const empty = Promise.resolve({ data: null })
  const [{ data: counts }, { data: profiles }, { data: taskTagRows }] = await Promise.all([
    taskIds.length ? supabase.rpc('get_comment_counts', { task_ids: taskIds }) : empty,
    assigneeIds.size ? supabase.from('profiles').select('*').in('id', Array.from(assigneeIds)) : empty,
    // Fetched separately (not embedded) so a missing task_tags table can't fail task loading itself.
    allTaskIds.length ? supabase.from('task_tags').select('task_id, tags(*)').in('task_id', allTaskIds) : empty,
  ])

  const countMap = new Map((counts ?? []).map((row: { task_id: string; count: number }) => [row.task_id, row.count]))
  const profileMap = new Map<string, Profile>()
  ;(profiles ?? []).forEach((p: Profile) => profileMap.set(p.id, p))

  const tagsByTask = new Map<string, Tag[]>()
  ;(taskTagRows ?? []).forEach((row: any) => {
    const tag = row.tags as Tag | null
    if (!tag) return
    const existing = tagsByTask.get(row.task_id) ?? []
    existing.push(tag)
    tagsByTask.set(row.task_id, existing)
  })

  const normalized = (tasks ?? []).map((task) => ({
    ...task,
    assignee: task.assignee_id ? profileMap.get(task.assignee_id) ?? null : null,
    subtasks: (task.subtasks ?? [])
      .filter((subtask: Task) => !subtask.deleted_at)
      .map((subtask: Task) => ({
        ...subtask,
        assignee: subtask.assignee_id ? profileMap.get(subtask.assignee_id) ?? null : null,
        tags: tagsByTask.get(subtask.id) ?? [],
      })),
    comment_count: countMap.get(task.id) ?? 0,
    tags: tagsByTask.get(task.id) ?? [],
  }))

  return { data: normalized, error: null }
}

async function notifyAssignee(supabase: SupabaseClient, { taskId, assigneeId, actorId }: { taskId: string; assigneeId: string; actorId: string | null }) {
  await supabase.from('followers').upsert({ task_id: taskId, user_id: assigneeId }, { onConflict: 'task_id,user_id', ignoreDuplicates: true })

  if (actorId && actorId !== assigneeId) {
    await supabase.from('notifications').insert({
      user_id: assigneeId,
      task_id: taskId,
      type: 'assigned',
      actor_id: actorId,
    })
  }
}

export async function createTask(
  supabase: SupabaseClient,
  {
    project_id,
    heading_id,
    parent_task_id,
    name,
    description,
    assignee_id,
    due_date,
    priority,
    created_by,
    follower_ids,
    id,
    position,
  }: {
    id?: string
    position?: number
    project_id?: string
    heading_id?: string | null
    parent_task_id?: string | null
    name: string
    description?: string | null
    assignee_id?: string | null
    due_date?: string | null
    priority?: 'low' | 'medium' | 'high' | null
    created_by?: string | null
    follower_ids?: string[]
  }
) {
  const payload: Record<string, unknown> = {
    name,
    description: description ?? null,
    assignee_id: assignee_id ?? null,
    due_date: due_date ?? null,
    priority: priority ?? null,
    created_by: created_by ?? null,
    parent_task_id: parent_task_id ?? null,
    heading_id: heading_id ?? null,
    project_id: project_id ?? null,
  }

  // id/position may be chosen by the caller so an optimistic row on screen is the real one
  if (id) payload.id = id
  if (position != null) payload.position = position

  const result = await supabase.from('tasks').insert(payload).select().single()

  if (result.data) {
    // creator, chosen followers and the assignee all follow the task: one upsert
    const followerIds = Array.from(new Set([created_by, assignee_id, ...(follower_ids ?? [])].filter(Boolean))) as string[]
    await Promise.all([
      followerIds.length &&
        supabase.from('followers').upsert(
          followerIds.map((user_id) => ({ task_id: result.data.id, user_id })),
          { onConflict: 'task_id,user_id', ignoreDuplicates: true }
        ),
      assignee_id && created_by && assignee_id !== created_by &&
        supabase.from('notifications').insert({ user_id: assignee_id, task_id: result.data.id, type: 'assigned', actor_id: created_by }),
    ])
  }

  return result
}

export async function getFollowers(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase.from('followers').select('*').eq('task_id', taskId)
  if (error) return { data: [], error }

  const withProfiles = await attachProfilesById(supabase, data ?? [], 'user_id', 'profile')
  return { data: withProfiles as Follower[], error: null }
}

export async function addFollower(supabase: SupabaseClient, taskId: string, userId: string) {
  return supabase.from('followers').upsert({ task_id: taskId, user_id: userId }, { onConflict: 'task_id,user_id', ignoreDuplicates: true })
}

export async function removeFollower(supabase: SupabaseClient, taskId: string, userId: string) {
  return supabase.from('followers').delete().eq('task_id', taskId).eq('user_id', userId)
}

export async function getTaskActivity(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from('task_activity')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error }

  const withActors = await attachProfilesById(supabase, data ?? [], 'actor_id', 'actor')
  return { data: withActors as TaskActivity[], error: null }
}

export async function logActivity(
  supabase: SupabaseClient,
  { task_id, actor_id, message }: { task_id: string; actor_id: string | null; message: string }
) {
  return supabase.from('task_activity').insert({ task_id, actor_id, message })
}

export async function updateTask(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<Task, 'name' | 'description' | 'assignee_id' | 'due_date' | 'priority' | 'completed' | 'heading_id' | 'position' | 'parent_task_id'>>,
  detail?: string
) {
  const nextUpdates: Partial<Task & { completed_at: string | null }> = { ...updates }

  if (nextUpdates.completed === true) {
    nextUpdates.completed_at = new Date().toISOString()
  }

  if (nextUpdates.completed === false) {
    nextUpdates.completed_at = null
  }

  const result = await supabase.from('tasks').update(nextUpdates).eq('id', id).select().single()

  if (result.data) {
    // local session read, no auth round trip; RLS still verifies the token on every write
    const { data: authData } = await supabase.auth.getSession()
    const actorId = authData.session?.user.id ?? null

    if ('assignee_id' in updates && updates.assignee_id) {
      await notifyAssignee(supabase, { taskId: id, assigneeId: updates.assignee_id, actorId })
    }

    // Followers care about substantive edits, not manual drag-reorder (`position`) or the
    // assignment itself (already covered by notifyAssignee above).
    const notifiableFields: Array<keyof typeof updates> = ['name', 'description', 'due_date', 'priority', 'heading_id', 'completed']
    const changed = notifiableFields.some((field) => field in updates)

    if (changed && actorId) {
      const { data: followers } = await supabase.from('followers').select('user_id').eq('task_id', id).neq('user_id', actorId)
      if (followers?.length) {
        const type = updates.completed === true ? 'completed' : 'updated'
        const { error: notifyError } = await supabase.from('notifications').insert(
          followers.map((f) => ({ user_id: f.user_id, task_id: id, type, actor_id: actorId, detail: detail ?? null }))
        )
        if (notifyError) console.error('Failed to notify followers of task update:', notifyError)
      }
    }
  }

  return result
}

// Soft delete: anyone can delete a task, but it's recoverable for 90 days
// (see /admin/deleted-tasks and the purge cron) rather than gone for good.
export async function deleteTask(supabase: SupabaseClient, id: string, deletedBy?: string | null) {
  return supabase.from('tasks').update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy ?? null }).eq('id', id)
}

export async function restoreTask(supabase: SupabaseClient, id: string) {
  return supabase.from('tasks').update({ deleted_at: null, deleted_by: null }).eq('id', id)
}

export async function getDeletedTasks(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, project:projects!tasks_project_id_fkey(id, name, color)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) return { data: [], error }

  const deleterIds = Array.from(new Set((data ?? []).map((t) => t.deleted_by).filter(Boolean))) as string[]
  const deleterMap = new Map<string, Profile>()
  if (deleterIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', deleterIds)
    ;(profiles ?? []).forEach((p: Profile) => deleterMap.set(p.id, p))
  }

  const withDeleter = (data ?? []).map((t) => ({
    ...t,
    deletedByProfile: t.deleted_by ? deleterMap.get(t.deleted_by) ?? null : null,
  }))
  return { data: withDeleter, error: null }
}

export async function getMyTasks(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      project:projects!tasks_project_id_fkey(id, name, color),
      subtasks:tasks!parent_task_id(*)
    `)
    .eq('assignee_id', userId)
    .eq('completed', false)
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .order('position', { referencedTable: 'subtasks', ascending: true })
    .order('created_at', { referencedTable: 'subtasks', ascending: true })

  // ponytail: subtasks come without assignee profiles here; join them like getTasksForProject if avatars are wanted
  return {
    data: (data ?? []).map((t) => ({ ...t, subtasks: (t.subtasks ?? []).filter((st: Task) => !st.deleted_at) })),
    error,
  }
}

export async function getComments(supabase: SupabaseClient, taskId: string) {
  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error }

  // Likes are best-effort: if the table is missing (migration 015 not run) comments still load.
  const ids = (comments ?? []).map((c) => c.id)
  const [withAuthors, { data: likes }] = await Promise.all([
    attachProfilesById(supabase, comments ?? [], 'author_id', 'author'),
    ids.length
      ? supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', ids)
      : Promise.resolve({ data: [] as { comment_id: string; user_id: string }[] }),
  ])
  const byComment = new Map<string, string[]>()
  for (const l of likes ?? []) byComment.set(l.comment_id, [...(byComment.get(l.comment_id) ?? []), l.user_id])

  return { data: withAuthors.map((c: any) => ({ ...c, like_user_ids: byComment.get(c.id) ?? [] })), error: null }
}

export async function setCommentLike(supabase: SupabaseClient, commentId: string, userId: string, liked: boolean) {
  const q = supabase.from('comment_likes')
  return liked
    ? q.upsert({ comment_id: commentId, user_id: userId })
    : q.delete().eq('comment_id', commentId).eq('user_id', userId)
}

export async function createComment(
  supabase: SupabaseClient,
  {
    task_id,
    author_id,
    body,
    mentions,
    id,
  }: {
    task_id: string
    author_id: string
    body: string
    mentions?: string[]
    id?: string
  }
) {
  const insertPayload = {
    ...(id && { id }),
    task_id,
    author_id,
    body,
    mentions: mentions ?? [],
  }

  const result = await supabase
    .from('comments')
    .insert(insertPayload)
    .select('*')
    .single()

  if (result.data) {
    // independent of each other: the follower list excludes the author, so it doesn't wait on the author's upsert
    const [{ data: authorProfile }, , { data: followers }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', author_id).single(),
      supabase.from('followers').upsert({ task_id, user_id: author_id }, { onConflict: 'task_id,user_id', ignoreDuplicates: true }),
      supabase.from('followers').select('user_id').eq('task_id', task_id).neq('user_id', author_id),
    ])
    ;(result.data as Record<string, unknown>).author = authorProfile ?? null

    const snippet = body.length > 140 ? `${body.slice(0, 140)}…` : body
    const row = (user_id: string, type: string) => ({ user_id, task_id, type, actor_id: author_id, comment_id: result.data.id, detail: snippet })

    // followers get a 'comment' notification; mentioned non-followers get a 'mention' one
    const followerIds = new Set((followers ?? []).map((f) => f.user_id))
    const mentionOnly = (mentions ?? []).filter((uid) => uid !== author_id && !followerIds.has(uid))
    const notifications = [...[...followerIds].map((uid) => row(uid, 'comment')), ...mentionOnly.map((uid) => row(uid, 'mention'))]
    if (notifications.length) {
      const { error: notifyError } = await supabase.from('notifications').insert(notifications)
      if (notifyError) console.error('Failed to notify followers/mentions of comment:', notifyError)
    }
  }

  return result
}

export async function updateComment(supabase: SupabaseClient, id: string, { body }: { body: string }) {
  return supabase
    .from('comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

export async function deleteComment(supabase: SupabaseClient, id: string) {
  return supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
}

export async function getTags(supabase: SupabaseClient) {
  return supabase.from('tags').select('*').order('name', { ascending: true })
}

export async function createTag(
  supabase: SupabaseClient,
  { name, color, created_by, id }: { name: string; color: string; created_by: string | null; id?: string }
) {
  return supabase.from('tags').insert({ ...(id && { id }), name, color, created_by }).select().single()
}

export async function addTagToTask(supabase: SupabaseClient, taskId: string, tagId: string) {
  return supabase.from('task_tags').insert({ task_id: taskId, tag_id: tagId })
}

export async function removeTagFromTask(supabase: SupabaseClient, taskId: string, tagId: string) {
  return supabase.from('task_tags').delete().eq('task_id', taskId).eq('tag_id', tagId)
}

export async function getTaskTags(supabase: SupabaseClient, taskId: string) {
  return supabase.from('task_tags').select('tags(*)').eq('task_id', taskId)
}

export async function getNotifications(supabase: SupabaseClient, userId: string, { limit = 50 } = {}) {
  // Slack-style: the feed keeps read items as history; unread ones are highlighted
  // and counted in the badge (getUnreadCount).
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select(`
      *,
      task:tasks!notifications_task_id_fkey(id, name, project_id, due_date, priority, completed, assignee_id)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error }

  // actors and task assignees resolved in one profile lookup
  const rows = notifications ?? []
  const assigneeOf = (n: { task?: { assignee_id?: string | null } | null }) => n.task?.assignee_id ?? null
  const ids = Array.from(new Set(rows.flatMap((n) => [n.actor_id, assigneeOf(n)]).filter(Boolean))) as string[]
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] }
  const byId = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]))
  const withPeople = rows.map((n) => ({
    ...n,
    actor: byId.get(n.actor_id) ?? null,
    task_assignee: byId.get(assigneeOf(n) ?? '') ?? null,
  }))
  return { data: withPeople, error: null }
}

// several at once: the inbox groups a task's consecutive updates into one row
export async function markNotificationsRead(supabase: SupabaseClient, ids: string[], read = true) {
  return supabase
    .from('notifications')
    .update({ read_at: read ? new Date().toISOString() : null })
    .in('id', ids)
}

// "Clear" removes notifications for good (RLS: only your own)
export async function clearNotifications(supabase: SupabaseClient, ids: string[]) {
  return supabase.from('notifications').delete().in('id', ids)
}

export async function clearAllNotifications(supabase: SupabaseClient, userId: string) {
  return supabase.from('notifications').delete().eq('user_id', userId)
}

export async function markAllNotificationsRead(supabase: SupabaseClient, userId: string) {
  return supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
}

export async function getUnreadCount(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)

  return count ?? 0
}

export async function getViewPrefs(supabase: SupabaseClient, userId: string, viewKey: string) {
  const { data, error } = await supabase
    .from('user_view_prefs')
    .select('*')
    .eq('user_id', userId)
    .eq('view_key', viewKey)
    .single()

  return { data, error }
}

export async function saveViewPrefs(
  supabase: SupabaseClient,
  {
    user_id,
    view_key,
    filters,
    sort_field,
    sort_direction,
  }: {
    user_id: string
    view_key: string
    filters: FilterDef[]
    sort_field: string | null
    sort_direction: 'asc' | 'desc'
  }
) {
  return supabase.from('user_view_prefs').upsert(
    {
      user_id,
      view_key,
      filters,
      sort_field,
      sort_direction,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,view_key' }
  )
}

export async function getProfiles(supabase: SupabaseClient) {
  return supabase.from('profiles').select('*').order('name', { ascending: true })
}

export async function getCurrentProfile(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', auth.session.user.id).single()
  return data
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: { name?: string; initials?: string; avatar_color?: string; avatar_url?: string | null }
) {
  return supabase.from('profiles').update(updates).eq('id', userId).select('*').single()
}

// "My tasks" badge = tasks assigned to me since this timestamp (my previous session).
export async function getLastSeen(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('profiles').select('last_seen_at').eq('id', userId).single()
  return (data?.last_seen_at as string | null) ?? null
}

export async function touchLastSeen(supabase: SupabaseClient, userId: string) {
  return supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId)
}

export type ProjectMember = {
  project_id: string
  profile_id: string | null
  email: string
  role: 'owner' | 'admin' | 'member'
  invited_at: string
  joined_at: string | null
  profile?: Profile | null
}

export async function getProjectMembers(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from('project_members')
    .select('*, profile:profiles!project_members_profile_id_fkey(*)')
    .eq('project_id', projectId)
    .order('invited_at', { ascending: true })

  return { data: (data ?? []) as ProjectMember[], error }
}

// Adds someone who already has an account straight to a project (no email).
// RLS only lets the project's owner/admins do this, and never on a private project.
export async function addProjectMember(supabase: SupabaseClient, projectId: string, profile: { id: string; email: string }) {
  return supabase.from('project_members').insert({
    project_id: projectId,
    profile_id: profile.id,
    email: profile.email,
    role: 'member',
    joined_at: new Date().toISOString(),
  })
}

export async function removeProjectMember(supabase: SupabaseClient, projectId: string, email: string) {
  return supabase.from('project_members').delete().eq('project_id', projectId).eq('email', email)
}

// Admin-page reads: every project (including archived) and every member
// across every project, for the site-admin "roles + invites" page. Writes
// from that page go through /api/admin/* (service-role, is_super_admin
// checked server-side) rather than these -- see db/migrations/014.
export async function getAllProjectsAdmin(supabase: SupabaseClient) {
  return supabase.from('projects').select('*').order('name', { ascending: true })
}

export async function getAllProjectMembersAdmin(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('project_members')
    .select('*, profile:profiles!project_members_profile_id_fkey(*)')
    .order('invited_at', { ascending: true })
  return { data: (data ?? []) as ProjectMember[], error }
}

export async function getAllProfilesAdmin(supabase: SupabaseClient) {
  return supabase.from('profiles').select('*').order('name', { ascending: true })
}
