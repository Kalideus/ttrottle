'use client';

import { useState } from 'react';
import { MoreVertical, ChevronUp, ChevronDown, Trash2, Check, Plus } from 'lucide-react';
import type { Task, Heading } from '@/lib/supabase/queries';
import { AddTaskForm } from '@/components/AddTaskForm';
import { hexToRgba } from '@/components/TagPicker';

interface TaskTableProps {
  tasks: (Task & { subtasks?: Task[] })[];
  headings: Heading[];
  onTaskSelect: (taskId: string) => void;
  selectedTaskId?: string | null;
  currentUserId?: string | null;
  onTaskAdd: (headingId: string | null, name: string) => Promise<void>;
  onSubtaskAdd: (parentTaskId: string, name: string) => Promise<void>;
  onTaskUpdate: (taskId: string, updates: Record<string, unknown>) => Promise<void>;
  onTaskDelete: (taskId: string) => Promise<void>;
  onHeadingRename: (headingId: string, name: string) => Promise<void>;
  onHeadingAdd: (name: string) => Promise<void>;
  onHeadingDelete: (headingId: string) => Promise<void>;
  onNoHeadingRename: (name: string, taskIds: string[]) => Promise<void>;
  onTaskReorder: (taskId: string, swapWithTaskId: string) => Promise<void>;
  manualOrder?: boolean;
}

