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
  assignee?: Profile | null
  subtasks?: Task[]
  tags?: Tag[]
  comment_count?: number
  project?: { id: string; name: string; color: string } | null
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

export async function getProjects(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('archived', false)
    .order('position', { ascending: true })

  return { data, error }
}

export async function createProject(
  supabase: SupabaseClient,
  { name, color, icon, created_by }: { name: string; color: string; icon: string; created_by?: string | null }
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
    .insert({ name, color, icon, position: nextPosition, archived: false, created_by: created_by ?? null })
    .select()
    .single()

  if (result.data && created_by) {
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', created_by).single()
    if (profile?.email) {
      await supabase.from('project_members').insert({
        project_id: result.data.id,
        profile_id: created_by,
        email: profile.email,
        role: 'owner',
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
  { project_id, name }: { project_id: string; name: string }
) {
  const { data: existing } = await supabase
    .from('headings')
    .select('position')
    .eq('project_id', project_id)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = existing?.[0]?.position != null ? Number(existing[0].position) + 1 : 0

  return supabase
    .from('headings')
    .insert({ project_id, name, position: nextPosition })
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
    .order('position', { ascending: true })

  if (tasksError) return { data: [], error: tasksError }

  const taskIds = (tasks ?? []).map((task) => task.id)
  const { data: counts } = taskIds.length
    ? await supabase.rpc('get_comment_counts', { task_ids: taskIds })
    : { data: [] }

  const countMap = new Map((counts ?? []).map((row: { task_id: string; count: number }) => [row.task_id, row.count]))

  const assigneeIds = new Set<string>()
  ;(tasks ?? []).forEach((task) => {
    if (task.assignee_id) assigneeIds.add(task.assignee_id)
    ;(task.subtasks ?? []).forEach((st: Task) => st.assignee_id && assigneeIds.add(st.assignee_id))
  })
  const profileMap = new Map<string, Profile>()
  if (assigneeIds.size) {
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', Array.from(assigneeIds))
    ;(profiles ?? []).forEach((p: Profile) => profileMap.set(p.id, p))
  }

  // Fetched separately (not embedded) so a missing task_tags table can't fail task loading itself.
  const tagsByTask = new Map<string, Tag[]>()
  if (taskIds.length) {
    const { data: taskTagRows } = await supabase
      .from('task_tags')
      .select('task_id, tags(*)')
      .in('task_id', taskIds)
    ;(taskTagRows ?? []).forEach((row: any) => {
      const tag = row.tags as Tag | null
      if (!tag) return
      const existing = tagsByTask.get(row.task_id) ?? []
      existing.push(tag)
      tagsByTask.set(row.task_id, existing)
    })
  }

  const normalized = (tasks ?? []).map((task) => ({
    ...task,
    assignee: task.assignee_id ? profileMap.get(task.assignee_id) ?? null : null,
    subtasks: (task.subtasks ?? []).map((subtask: Task) => ({
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
  }: {
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

  const result = await supabase.from('tasks').insert(payload).select().single()

  if (result.data) {
    if (created_by) {
      await supabase.from('followers').upsert({ task_id: result.data.id, user_id: created_by }, { onConflict: 'task_id,user_id', ignoreDuplicates: true })
    }
    if (follower_ids?.length) {
      await supabase.from('followers').upsert(
        follower_ids.map((user_id) => ({ task_id: result.data.id, user_id })),
        { onConflict: 'task_id,user_id', ignoreDuplicates: true }
      )
    }
    if (assignee_id) {
      await notifyAssignee(supabase, { taskId: result.data.id, assigneeId: assignee_id, actorId: created_by ?? null })
    }
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
  updates: Partial<Pick<Task, 'name' | 'description' | 'assignee_id' | 'due_date' | 'priority' | 'completed' | 'heading_id' | 'position'>>
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
    const { data: authData } = await supabase.auth.getUser()
    const actorId = authData.user?.id ?? null

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
        await supabase.from('notifications').insert(
          followers.map((f) => ({ user_id: f.user_id, task_id: id, type, actor_id: actorId }))
        )
      }
    }
  }

  return result
}

export async function deleteTask(supabase: SupabaseClient, id: string) {
  return supabase.from('tasks').delete().eq('id', id)
}

export async function getMyTasks(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      project:projects!tasks_project_id_fkey(id, name, color)
    `)
    .eq('assignee_id', userId)
    .eq('completed', false)
    .order('due_date', { ascending: true })

  return { data, error }
}

export async function getComments(supabase: SupabaseClient, taskId: string) {
  const { data: comments, error } = await supabase
    .from('comments')
    .select('*')
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error }

  const withAuthors = await attachProfilesById(supabase, comments ?? [], 'author_id', 'author')
  return { data: withAuthors, error: null }
}

export async function createComment(
  supabase: SupabaseClient,
  {
    task_id,
    author_id,
    body,
    mentions,
  }: {
    task_id: string
    author_id: string
    body: string
    mentions?: string[]
  }
) {
  const insertPayload = {
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
    const { data: authorProfile } = await supabase.from('profiles').select('*').eq('id', author_id).single()
    ;(result.data as Record<string, unknown>).author = authorProfile ?? null

    await supabase.from('followers').upsert({ task_id, user_id: author_id }, { onConflict: 'task_id,user_id', ignoreDuplicates: true })

    const { data: followers } = await supabase
      .from('followers')
      .select('user_id')
      .eq('task_id', task_id)
      .neq('user_id', author_id)

    if (followers?.length) {
      const notifications = followers.map((f) => ({
        user_id: f.user_id,
        task_id,
        type: 'comment',
        actor_id: author_id,
        comment_id: result.data.id,
      }))
      await supabase.from('notifications').insert(notifications)
    }

    const mentionUsers = (mentions ?? []).filter((uid) => uid !== author_id)
    if (mentionUsers.length) {
      const { data: existingFollowers } = await supabase
        .from('followers')
        .select('user_id')
        .eq('task_id', task_id)

      const followerIds = new Set((existingFollowers ?? []).map((f) => f.user_id))
      const filteredMentions = mentionUsers.filter((uid) => !followerIds.has(uid))

      if (filteredMentions.length) {
        const notifyRows = filteredMentions.map((uid) => ({
          user_id: uid,
          task_id,
          type: 'mention',
          actor_id: author_id,
          comment_id: result.data.id,
        }))

        await supabase.from('notifications').insert(notifyRows)
      }
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
  { name, color, created_by }: { name: string; color: string; created_by: string | null }
) {
  return supabase.from('tags').insert({ name, color, created_by }).select().single()
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
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select(`
      *,
      task:tasks!notifications_task_id_fkey(id, name, project_id)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error }

  const withActors = await attachProfilesById(supabase, notifications ?? [], 'actor_id', 'actor')
  return { data: withActors, error: null }
}

export async function markNotificationRead(supabase: SupabaseClient, id: string) {
  return supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
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
  const { data: authUser } = await supabase.auth.getUser()
  if (!authUser.user) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', authUser.user.id).single()
  return data
}

export type ProjectMember = {
  project_id: string
  profile_id: string | null
  email: string
  role: 'owner' | 'member'
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

export async function inviteProjectMember(supabase: SupabaseClient, { project_id, email }: { project_id: string; email: string }) {
  const normalizedEmail = email.trim().toLowerCase()
  const { data: profile } = await supabase.from('profiles').select('id').eq('email', normalizedEmail).maybeSingle()

  return supabase
    .from('project_members')
    .insert({
      project_id,
      email: normalizedEmail,
      profile_id: profile?.id ?? null,
      joined_at: profile ? new Date().toISOString() : null,
    })
    .select('*, profile:profiles!project_members_profile_id_fkey(*)')
    .single()
}

export async function removeProjectMember(supabase: SupabaseClient, projectId: string, email: string) {
  return supabase.from('project_members').delete().eq('project_id', projectId).eq('email', email)
}
