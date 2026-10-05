'use client';

import { X, MoreVertical, Calendar, User, Flag, List, Check, Users, Plus, Trash2, CornerUpLeft, Link2, ExternalLink, Repeat, Lock, Unlock } from 'lucide-react';
import { repeatOptions } from '@/lib/repeat';
import { useEffect, useRef, useState } from 'react';
import type { Task, Project, ProjectMember, Heading, Tag, Follower, TaskActivity } from '@/lib/supabase/queries';
import { Comments, type CommentItem } from '@/components/Comments';
import { TagPicker } from '@/components/TagPicker';
import { AddTaskForm } from '@/components/AddTaskForm';
import { autoGrow } from '@/lib/autoGrow';
import { openPicker } from '@/lib/openPicker';
import { FormatToolbar, formatKeyDown } from '@/components/FormatToolbar';
import { Markdown } from '@/components/Markdown';
import { avatarStyle } from '@/lib/avatar';
import { PeoplePicker } from '@/components/PeoplePicker';
import { flipIfOffscreen } from '@/lib/flipIfOffscreen';

interface TaskDetailPanelProps {
  task: Task;
  projectMembers: ProjectMember[];
  headings: Heading[];
  availableTags: Tag[];
  comments: CommentItem[];
  commentsLoading: boolean;
  followers: Follower[];
  activity: TaskActivity[];
  currentUserId: string | null;
  onFollowerAdd: (userId: string) => void;
  onFollowerRemove: (userId: string) => void;
  onSubtaskAdd: (parentTaskId: string, name: string) => Promise<void>;
  onSubtaskSelect: (taskId: string) => void;
  parentTaskName: string | null;
  onParentSelect: () => void;
  onClose: () => void;
  /** Shown outside the task's project (My tasks): jump to the task there. */
  onOpenInProject?: () => void;
  /** The task's project, shown as a coloured label above the title. */
  project?: Project | null;
  onTaskUpdate: (taskId: string, updates: Record<string, unknown>) => Promise<void>;
  onTaskDelete: (taskId: string) => Promise<void>;
  onTagAdd: (tag: Tag) => void;
  onTagRemove: (tagId: string) => void;
  onNewTag: (name: string, color: string) => Promise<void>;
  onCommentAdd: (body: string, mentions: string[]) => Promise<void>;
  onCommentEdit: (commentId: string, body: string) => Promise<void>;
  onCommentDelete: (commentId: string) => Promise<void>;
  onCommentLike: (commentId: string) => Promise<void>;
  // owner/admin of the task's project, or super admin: may lock the due date and answer extension requests
  canManage?: boolean;
  onExtensionRequest?: (date: string, reason: string) => void;
  onRequestAnswer?: (commentId: string, approve: boolean) => void;
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

export function TaskDetailPanel({
  task,
  projectMembers,
  headings,
  availableTags,
  comments,
  commentsLoading,
  followers,
  activity,
  currentUserId,
  onFollowerAdd,
  onFollowerRemove,
  onSubtaskAdd,
  onSubtaskSelect,
  parentTaskName,
  onParentSelect,
  onClose,
  onOpenInProject,
  project,
  onTaskUpdate,
  onTaskDelete,
  onTagAdd,
  onTagRemove,
  onNewTag,
  onCommentAdd,
  onCommentEdit,
  onCommentDelete,
  onCommentLike,
  canManage = false,
  onExtensionRequest,
  onRequestAnswer,
}: TaskDetailPanelProps) {
  // A task just created by the "Create" button opens ready to name.
  const isFresh = task.name === 'Untitled task';
  const [isEditingTitle, setIsEditingTitle] = useState(isFresh);
  const [title, setTitle] = useState(isFresh ? '' : task.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(task.description ?? '');
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  // one menu open at a time: opening another closes the last
  const [menu, setMenu] = useState<null | 'assignee' | 'dueDate' | 'priority' | 'heading' | 'follower' | 'options'>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const anyEditorOpen =
    isEditingTitle || isEditingDescription || menu !== null || isAddingSubtask;

  // Esc closes the panel, unless an inline editor / menu is open (Esc cancels that first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !anyEditorOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, anyEditorOpen]);

  // Click outside the panel closes it — but clicking another task row (to switch)
  // or the app chrome does not.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current?.contains(t)) return;
      if (t.closest('.task-row') || t.closest('.app-top-bar') || t.closest('.app-sidebar')) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const priorityOptions: Array<'high' | 'medium' | 'low'> = ['low', 'medium', 'high'];
  const assignedMember = projectMembers.find((m) => m.profile_id === task.assignee_id);
  const currentHeading = headings.find((h) => h.id === task.heading_id);
  const isOverdue = !!task.due_date && !task.completed && new Date(task.due_date) < new Date();
  const dateReadOnly = !!task.due_locked && !canManage;
  const [extension, setExtension] = useState<{ date: string; reason: string } | null>(null);
  const followableMembers = projectMembers.filter((m) => m.profile_id && !followers.some((f) => f.user_id === m.profile_id));

  const handleSaveTitle = () => {
    if (title.trim() && title !== task.name) {
      onTaskUpdate(task.id, { name: title });
    }
    setIsEditingTitle(false);
  };

  // Clicking outside the panel or onto another task unmounts it before the textarea/input blur fires,
  // so an edit still open at that point is saved on the way out.
  const unsaved = useRef({ task, onTaskUpdate, title, description, isEditingTitle, isEditingDescription });
  unsaved.current = { task, onTaskUpdate, title, description, isEditingTitle, isEditingDescription };
  useEffect(
    () => () => {
      const u = unsaved.current;
      const updates: Record<string, unknown> = {};
      if (u.isEditingTitle && u.title.trim() && u.title !== u.task.name) updates.name = u.title;
      if (u.isEditingDescription && u.description !== (u.task.description ?? '')) updates.description = u.description;
      if (Object.keys(updates).length) u.onTaskUpdate(u.task.id, updates);
    },
    []
  );

  const handleSaveDescription = () => {
    if (description !== (task.description ?? '')) {
      onTaskUpdate(task.id, { description });
    }
    setIsEditingDescription(false);
  };

  return (
    <div className="app-detail-panel" ref={panelRef}>
      <div className="detail-panel-header" style={{ paddingBottom: '12px' }}>
        <button
          className={`detail-panel-complete-btn ${task.completed ? 'completed' : ''}`}
          onClick={() => onTaskUpdate(task.id, { completed: !task.completed })}
        >
          <span className="detail-panel-complete-icon">
            {task.completed && <Check size={12} strokeWidth={3} />}
          </span>
          {task.completed ? 'Completed' : 'Mark complete'}
        </button>

        <div className="detail-panel-actions" style={{ position: 'relative' }}>
          {onOpenInProject && (
            <button className="detail-panel-menu-btn" title="Open in project" aria-label="Open in project" onClick={onOpenInProject}>
              <ExternalLink size={18} />
            </button>
          )}
          {task.project_id && (
            <button
              className="detail-panel-menu-btn"
              title={linkCopied ? 'Link copied' : 'Copy link to this task'}
              aria-label="Copy link to this task"
              onClick={async () => {
                const url = `${window.location.origin}/app?project=${task.project_id}&task=${task.id}`;
                try {
                  await navigator.clipboard.writeText(url);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 2000);
                } catch {
                  window.prompt('Copy this link:', url); // clipboard blocked (e.g. non-HTTPS)
                }
              }}
            >
              {linkCopied ? <Check size={18} /> : <Link2 size={18} />}
            </button>
          )}
          {linkCopied && <span className="detail-link-copied" role="status">Link copied</span>}
          <button className="detail-panel-menu-btn" onClick={() => setMenu(menu === 'options' ? null : 'options')}>
            <MoreVertical size={18} />
          </button>
          <button className="detail-panel-close-btn" onClick={onClose}>
            ✕
          </button>

          {menu === 'options' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                minWidth: '160px',
                zIndex: 100,
                marginTop: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <button
                onClick={() => {
                  setMenu(null);
                  // Soft delete -- kept for 90 days (see /admin/deleted-tasks), not gone instantly.
                  if (window.confirm(`Delete "${task.name}"? It's recoverable for 90 days, then removed for good.`)) {
                    onTaskDelete(task.id);
                  }
                }}
                style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#D64545', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Trash2 size={14} />
                Delete task
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-panel-content">
        {project && (
          <button
            type="button"
            onClick={onOpenInProject}
            disabled={!onOpenInProject}
            title={onOpenInProject ? 'Open in project' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: 0, border: 'none', background: 'none',
              cursor: onOpenInProject ? 'pointer' : 'default', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
            }}
          >
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: project.color, flexShrink: 0 }} />
            {project.icon} {project.name}
          </button>
        )}
        {parentTaskName && (
          <button
            onClick={onParentSelect}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--surface-alt)',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 10px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '10px',
              maxWidth: '100%',
            }}
          >
            <CornerUpLeft size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Subtask of "{parentTaskName}"
            </span>
          </button>
        )}

        {isEditingTitle ? (
          <input
            autoFocus
            type="text"
            placeholder="Task name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle();
              if (e.key === 'Escape') {
                setTitle(task.name);
                setIsEditingTitle(false);
              }
            }}
            style={{
              fontSize: '23px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              marginBottom: '22px',
              width: '100%',
              border: '1px solid var(--border)',
              padding: '8px 12px',
              borderRadius: '6px',
              color: 'var(--text)',
            }}
          />
        ) : (
          <div
            className="detail-panel-title"
            onClick={() => setIsEditingTitle(true)}
            style={{ cursor: 'pointer', padding: '8px' }}
          >
            {title}
          </div>
        )}

        {/* Heading: a subheading under the title (only in the project view, where headings are loaded) */}
        {headings.length > 0 && !task.parent_task_id && (
          <div
            className="detail-field-value"
            onClick={() => setMenu(menu === 'heading' ? null : 'heading')}
            style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--text-muted)', fontSize: 14 }}
          >
            <List size={14} />
            {currentHeading ? currentHeading.name : 'No heading'}

            {menu === 'heading' && (
              <div
                ref={flipIfOffscreen}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  minWidth: '200px',
                  zIndex: 100,
                  marginTop: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskUpdate(task.id, { heading_id: null });
                    setMenu(null);
                  }}
                  style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
                >
                  No heading
                </div>
                {headings.map((heading) => (
                  <div
                    key={heading.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskUpdate(task.id, { heading_id: heading.id });
                      setMenu(null);
                    }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: task.heading_id === heading.id ? 'var(--accent-soft)' : 'transparent',
                      color: task.heading_id === heading.id ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    {heading.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assignee & Followers */}
        <div className="detail-field-block" style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="detail-field-label">
              <User size={16} style={{ display: 'inline', marginRight: '4px' }} />
              Assignee
            </label>
            <div
              className="detail-field-value"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'relative',
              }}
              onClick={() => setMenu(menu === 'assignee' ? null : 'assignee')}
            >
              {assignedMember ? (
                <>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      ...avatarStyle(assignedMember.profile?.avatar_url, assignedMember.profile?.avatar_color),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {assignedMember.profile?.initials ?? assignedMember.email.slice(0, 2).toUpperCase()}
                  </div>
                  <span>{assignedMember.profile?.name ?? assignedMember.email}</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
              )}

              {menu === 'assignee' && (
                <PeoplePicker
                  people={projectMembers}
                  selectedId={task.assignee_id}
                  allowNone
                  emptyText="No members yet — invite someone from the project header."
                  onPick={(id) => {
                    onTaskUpdate(task.id, { assignee_id: id });
                    setMenu(null);
                  }}
                  onClose={() => setMenu(null)}
                />
              )}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="detail-field-label">
              <Users size={16} style={{ display: 'inline', marginRight: '4px' }} />
              Followers
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {followers.map((f) => (
                <div
                  key={f.user_id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 6px 4px 4px',
                    borderRadius: '14px',
                    background: 'var(--surface-alt)',
                    fontSize: '12px',
                    color: 'var(--text)',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      ...avatarStyle(f.profile?.avatar_url, f.profile?.avatar_color),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {f.profile?.initials ?? f.profile?.email?.slice(0, 2).toUpperCase() ?? '?'}
                  </div>
                  {f.profile?.name ?? f.profile?.email ?? 'Unknown'}
                  {f.user_id === currentUserId && ' (you)'}
                  <button
                    onClick={() => onFollowerRemove(f.user_id)}
                    title="Remove follower"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {followers.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No followers yet</span>}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenu(menu === 'follower' ? null : 'follower')}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={13} />
                Add follower
              </button>

              {menu === 'follower' && (
                <PeoplePicker
                  people={followableMembers}
                  alignRight
                  emptyText="Everyone is already following."
                  onPick={(id) => {
                    if (id) onFollowerAdd(id); // stays open so several can be added in a row
                  }}
                  onClose={() => setMenu(null)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Due Date & Priority */}
        <div className="detail-field-block" style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="detail-field-label" style={{ display: 'flex', alignItems: 'center' }}>
              <Calendar size={16} style={{ display: 'inline', marginRight: '4px' }} />
              Due date
              {canManage ? (
                <button
                  type="button"
                  title={task.due_locked ? 'Locked: only managers can change it. Click to unlock' : 'Lock the date so only managers can change it'}
                  aria-pressed={!!task.due_locked}
                  onClick={() => onTaskUpdate(task.id, { due_locked: !task.due_locked })}
                  style={{ marginLeft: 6, border: 'none', background: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: task.due_locked ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {task.due_locked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
              ) : (
                task.due_locked && <Lock size={14} aria-label="Locked by a manager" style={{ marginLeft: 6, color: 'var(--accent)' }} />
              )}
            </div>
            <div
              className="detail-field-value"
              onClick={() => !dateReadOnly && setMenu(menu === 'dueDate' ? null : 'dueDate')}
              title={dateReadOnly ? 'A manager has locked this date' : undefined}
              style={{ cursor: dateReadOnly ? 'default' : 'pointer', position: 'relative', color: isOverdue ? '#D64545' : undefined, fontWeight: isOverdue ? 600 : undefined }}
            >
              {task.due_date
                ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'No due date'}

              {menu === 'dueDate' && (
                <div
                  ref={flipIfOffscreen}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '12px',
                    zIndex: 100,
                    marginTop: '4px',
                    minWidth: '200px',
                  }}
                >
                  <input
                    type="date"
                    autoFocus
                    ref={openPicker}
                    defaultValue={task.due_date ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      onTaskUpdate(task.id, { due_date: e.target.value || null });
                      setMenu(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              )}
            </div>
            {dateReadOnly && onExtensionRequest && !task.completed && (
              extension ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!extension.date) return;
                    onExtensionRequest(extension.date, extension.reason.trim());
                    setExtension(null);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}
                >
                  <input type="date" required autoFocus value={extension.date} min={task.due_date ?? undefined}
                    onChange={(e) => setExtension({ ...extension, date: e.target.value })}
                    style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 4 }} />
                  <input placeholder="Why? (optional)" value={extension.reason}
                    onChange={(e) => setExtension({ ...extension, reason: e.target.value })}
                    style={{ padding: 6, border: '1px solid var(--border)', borderRadius: 4, fontSize: 13 }} />
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button type="submit" className="modal-btn primary" style={{ height: 28, padding: '0 12px' }}>Send request</button>
                    <button type="button" className="modal-btn ghost" style={{ height: 28, padding: '0 12px' }} onClick={() => setExtension(null)}>Cancel</button>
                  </span>
                </form>
              ) : (
                <button type="button" onClick={() => setExtension({ date: '', reason: '' })}
                  style={{ marginTop: 6, border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontSize: 13 }}>
                  Request an extension
                </button>
              )
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="detail-field-label">
              <Flag size={16} style={{ display: 'inline', marginRight: '4px' }} />
              Priority
            </label>
            <div
              className="detail-field-value"
              onClick={() => setMenu(menu === 'priority' ? null : 'priority')}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              {task.priority ? (
                <span className={`priority-chip priority-${task.priority}`}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No priority</span>
              )}

              {menu === 'priority' && (
                <div
                  ref={flipIfOffscreen}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    zIndex: 100,
                    marginTop: '4px',
                  }}
                >
                  {priorityOptions.map((opt) => (
                    <div
                      key={opt}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskUpdate(task.id, { priority: opt });
                        setMenu(null);
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: task.priority === opt ? 'var(--accent-soft)' : 'transparent',
                        color: task.priority === opt ? 'var(--accent)' : 'var(--text)',
                      }}
                    >
                      <span className={`priority-chip priority-${opt}`}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Repeat & Tags */}
        <div className="detail-field-block" style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="detail-field-label">
              <Repeat size={16} style={{ display: 'inline', marginRight: '4px' }} />
              Repeat
            </label>
            {/* a repeating subtask rolls on to its next date when ticked; see migration 027 */}
            <select
              aria-label="Repeat"
              value={task.repeat ?? ''}
              onChange={(e) => onTaskUpdate(task.id, { repeat: e.target.value || null })}
              style={{ border: 'none', background: 'transparent', color: task.repeat ? 'var(--text)' : 'var(--text-muted)', fontSize: 14, cursor: 'pointer', padding: '4px 4px' }}
            >
              <option value="">Doesn&apos;t repeat</option>
              {repeatOptions(task.due_date, task.repeat).map((o) => (
                <option key={o.value} value={o.value}>Repeats {o.label.charAt(0).toLowerCase() + o.label.slice(1)}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="detail-field-label">Tags</label>
            <TagPicker
              selectedTags={task.tags ?? []}
              availableTags={availableTags}
              onTagAdd={onTagAdd}
              onTagRemove={onTagRemove}
              onNewTag={onNewTag}
            />
          </div>
        </div>

        {/* Subtasks — only level-1 tasks (no parent_task_id) can have these */}
        {!task.parent_task_id && (
          <div className="detail-field-block">
            <label className="detail-field-label">Subtasks</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
              {(task.subtasks ?? []).map((subtask) => (
                <div
                  key={subtask.id}
                  onClick={() => onSubtaskSelect(subtask.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  <div className={`task-checkbox ${subtask.completed ? 'completed' : ''}`} style={{ pointerEvents: 'none' }}>
                    {subtask.completed && <Check size={10} strokeWidth={3} />}
                  </div>
                  <span style={{ textDecoration: subtask.completed ? 'line-through' : 'none', color: subtask.completed ? 'var(--text-muted)' : 'var(--text)' }}>
                    {subtask.name}
                  </span>
                </div>
              ))}
              {(task.subtasks ?? []).length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '0 8px' }}>No subtasks yet</span>
              )}
            </div>

            {isAddingSubtask ? (
              <AddTaskForm
                projectId=""
                onTaskAdd={async (name) => {
                  await onSubtaskAdd(task.id, name);
                  setIsAddingSubtask(false);
                }}
                onCancel={() => setIsAddingSubtask(false)}
              />
            ) : (
              <button
                onClick={() => setIsAddingSubtask(true)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={13} />
                Add subtask
              </button>
            )}
          </div>
        )}

        {/* Description */}
        <div className="detail-description">
          <div className="detail-description-label">Description</div>
          {isEditingDescription ? (
            <>
            <FormatToolbar target={descriptionRef} />
            <textarea
              autoFocus
              ref={(el) => {
                descriptionRef.current = el;
                autoGrow(el);
              }}
              onInput={(e) => autoGrow(e.currentTarget)}
              className="detail-description-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveDescription();
                } else if (e.key === 'Escape') {
                  setDescription(task.description ?? '');
                  setIsEditingDescription(false);
                } else {
                  formatKeyDown(e);
                }
              }}
              placeholder="Add a description…"
            />
            </>
          ) : (
            <div
              onClick={() => setIsEditingDescription(true)}
              style={{
                width: '100%',
                minHeight: '72px',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                color: description ? 'var(--text)' : 'var(--text-muted)',
                fontStyle: description ? 'normal' : 'italic',
                cursor: 'pointer',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {description ? <Markdown text={description} /> : 'Add a description…'}
            </div>
          )}
        </div>

        <Comments
          taskId={task.id}
          comments={comments}
          loading={commentsLoading}
          mentionableUsers={projectMembers
            .filter((m) => m.profile_id)
            .map((m) => ({ id: m.profile_id as string, name: m.profile?.name ?? m.email }))}
          onCommentAdd={onCommentAdd}
          onCommentEdit={onCommentEdit}
          onCommentDelete={onCommentDelete}
          onCommentLike={onCommentLike}
          canAnswerRequests={canManage}
          onRequestAnswer={onRequestAnswer}
        />

        <div className="detail-description" style={{ marginTop: '20px', paddingTop: '20px' }}>
          <div className="detail-description-label">Activity</div>
          {activity.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activity.map((entry) => (
                <div key={entry.id} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{entry.actor?.name ?? 'Someone'}</span>
                  {' '}{entry.message} · {relativeTime(entry.created_at)}
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No activity yet</span>
          )}
        </div>
      </div>
    </div>
  );
}
