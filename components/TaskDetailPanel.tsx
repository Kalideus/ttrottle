'use client';

import { X, MoreVertical, Calendar, User, Flag, List, Check, Users, Plus, Trash2, CornerUpLeft } from 'lucide-react';
import { useState } from 'react';
import type { Task, ProjectMember, Heading, Tag, Follower, TaskActivity } from '@/lib/supabase/queries';
import { Comments, type CommentItem } from '@/components/Comments';
import { TagPicker } from '@/components/TagPicker';
import { AddTaskForm } from '@/components/AddTaskForm';

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
  onTaskUpdate: (taskId: string, updates: Record<string, unknown>) => Promise<void>;
  onTaskDelete: (taskId: string) => Promise<void>;
  onTagAdd: (tag: Tag) => void;
  onTagRemove: (tagId: string) => void;
  onNewTag: (name: string, color: string) => Promise<void>;
  onCommentAdd: (body: string) => Promise<void>;
  onCommentEdit: (commentId: string, body: string) => Promise<void>;
  onCommentDelete: (commentId: string) => Promise<void>;
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
  onTaskUpdate,
  onTaskDelete,
  onTagAdd,
  onTagRemove,
  onNewTag,
  onCommentAdd,
  onCommentEdit,
  onCommentDelete,
}: TaskDetailPanelProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.name);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState(task.description ?? '');
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [showDueDateMenu, setShowDueDateMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showFollowerMenu, setShowFollowerMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  const priorityOptions: Array<'high' | 'medium' | 'low'> = ['low', 'medium', 'high'];
  const assignedMember = projectMembers.find((m) => m.profile_id === task.assignee_id);
  const currentHeading = headings.find((h) => h.id === task.heading_id);
  const isOverdue = !!task.due_date && !task.completed && new Date(task.due_date) < new Date();
  const followableMembers = projectMembers.filter((m) => m.profile_id && !followers.some((f) => f.user_id === m.profile_id));

  const handleSaveTitle = () => {
    if (title.trim() && title !== task.name) {
      onTaskUpdate(task.id, { name: title });
    }
    setIsEditingTitle(false);
  };

  const handleSaveDescription = () => {
    if (description !== (task.description ?? '')) {
      onTaskUpdate(task.id, { description });
    }
    setIsEditingDescription(false);
  };

  return (
    <div className="app-detail-panel">
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
          <button className="detail-panel-menu-btn" onClick={() => setShowOptionsMenu(!showOptionsMenu)}>
            <MoreVertical size={18} />
          </button>
          <button className="detail-panel-close-btn" onClick={onClose}>
            ✕
          </button>

          {showOptionsMenu && (
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
              {task.created_by === currentUserId ? (
                <button
                  onClick={() => {
                    setShowOptionsMenu(false);
                    if (window.confirm(`Delete "${task.name}"? This can't be undone.`)) {
                      onTaskDelete(task.id);
                    }
                  }}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#D64545', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Trash2 size={14} />
                  Delete task
                </button>
              ) : (
                <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Only the creator can delete this task.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="detail-panel-content">
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
              onClick={() => setShowAssigneeMenu(!showAssigneeMenu)}
            >
              {assignedMember ? (
                <>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: 'white',
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

              {showAssigneeMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
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
                      onTaskUpdate(task.id, { assignee_id: null });
                      setShowAssigneeMenu(false);
                    }}
                    style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  >
                    Unassigned
                  </div>
                  {projectMembers.filter((m) => m.profile_id).map((member) => (
                    <div
                      key={member.profile_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskUpdate(task.id, { assignee_id: member.profile_id });
                        setShowAssigneeMenu(false);
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        borderBottom: '1px solid var(--border)',
                        backgroundColor: task.assignee_id === member.profile_id ? 'var(--accent-soft)' : 'transparent',
                        color: task.assignee_id === member.profile_id ? 'var(--accent)' : 'var(--text)',
                      }}
                    >
                      👤 {member.profile?.name ?? member.email}
                    </div>
                  ))}
                  {projectMembers.filter((m) => m.profile_id).length === 0 && (
                    <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      No members yet — invite someone from the project header.
                    </div>
                  )}
                </div>
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
                      background: 'var(--accent)',
                      color: 'white',
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
                onClick={() => setShowFollowerMenu(!showFollowerMenu)}
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

              {showFollowerMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    minWidth: '200px',
                    zIndex: 100,
                    marginTop: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                >
                  {followableMembers.length > 0 ? (
                    followableMembers.map((member) => (
                      <div
                        key={member.profile_id}
                        onClick={() => {
                          onFollowerAdd(member.profile_id!);
                          setShowFollowerMenu(false);
                        }}
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
                      >
                        {member.profile?.name ?? member.email}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Everyone is already following.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Due Date & Priority */}
        <div className="detail-field-block" style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="detail-field-label">
              <Calendar size={16} style={{ display: 'inline', marginRight: '4px' }} />
              Due date
            </label>
            <div
              className="detail-field-value"
              onClick={() => setShowDueDateMenu(!showDueDateMenu)}
              style={{ cursor: 'pointer', position: 'relative', color: isOverdue ? '#D64545' : undefined, fontWeight: isOverdue ? 600 : undefined }}
            >
              {task.due_date
                ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'No due date'}

              {showDueDateMenu && (
                <div
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
                    defaultValue={task.due_date ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      onTaskUpdate(task.id, { due_date: e.target.value || null });
                      setShowDueDateMenu(false);
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
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="detail-field-label">
              <Flag size={16} style={{ display: 'inline', marginRight: '4px' }} />
              Priority
            </label>
            <div
              className="detail-field-value"
              onClick={() => setShowPriorityMenu(!showPriorityMenu)}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              {task.priority ? (
                <span className={`priority-chip priority-${task.priority}`}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No priority</span>
              )}

              {showPriorityMenu && (
                <div
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
                        setShowPriorityMenu(false);
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

        {/* Heading & Tags */}
        <div className="detail-field-block" style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="detail-field-label">
              <List size={16} style={{ display: 'inline', marginRight: '4px' }} />
              Heading
            </label>
            <div
              className="detail-field-value"
              onClick={() => setShowHeadingMenu(!showHeadingMenu)}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              {currentHeading ? currentHeading.name : <span style={{ color: 'var(--text-muted)' }}>No heading</span>}

              {showHeadingMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
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
                      setShowHeadingMenu(false);
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
                        setShowHeadingMenu(false);
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
                  {headings.length === 0 && (
                    <div style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      No sections yet — add one from the task list.
                    </div>
                  )}
                </div>
              )}
            </div>
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
            <textarea
              autoFocus
              className="detail-description-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              placeholder="What needs doing?"
            />
          ) : (
            <div
              onClick={() => setIsEditingDescription(true)}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '14px',
                color: description ? 'var(--text)' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {description || 'What needs doing?'}
            </div>
          )}
        </div>

        <Comments
          taskId={task.id}
          comments={comments}
          loading={commentsLoading}
          onCommentAdd={onCommentAdd}
          onCommentEdit={onCommentEdit}
          onCommentDelete={onCommentDelete}
          onCommentLike={async () => {}}
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
