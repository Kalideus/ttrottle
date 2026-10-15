'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Mail, Heart, MailOpen, Trash2 } from 'lucide-react';
import { avatarStyle } from '@/lib/avatar';
import { isOverdue, formatDay } from '@/lib/dates';
import { groupNotifications } from '@/lib/groupNotifications';
import { ConfirmModal } from '@/components/ConfirmModal';

export interface NotificationItem {
  id: string;
  type: 'comment' | 'mention' | 'assigned' | 'due_soon' | 'completed' | 'updated' | 'ticket' | 'liked';
  taskName: string;
  taskId?: string | null;
  projectId?: string | null;
  commentId?: string | null; // comment/mention rows jump straight to the comment
  // current state of the task, so people can orient themselves at a glance
  dueDate?: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  completed?: boolean;
  liked?: boolean; // I've given this finished task a heart
  assignee?: { name: string; initials: string; avatar_color: string | null; avatar_url: string | null } | null;
  actorName: string;
  detail?: string | null;
  createdAt: string;
  readAt: string | null;
}

interface InboxProps {
  notifications: NotificationItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  unreadCount: number;
  openTaskId: string | null; // task showing in the side panel, highlighted here
  projects: { id: string; name: string; color: string }[];
  // each takes every notification id in the clicked row (a row can be a grouped run of updates)
  onNotificationClick: (ids: string[]) => void;
  onOpenProject: (projectId: string, taskId?: string | null) => void;
  onLoadMore: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (ids: string[], read: boolean) => void;
  onClear: (ids: string[]) => void;
  onClearAll: () => void;
  onLike: (taskId: string, liked: boolean) => void;
}

// "Natalie S", "Natalie S and Tom", "Natalie S and 2 others"
function actorList(names: string[]) {
  if (names.length <= 2) return names.join(' and ');
  return `${names[0]} and ${names.length - 1} others`;
}

// A grouped row's headline uses its most important notification: a mention beats an edit.
const RANK: NotificationItem['type'][] = ['mention', 'ticket', 'assigned', 'comment', 'liked', 'completed', 'due_soon', 'updated'];
const headOf = (group: NotificationItem[]) => [...group].sort((a, b) => RANK.indexOf(a.type) - RANK.indexOf(b.type))[0];

