'use client';

import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { avatarStyle } from '@/lib/avatar';
import { groupNotifications } from '@/lib/groupNotifications';
import { ConfirmModal } from '@/components/ConfirmModal';

export interface NotificationItem {
  id: string;
  type: 'comment' | 'mention' | 'assigned' | 'due_soon' | 'completed' | 'updated';
  taskName: string;
  taskId?: string | null;
  projectId?: string | null;
  // current state of the task, so people can orient themselves at a glance
  dueDate?: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  completed?: boolean;
  assignee?: { name: string; initials: string; avatar_color: string | null; avatar_url: string | null } | null;
  actorName: string;
  detail?: string | null;
  createdAt: string;
  readAt: string | null;
}

interface InboxProps {
  notifications: NotificationItem[];
  loading: boolean;
  openTaskId: string | null; // task showing in the side panel, highlighted here
  projects: { id: string; name: string; color: string }[];
  // each takes every notification id in the clicked row (a row can be a grouped run of updates)
  onNotificationClick: (ids: string[]) => void;
  onOpenProject: (projectId: string, taskId?: string | null) => void;
  onMarkAllRead: () => void;
  onClear: (ids: string[]) => void;
  onClearAll: () => void;
}

// "Natalie S", "Natalie S and Tom", "Natalie S and 2 others"
function actorList(names: string[]) {
  if (names.length <= 2) return names.join(' and ');
  return `${names[0]} and ${names.length - 1} others`;
}

// The detail line of a grouped row: what changed, oldest first so it reads in order.
function updateSummary(group: NotificationItem[]) {
  const actors = [...new Set(group.map((n) => n.actorName))];
  const changes = [...group].reverse().filter((n) => n.detail);
  if (actors.length === 1) return `${actors[0]} ${[...new Set(changes.map((n) => n.detail))].join(', ')}`;
  return [...new Set(changes.map((n) => `${n.actorName} ${n.detail}`))].join('; ');
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

export function Inbox({ notifications, loading, openTaskId, projects, onNotificationClick, onOpenProject, onMarkAllRead, onClear, onClearAll }: InboxProps) {
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const [confirmClearAll, setConfirmClearAll] = useState(false);

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
          message={`This removes all ${notifications.length} notification${notifications.length === 1 ? '' : 's'} from your inbox. It can't be undone.`}
          confirmLabel="Clear all"
          onConfirm={() => {
            setConfirmClearAll(false);
            onClearAll();
          }}
          onCancel={() => setConfirmClearAll(false)}
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="inbox-grid inbox-grid-head" aria-hidden>
          <span>Notification</span>
          <span className="inbox-col-project">Project</span>
          <span className="inbox-col">Assignee</span>
          <span className="inbox-col">Due date</span>
          <span className="inbox-col">Priority</span>
        </div>
        {groupNotifications(notifications).map((group) => {
          const notif = group[0]; // newest in the row
          const ids = group.map((n) => n.id);
          const unread = group.some((n) => !n.readAt);
          const actors = [...new Set(group.map((n) => n.actorName))];
          const detail = notif.type === 'updated' ? (group.some((n) => n.detail) ? updateSummary(group) : null) : notif.detail ? `“${notif.detail}”` : null;
          const project = projects.find((p) => p.id === notif.projectId);
          const isOpen = !!notif.taskId && notif.taskId === openTaskId;
          return (
          <div
            key={notif.id}
            role="button"
            tabIndex={0}
            onClick={() => onNotificationClick(ids)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNotificationClick(ids);
              }
            }}
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${isOpen ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer',
              backgroundColor: isOpen ? 'var(--surface-alt)' : unread ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <div className="inbox-grid">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', minWidth: 0 }}>
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
                  marginTop: '6px',
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: '14px',
                    fontWeight: unread ? 500 : 400,
                    color: 'var(--text)',
                  }}
                >
                  {notif.type === 'comment' && `${notif.actorName} commented on "${notif.taskName}"`}
                  {notif.type === 'mention' && `${notif.actorName} mentioned you in "${notif.taskName}"`}
                  {notif.type === 'assigned' && `${notif.actorName} assigned you "${notif.taskName}"`}
                  {notif.type === 'due_soon' && `"${notif.taskName}" is due soon`}
                  {notif.type === 'completed' && `"${notif.taskName}" was completed`}
                  {notif.type === 'updated' && `${actorList(actors)} updated "${notif.taskName}"`}
                </p>
                {detail && (
                  <p
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13px',
                      color: 'var(--text)',
                      opacity: 0.85,
                    }}
                  >
                    {detail}
                  </p>
                )}
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {relativeTime(notif.createdAt)}
                  {group.length > 1 && ` · ${group.length} changes`}
                </span>
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
                const overdue = !notif.completed && new Date(notif.dueDate) < new Date();
                return (
                  <span
                    title={overdue ? 'Overdue' : 'Due date'}
                    style={{ color: overdue ? '#D64545' : 'var(--text)', fontWeight: overdue ? 600 : 500 }}
                  >
                    {new Date(notif.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                );
              })()}
            </div>
            <div className="inbox-col">
              {notif.completed ? (
                <span style={{ color: '#2E9E6B', fontWeight: 600 }}>✓ Done</span>
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
      </div>
    </div>
  );
}