export function TaskTable({ tasks, headings, onTaskSelect, selectedTaskId, currentUserId, onTaskAdd, onSubtaskAdd, onTaskUpdate, onTaskDelete, onHeadingRename, onHeadingAdd, onHeadingDelete, onNoHeadingRename, onTaskReorder, manualOrder = false }: TaskTableProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [addingToHeading, setAddingToHeading] = useState<string | null>(null);
  const [editingDueDateId, setEditingDueDateId] = useState<string | null>(null);
  const [editingHeadingId, setEditingHeadingId] = useState<string | null>(null);
  const [headingDraft, setHeadingDraft] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverHeadingId, setDragOverHeadingId] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [undoTask, setUndoTask] = useState<{ id: string; name: string } | null>(null);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);

  const headingMap = new Map(headings.map((h) => [h.id, h.name]));

  const toggleSection = (headingId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [headingId]: !prev[headingId],
    }));
  };

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const toggleTaskComplete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();

    if (task.completed) {
      onTaskUpdate(task.id, { completed: false });
      return;
    }

    if (!window.confirm(`Mark "${task.name}" as complete?`)) return;

    setCompletingTaskId(task.id);
    setTimeout(() => {
      setCompletingTaskId(null);
      onTaskUpdate(task.id, { completed: true });
      setUndoTask({ id: task.id, name: task.name });
      setTimeout(() => {
        setUndoTask((current) => (current?.id === task.id ? null : current));
      }, 5000);
    }, 1000);
  };

  const undoComplete = () => {
    if (!undoTask) return;
    onTaskUpdate(undoTask.id, { completed: false });
    setUndoTask(null);
  };

  const startHeadingEdit = (headingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHeadingDraft(headingId === '__no_heading__' ? '' : headingMap.get(headingId) ?? '');
    setEditingHeadingId(headingId);
  };

  const saveHeadingEdit = async (headingId: string) => {
    if (headingDraft.trim()) {
      if (headingId === '__no_heading__') {
        const taskIds = (groupedTasks[headingId] ?? []).map((t) => t.id);
        await onNoHeadingRename(headingDraft.trim(), taskIds);
      } else {
        await onHeadingRename(headingId, headingDraft.trim());
      }
    }
    setEditingHeadingId(null);
  };

  // Group tasks by heading
  const groupedTasks = tasks.reduce(
    (acc, task) => {
      const headingId = task.heading_id || '__no_heading__';
      if (!acc[headingId]) {
        acc[headingId] = [];
      }
      acc[headingId].push(task);
      return acc;
    },
    {} as Record<string, Task[]>
  );

  // Every real heading gets a section even with zero tasks; "(no heading)" only shows if it's non-empty.
  const sectionIds = [
    ...headings.map((h) => h.id),
    ...(groupedTasks['__no_heading__']?.length ? ['__no_heading__'] : []),
  ];

  const handleDropOnSection = (targetHeadingId: string) => {
    setDragOverHeadingId(null);
    if (!draggedTaskId) return;
    const targetHeadingIdOrNull = targetHeadingId === '__no_heading__' ? null : targetHeadingId;
    const draggedTask = tasks.find((t) => t.id === draggedTaskId);
    if (!draggedTask || draggedTask.heading_id === targetHeadingIdOrNull) {
      setDraggedTaskId(null);
      return;
    }
    const targetTasks = groupedTasks[targetHeadingId] ?? [];
    const maxPosition = targetTasks.length ? Math.max(...targetTasks.map((t) => t.position)) : -1;
    onTaskUpdate(draggedTaskId, { heading_id: targetHeadingIdOrNull, position: maxPosition + 1 });
    setDraggedTaskId(null);
  };

  const renderDueDateCell = (task: Task) => {
    const isOverdue = !!task.due_date && !task.completed && new Date(task.due_date) < new Date();
    return (
    <div className="task-metadata-cell" style={{ position: 'relative' }}>
      {task.due_date ? (
        <span
          className="due-date-cell"
          onClick={(e) => {
            e.stopPropagation();
            setEditingDueDateId(task.id);
          }}
          style={{ cursor: 'pointer', color: isOverdue ? '#D64545' : undefined, fontWeight: isOverdue ? 600 : undefined }}
        >
          {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      ) : (
        <div
          className="empty-cell"
          style={{ borderRadius: '4px', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            setEditingDueDateId(task.id);
          }}
        >
          📅
        </div>
      )}

      {editingDueDateId === task.id && (
        <input
          type="date"
          autoFocus
          defaultValue={task.due_date ?? ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            onTaskUpdate(task.id, { due_date: e.target.value || null });
            setEditingDueDateId(null);
          }}
          onBlur={() => setEditingDueDateId(null)}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            marginTop: '4px',
            padding: '6px',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            background: 'var(--surface)',
          }}
        />
      )}
    </div>
    );
  };

  const renderTask = (task: Task, siblings: Task[], isLevel2 = false) => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTasks[task.id];
    const isCompleted = task.completed;
    const siblingIndex = siblings.findIndex((t) => t.id === task.id);
    const prevSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
    const nextSibling = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;

    return (
      <div key={task.id}>
        <div className={`task-row ${isLevel2 ? 'level-2' : ''} ${selectedTaskId === task.id ? 'selected' : ''} ${completingTaskId === task.id ? 'completing' : ''}`}
          onClick={() => {
            onTaskSelect(task.id);
            if (hasSubtasks) setExpandedTasks((prev) => ({ ...prev, [task.id]: true }));
          }}
          draggable={!isLevel2}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            setDraggedTaskId(task.id);
          }}
          onDragEnd={() => setDraggedTaskId(null)}
          style={{ opacity: draggedTaskId === task.id ? 0.4 : 1, cursor: isLevel2 ? undefined : 'grab' }}
        >
          <div className="task-row-content">
            {hasSubtasks && (
              <div
                className={`task-disclosure ${isExpanded ? '' : 'collapsed'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTaskExpand(task.id);
                }}
              >
                ▸
              </div>
            )}
            {!hasSubtasks && <div className="task-disclosure" />}

            {manualOrder && (
              <div className="task-reorder-controls">
                <button
                  disabled={!prevSibling}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (prevSibling) onTaskReorder(task.id, prevSibling.id);
                  }}
                  style={{ background: 'none', border: 'none', cursor: prevSibling ? 'pointer' : 'default', color: prevSibling ? 'var(--text-muted)' : 'var(--border)', padding: 0, lineHeight: 0 }}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  disabled={!nextSibling}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (nextSibling) onTaskReorder(task.id, nextSibling.id);
                  }}
                  style={{ background: 'none', border: 'none', cursor: nextSibling ? 'pointer' : 'default', color: nextSibling ? 'var(--text-muted)' : 'var(--border)', padding: 0, lineHeight: 0 }}
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            )}

            <div
              className={`task-checkbox ${isCompleted ? 'completed' : ''} ${completingTaskId === task.id ? 'completing' : ''}`}
              onClick={(e) => toggleTaskComplete(task, e)}
            >
              {(isCompleted || completingTaskId === task.id) && <Check size={12} strokeWidth={3} />}
            </div>

            <div className={`task-name ${isCompleted ? 'completed' : ''}`}>
              {task.name}
            </div>

            {task.project && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: hexToRgba(task.project.color, 0.15),
                  color: task.project.color,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {task.project.name}
              </span>
            )}

            {(task.tags ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {task.tags!.map((tag) => (
                  <span
                    key={tag.id}
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      backgroundColor: hexToRgba(tag.color, 0.15),
                      color: tag.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {hasSubtasks && (
              <span className="task-subtask-count">
                {task.subtasks?.filter((st) => !st.completed).length}/{task.subtasks?.length}
              </span>
            )}

            <div style={{ position: 'relative' }}>
              <button
                className="task-menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuTaskId(openMenuTaskId === task.id ? null : task.id);
                }}
              >
                <MoreVertical size={16} />
              </button>

              {openMenuTaskId === task.id && (
                <>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuTaskId(null);
                    }}
                    style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                  />
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
                    {!isLevel2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuTaskId(null);
                          setExpandedTasks((prev) => ({ ...prev, [task.id]: true }));
                          setAddingSubtaskTo(task.id);
                        }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}
                      >
                        <Plus size={14} />
                        Add subtask
                      </button>
                    )}
                    {task.created_by === currentUserId ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuTaskId(null);
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
                </>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div className="task-metadata-cell">
            {task.assignee ? (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                }}
                title={task.assignee.name}
              >
                {task.assignee.initials || task.assignee.name?.substring(0, 2).toUpperCase()}
              </div>
            ) : (
              <div className="empty-cell">👤</div>
            )}
          </div>

          {renderDueDateCell(task)}

          {/* Priority */}
          <div className="task-metadata-cell">
            {task.priority ? (
              <span className={`priority-chip priority-${task.priority}`}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Subtasks — level-2 tasks can't have their own subtasks, so this never recurses further */}
        {!isLevel2 && (hasSubtasks || addingSubtaskTo === task.id) && isExpanded && (
          <>
            {task.subtasks?.map((subtask) => renderTask(subtask, task.subtasks!, true))}
            {addingSubtaskTo === task.id ? (
              <div style={{ padding: '8px 24px 8px calc(24px + 28px + 28px)' }}>
                <AddTaskForm
                  projectId=""
                  onTaskAdd={async (name) => {
                    await onSubtaskAdd(task.id, name);
                    setAddingSubtaskTo(null);
                  }}
                  onCancel={() => setAddingSubtaskTo(null)}
                />
              </div>
            ) : (
              <div
                className="add-task-row"
                style={{
                  paddingLeft: 'calc(24px + 28px + 28px)',
                  color: 'var(--text-muted)',
                }}
                onClick={() => setAddingSubtaskTo(task.id)}
              >
                <span style={{ fontSize: '13px' }}>+ Add subtask</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const undoToast = undoTask && (
    <div className="undo-toast">
      <span>Task completed</span>
      <button onClick={undoComplete}>Undo</button>
    </div>
  );

  if (tasks.length === 0 && headings.length === 0) {
    return (
      <div className="app-table-area">
        <div className="table-header">
          <div className="table-header-cell">Name</div>
          <div className="table-header-cell">Assignee</div>
          <div className="table-header-cell">Due date</div>
          <div className="table-header-cell">Priority</div>
        </div>
        <div className="table-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <p style={{ color: 'var(--text-muted)' }}>No tasks yet. Create one to get started!</p>
          {addingToHeading === '__no_heading__' ? (
            <div style={{ width: '320px' }}>
              <AddTaskForm
                projectId=""
                onTaskAdd={(name) => onTaskAdd(null, name)}
                onCancel={() => setAddingToHeading(null)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="toolbar-add-task-btn"
              onClick={() => setAddingToHeading('__no_heading__')}
            >
              + Add task
            </button>
          )}
          {addingSection ? (
            <input
              autoFocus
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Section name"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newSectionName.trim()) {
                  await onHeadingAdd(newSectionName.trim());
                  setNewSectionName('');
                  setAddingSection(false);
                }
                if (e.key === 'Escape') setAddingSection(false);
              }}
              onBlur={() => setAddingSection(false)}
              style={{ padding: '8px 12px', border: '1px solid var(--accent)', borderRadius: '4px', fontSize: '14px', color: 'var(--text)' }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingSection(true)}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px' }}
            >
              + Add section
            </button>
          )}
        </div>
        {undoToast}
      </div>
    );
  }

  return (
    <div className="app-table-area">
      <div className="table-header">
        <div className="table-header-cell">Name</div>
        <div className="table-header-cell">Assignee</div>
        <div className="table-header-cell">Due date</div>
        <div className="table-header-cell">Priority</div>
      </div>

      <div className="table-body">
        {sectionIds.map((headingId) => {
          const headingTasks = groupedTasks[headingId] ?? [];
          return (
          <div
            key={headingId}
            className="table-section"
            onDragOver={(e) => {
              if (draggedTaskId) {
                e.preventDefault();
                if (dragOverHeadingId !== headingId) setDragOverHeadingId(headingId);
              }
            }}
            onDragLeave={() => setDragOverHeadingId((prev) => (prev === headingId ? null : prev))}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnSection(headingId);
            }}
            style={{ backgroundColor: dragOverHeadingId === headingId ? 'var(--accent-soft)' : undefined }}
          >
            <div
              className="section-header"
              onClick={() => toggleSection(headingId)}
            >
              <div className="section-header-content">
                <div
                  className={`section-disclosure ${
                    !expandedSections[headingId] ? 'collapsed' : ''
                  }`}
                >
                  ▸
                </div>
                {editingHeadingId === headingId ? (
                  <input
                    autoFocus
                    value={headingDraft}
                    placeholder={headingId === '__no_heading__' ? 'Section name' : undefined}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setHeadingDraft(e.target.value)}
                    onBlur={() => saveHeadingEdit(headingId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveHeadingEdit(headingId);
                      if (e.key === 'Escape') setEditingHeadingId(null);
                    }}
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      border: '1px solid var(--accent)',
                      borderRadius: '4px',
                    }}
                  />
                ) : (
                  <div
                    className="section-title"
                    onClick={(e) => startHeadingEdit(headingId, e)}
                    style={{ cursor: 'pointer' }}
                  >
                    {headingId === '__no_heading__' ? '(no heading)' : headingMap.get(headingId) ?? '(untitled heading)'}
                  </div>
                )}
              </div>

              {headingId !== '__no_heading__' && (
                <button
                  type="button"
                  title="Delete section"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${headingMap.get(headingId)}"? Its tasks will move to (no heading).`)) {
                      onHeadingDelete(headingId);
                    }
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', gridColumn: 4, justifySelf: 'end' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {expandedSections[headingId] !== false && (
              <>
                {headingTasks.map((task) => renderTask(task, headingTasks))}
                {addingToHeading === headingId ? (
                  <div style={{ padding: '8px 24px' }}>
                    <AddTaskForm
                      projectId=""
                      headingId={headingId === '__no_heading__' ? undefined : headingId}
                      onTaskAdd={(name) => onTaskAdd(headingId === '__no_heading__' ? null : headingId, name)}
                      onCancel={() => setAddingToHeading(null)}
                    />
                  </div>
                ) : (
                  <div
                    className="add-task-row"
                    onClick={() => setAddingToHeading(headingId)}
                  >
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '32px' }}>
                      + Add task…
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          );
        })}

        {addingSection ? (
          <div style={{ padding: '12px 24px', display: 'flex', gap: '8px' }}>
            <input
              autoFocus
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Section name"
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newSectionName.trim()) {
                  await onHeadingAdd(newSectionName.trim());
                  setNewSectionName('');
                  setAddingSection(false);
                }
                if (e.key === 'Escape') setAddingSection(false);
              }}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--accent)', borderRadius: '4px', fontSize: '14px', color: 'var(--text)' }}
            />
            <button
              type="button"
              onClick={async () => {
                if (newSectionName.trim()) {
                  await onHeadingAdd(newSectionName.trim());
                  setNewSectionName('');
                }
                setAddingSection(false);
              }}
              style={{ padding: '8px 12px', borderRadius: '4px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px' }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setAddingSection(false)}
              style={{ padding: '8px 12px', borderRadius: '4px', background: 'rgba(214, 69, 69, 0.1)', color: '#D64545', border: '1px solid rgba(214, 69, 69, 0.3)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={14} />
              Cancel
            </button>
          </div>
        ) : (
          <div className="add-task-row" onClick={() => setAddingSection(true)}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>+ Add section</span>
          </div>
        )}
      </div>
      {undoToast}
    </div>
  );
}
