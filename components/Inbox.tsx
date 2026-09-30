'use client';

import { Bell, CheckCheck } from 'lucide-react';

export interface NotificationItem {
  id: string;
  type: 'comment' | 'mention' | 'assigned' | 'due_soon' | 'completed' | 'updated';
  taskName: string;
  taskId?: string | null;
  projectId?: string | null;
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
  onNotificationClick: (notificationId: string) => void;
  onOpenProject: (projectId: string, taskId?: string | null) => void;
  onMarkAllRead: () => void;
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

export function Inbox({ notifications, loading, openTaskId, projects, onNotificationClick, onOpenProject, onMarkAllRead }: InboxProps) {
  const unreadCount = notifications.filter((n) => !n.readAt).length;

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
        <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>No notifications yet</p>
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
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {notifications.map((notif) => {
          const project = projects.find((p) => p.id === notif.projectId);
          const isOpen = !!notif.taskId && notif.taskId === openTaskId;
          return (
          <div
            key={notif.id}
            role="button"
            tabIndex={0}
            onClick={() => onNotificationClick(notif.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNotificationClick(notif.id);
              }
            }}
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${isOpen ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer',
              backgroundColor: isOpen ? 'var(--surface-alt)' : !notif.readAt ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              {!notif.readAt && (
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    marginTop: '6px',
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: '14px',
                    fontWeight: notif.readAt ? 400 : 500,
                    color: 'var(--text)',
                  }}
                >
                  {notif.type === 'comment' && `${notif.actorName} commented on "${notif.taskName}"`}
                  {notif.type === 'mention' && `${notif.actorName} mentioned you in "${notif.taskName}"`}
                  {notif.type === 'assigned' && `${notif.actorName} assigned you "${notif.taskName}"`}
                  {notif.type === 'due_soon' && `"${notif.taskName}" is due soon`}
                  {notif.type === 'completed' && `"${notif.taskName}" was completed`}
                  {notif.type === 'updated' && `${notif.actorName} updated "${notif.taskName}"`}
                </p>
                {notif.detail && (
                  <p
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13px',
                      color: 'var(--text)',
                      opacity: 0.85,
                    }}
                  >
                    {notif.type === 'updated' ? `${notif.actorName} ${notif.detail}` : `“${notif.detail}”`}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span>{relativeTime(notif.createdAt)}</span>
                  {project && (
                    <button
                      type="button"
                      title={`Go to ${project.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProject(project.id, notif.taskId);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '2px 8px',
                        border: '1px solid var(--border)',
                        borderRadius: '999px',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: project.color }} />
                      {project.name} →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
