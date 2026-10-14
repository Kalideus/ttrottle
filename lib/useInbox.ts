import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationItem } from '@/components/Inbox'
import { getNewlyAssignedTaskIds, getNotifications, getUnreadCount } from '@/lib/supabase/queries'
import { playChime, soundOn } from '@/lib/notifySound'

const PAGE_SIZE = 50
const ICON = '/logo.svg'

// The tab icon, with a red dot drawn on it while there's something unread.
let dotted: string | null = null
function setTabIconDot(on: boolean) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) return
  if (!on) {
    link.href = ICON
    return
  }
  if (dotted) {
    link.href = dotted
    return
  }
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const g = canvas.getContext('2d')
    if (!g) return
    g.drawImage(img, 0, 0, 64, 64)
    g.beginPath()
    g.arc(48, 16, 14, 0, 2 * Math.PI)
    g.fillStyle = '#E8384F'
    g.fill()
    g.lineWidth = 3
    g.strokeStyle = '#FFFFFF'
    g.stroke()
    dotted = canvas.toDataURL('image/png')
    // still unread by the time the picture is ready
    if (document.title.startsWith('(')) link.href = dotted
  }
  img.src = ICON
}

// The inbox's data: the unread badge, the paged list, and keeping both current (live push plus a
// once-a-minute check). What clicking or clearing a row does stays with the page, which owns navigation.
// `section`: the page's open section, which also refreshes the badge when it changes.
// `saving`: true while the page's own writes are still saving (a reload then would come back stale).
// `onAssigned`: someone just gave me a task.
export function useInbox(
  supabase: SupabaseClient,
  userId: string | null,
  section: string,
  saving: () => boolean,
  onAssigned: () => void
) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const notificationsRef = useRef<NotificationItem[]>([])
  notificationsRef.current = notifications
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const loadRequest = useRef(0)
  const [badge, setBadge] = useState(0)
  // tasks given to me that I haven't opened yet: My tasks marks them with a dot
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set())
  const open = useRef(false)
  open.current = section === 'inbox'
  // the latest callbacks, so the live-push subscription doesn't restart every render
  const callbacks = useRef({ saving, onAssigned })
  callbacks.current = { saving, onAssigned }

  const loadBadge = useCallback(async () => {
    if (!userId) return
    const [count, ids] = await Promise.all([getUnreadCount(supabase, userId), getNewlyAssignedTaskIds(supabase, userId)])
    setBadge(count)
    setNewTaskIds(ids)
  }, [userId, supabase])

  const load = useCallback(async ({ append = false } = {}) => {
    if (!userId) return
    const requestId = append ? loadRequest.current : ++loadRequest.current
    const loadedCount = notificationsRef.current.length
    const offsets = append
      ? [loadedCount]
      : Array.from({ length: Math.max(1, Math.ceil(Math.max(PAGE_SIZE, loadedCount) / PAGE_SIZE)) }, (_, page) => page * PAGE_SIZE)
    const pages = await Promise.all(offsets.map((offset) => getNotifications(supabase, userId, { limit: PAGE_SIZE, offset })))
    const failedPage = pages.find((page) => page.error)
    if (failedPage?.error) {
      console.error('Error loading notifications:', failedPage.error)
      return
    }
    if (requestId !== loadRequest.current) return
    const rows = pages.flatMap((page) => page.data ?? [])
    const mapped: NotificationItem[] = rows.map((n: any) => ({
      id: n.id,
      type: n.type,
      taskName: n.task?.name ?? 'a task',
      taskId: n.task?.id ?? null,
      projectId: n.task?.project_id ?? null,
      commentId: n.comment_id ?? null,
      dueDate: n.task?.due_date ?? null,
      priority: n.task?.priority ?? null,
      completed: !!n.task?.completed,
      liked: !!n.task_liked,
      assignee: n.task_assignee ?? null,
      actorName: n.actor?.name ?? 'Someone',
      detail: n.detail ?? null,
      createdAt: n.created_at,
      readAt: n.read_at,
    }))
    if (append) {
      setNotifications((prev) => {
        const existing = new Set(prev.map((n) => n.id))
        return [...prev, ...mapped.filter((n) => !existing.has(n.id))]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      })
    } else {
      setNotifications(mapped)
    }
    setHasMore((pages[pages.length - 1]?.data?.length ?? 0) === PAGE_SIZE)
  }, [userId, supabase])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      await load({ append: true })
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [hasMore, load])

  // the badge, and the list only while it's on screen (opening the inbox loads it anyway)
  const refresh = useCallback(() => Promise.all([loadBadge(), open.current ? load() : null]), [loadBadge, load])

  useEffect(() => {
    void loadBadge()
  }, [loadBadge, section])

  const loaded = useRef(false)
  useEffect(() => {
    if (section !== 'inbox') return
    // reopening shows the last list straight away and refreshes it underneath
    if (!loaded.current) setLoading(true)
    load().finally(() => {
      loaded.current = true
      setLoading(false)
    })
  }, [section, load])

  // Live push: Supabase Realtime on my notification rows. Any insert/update
  // refreshes the badge and the list so it lands without navigating.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const type = payload.eventType === 'INSERT' ? (payload.new as { type?: string }).type : undefined
          // a chime for something new, even with the tab in the background; not for plain "task updated" ones,
          // which come in runs while someone edits
          if (type && type !== 'updated' && soundOn()) playChime()
          // my own clears/reads still saving would come back stale; the save queue reloads once they land
          if (callbacks.current.saving()) return
          if (type === 'assigned') callbacks.current.onAssigned()
          void refresh()
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, supabase, refresh])

  // Safety net for the live push: a sleeping tab or a dropped socket misses events and Realtime doesn't
  // replay them. Checking each minute (and on coming back to the tab) keeps the inbox under two minutes behind.
  useEffect(() => {
    const check = () => {
      if (document.hidden || callbacks.current.saving()) return
      void refresh()
    }
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [refresh])

  // the browser tab shows the unread count, "(3) TRack", and a red dot on its icon
  useEffect(() => {
    document.title = badge > 0 ? `(${badge}) TRack` : 'TRack'
    setTabIconDot(badge > 0)
  }, [badge])

  return { notifications, setNotifications, badge, setBadge, newTaskIds, setNewTaskIds, loading, loadingMore, hasMore, loadMore, refresh }
}