// A row's ids, headline first (from the unread part while there is one): a click jumps to its comment.
export function rowIds(group: NotificationItem[]) {
  const fresh = group.filter((n) => !n.readAt);
  const notif = headOf(fresh.length ? fresh : group);
  return [notif.id, ...group.filter((n) => n !== notif).map((n) => n.id)];
}

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Inbox({ notifications, loading, loadingMore, hasMore, unreadCount, openTaskId, projects, onNotificationClick, onOpenProject, onLoadMore, onMarkAllRead, onMarkRead, onClear, onClearAll, onLike }: InboxProps) {
  const groups = groupNotifications(notifications);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; ids: string[]; unread: boolean } | null>(null);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading notifications...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Bell size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>You&apos;re all caught up</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Notifications</h2>
          {unreadCount > 0 && (
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
              {unreadCount} unread
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {unreadCount > 0 && (
            <button className="inbox-head-btn" onClick={onMarkAllRead}>
              <CheckCheck size={16} />
              Mark all read
            </button>
          )}
          <button className="inbox-head-btn" onClick={() => setConfirmClearAll(true)}>
            <Trash2 size={15} />
            Clear all
          </button>
        </div>
      </div>

      {confirmClearAll && (
        <ConfirmModal
          title="Clear all notifications?"
          message="This removes all notifications from your inbox. It can't be undone."
          confirmLabel="Clear all"
          onConfirm={() => {
            setConfirmClearAll(false);
            onClearAll();
          }}
          onCancel={() => setConfirmClearAll(false)}
        />
      )}

      <div className="inbox-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="inbox-grid inbox-grid-head" aria-hidden>
          <span>Notification</span>
          <span className="inbox-col-project">Project</span>
          <span className="inbox-col">Assignee</span>
          <span className="inbox-col">Due date</span>
          <span className="inbox-col">Priority</span>
        </div>
        {groups.map((group) => {
          // a row is a whole task's history: while any of it is unread, the headline and count are about the unread part
          const fresh = group.filter((n) => !n.readAt);
          const unread = fresh.length > 0;
          const news = unread ? fresh : group;
          const ids = rowIds(group);
          const notif = group.find((n) => n.id === ids[0])!;
          const actors = [...new Set(news.map((n) => n.actorName))];
          const project = projects.find((p) => p.id === notif.projectId);
          const isOpen = !!notif.taskId && notif.taskId === openTaskId;
          return (
          <div
            key={group[0].id}
            className="inbox-row" // the open task panel stays open for clicks on these (see TaskDetailPanel)
            role="button"
            tabIndex={0}
            onClick={() => onNotificationClick(ids)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY, ids, unread });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNotificationClick(ids);
              }
            }}
            style={{
              padding: '8px 24px',
              borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${isOpen ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer',
              backgroundColor: isOpen ? 'var(--surface-alt)' : unread ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <div className="inbox-grid">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
              {/* tick off = clear it from the inbox (and every notification grouped into this row) */}
              <button
                type="button"
                className="task-checkbox inbox-clear"
                title="Clear"
                aria-label="Clear notification"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear(ids);
                }}
                onKeyDown={(e) => e.stopPropagation()} // Enter/Space on the button shouldn't also open the row
              >
                <Check size={11} strokeWidth={3} />
              </button>
              {/* always takes its space so rows line up whether or not they're unread */}
              <div
                aria-label={unread ? 'Unread' : undefined}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: unread ? 'var(--accent)' : 'transparent',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: unread ? 500 : 400,
                    color: 'var(--text)',
                  }}
                >
                  {notif.type === 'comment' && `${notif.actorName} commented on "${notif.taskName}"`}
                  {notif.type === 'mention' && `${notif.actorName} mentioned you in "${notif.taskName}"`}
                  {notif.type === 'assigned' && `${notif.actorName} assigned you "${notif.taskName}"`}
                  {notif.type === 'ticket' && `${notif.actorName} raised a ticket: "${notif.taskName}"`}
                  {notif.type === 'due_soon' && `"${notif.taskName}" is due soon`}
                  {notif.type === 'completed' && `"${notif.taskName}" was completed`}
                  {notif.type === 'liked' && `${actorList(actors)} gave a ❤️ for completing "${notif.taskName}"`}
                  {notif.type === 'updated' && `${actorList(actors)} updated "${notif.taskName}"`}
                  {/* the time sits on the headline's line: a row of its own made every notification taller */}
                  <span style={{ marginLeft: 8, fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {relativeTime(group[0].createdAt)}
                    {news.length > 1 && ` · ${news.length} updates`}
                  </span>
                </p>
                {/* no detail line: the row says what and who; opening the task shows the updates themselves */}
              </div>
            </div>

            <div className="inbox-col inbox-col-project">
              {project && (
                <button
                  type="button"
                  className="inbox-project-chip"
                  title={`Go to ${project.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProject(project.id, notif.taskId);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: project.color, flexShrink: 0 }} />
                  <span className="inbox-project-name">{project.name}</span> →
                </button>
              )}
            </div>
            <div className="inbox-col">
              {notif.assignee && (
                <span
                  className="inbox-avatar"
                  title={`Assigned to ${notif.assignee.name}`}
                  style={avatarStyle(notif.assignee.avatar_url, notif.assignee.avatar_color)}
                >
                  {notif.assignee.initials}
                </span>
              )}
            </div>
            <div className="inbox-col">
              {notif.dueDate && (() => {
                const overdue = isOverdue(notif.dueDate, notif.completed);
                return (
                  <span
                    title={overdue ? 'Overdue' : 'Due date'}
                    style={{ color: overdue ? '#D64545' : 'var(--text)', fontWeight: overdue ? 600 : 500 }}
                  >
                    {formatDay(notif.dueDate, false)}
                  </span>
                );
              })()}
            </div>
            <div className="inbox-col">
              {notif.completed ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#2E9E6B', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  ✓ Done
                  {notif.taskId && (
                    <button
                      type="button"
                      className={`inbox-like ${notif.liked ? 'is-on' : ''}`}
                      title={notif.liked ? 'Take back your heart' : 'Give a heart'}
                      aria-label="Heart"
                      aria-pressed={!!notif.liked}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLike(notif.taskId!, !notif.liked);
                      }}
                      onKeyDown={(e) => e.stopPropagation()} // Enter/Space on the button shouldn't also open the row
                    >
                      <Heart size={15} fill={notif.liked ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </span>
              ) : (
                notif.priority && (
                  <span className={`priority-chip priority-${notif.priority}`}>
                    {notif.priority.charAt(0).toUpperCase() + notif.priority.slice(1)}
                  </span>
                )
              )}
            </div>
            </div>
          </div>
          );
        })}
        {(hasMore || loadingMore) && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {loadingMore ? (
              'Loading older notifications...'
            ) : (
              <button className="inbox-head-btn" style={{ margin: '0 auto' }} onClick={onLoadMore}>
                Load older notifications
              </button>
            )}
          </div>
        )}
      </div>

      {menu && (
        <>
          <div
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
          />
          <div
            style={{
              position: 'fixed',
              top: menu.y,
              left: menu.x,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              minWidth: '160px',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <button
              onClick={() => {
                onMarkRead(menu.ids, menu.unread);
                setMenu(null);
              }}
              style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {menu.unread ? <MailOpen size={14} /> : <Mail size={14} />}
              {menu.unread ? 'Mark as read' : 'Mark as unread'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
