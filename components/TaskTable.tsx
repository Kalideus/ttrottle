'use client';

import { useCallback, useState } from 'react';
import { MoreVertical, ChevronUp, ChevronDown, Trash2, Check, Plus, Pencil, CornerLeftUp, Lock } from 'lucide-react';
import type { Task, Heading, ProjectMember } from '@/lib/supabase/queries';
import { PeoplePicker, flipIfOffscreen } from '@/components/PeoplePicker';
import { AddTaskForm } from '@/components/AddTaskForm';
import { hexToRgba } from '@/components/TagPicker';
import { avatarStyle } from '@/lib/avatar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { openPicker } from '@/lib/openPicker';

interface TaskTableProps {
  tasks: (Task & { subtasks?: Task[] })[];
  headings: Heading[];
  members?: ProjectMember[];
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
  /** Flat list with no section headers or "+ Add section" — used by My Tasks. */
  flat?: boolean;
  // Bulk-select mode: when set, each row gets a checkbox.
  bulkSelected?: Set<string> | null;
  onBulkToggle?: (taskId: string) => void;
  /** Pointer resting on a row: lets the parent preload that task's panel. */
  onTaskHover?: (taskId: string) => void;
  /** Show completed subtasks too (top-level tasks are filtered by the parent). */
  showCompleted?: boolean;
  /** Drop a task onto another task to make it that task's subtask. */
  onMakeSubtask?: (taskId: string, parentTaskId: string) => void;
  /** Drop a subtask on a heading to turn it back into a top-level task there. */
  onPromoteSubtask?: (taskId: string, headingId: string | null, position: number) => void;
  /** My Tasks: clicking a task's project chip opens it there. */
  onOpenProject?: (projectId: string, taskId: string) => void;
  // may this user move a locked due date (project manager)? Others see the date read-only.
  canManage?: (projectId: string) => boolean;
}

export function TaskTable({ tasks, headings, members = [], onTaskSelect, selectedTaskId, currentUserId, onTaskAdd, onSubtaskAdd, onTaskUpdate, onTaskDelete, onHeadingRename, onHeadingAdd, onHeadingDelete, onNoHeadingRename, onTaskReorder, manualOrder = false, flat = false, bulkSelected = null, onBulkToggle, onTaskHover, showCompleted = false, onMakeSubtask, onPromoteSubtask, onOpenProject, canManage = () => false }: TaskTableProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  // Accordion: only one task's subtasks open at a time -- opening a new one
  // closes whichever was open, clicking the open one again closes it.
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [addingToHeading, setAddingToHeading] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  // Below this width (e.g. with the task panel open) rows drop to just name + due date.
  // Measured on the table itself, not the window, since the panel is what squeezes it.
  const [compact, setCompact] = useState(false);
  const watchWidth = useCallback((el: HTMLDivElement) => {
    const ro = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < 1000));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [priorityMenuId, setPriorityMenuId] = useState<string | null>(null);
  const [editingHeadingId, setEditingHeadingId] = useState<string | null>(null);
  const [headingDraft, setHeadingDraft] = useState('');
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverHeadingId, setDragOverHeadingId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [undoTask, setUndoTask] = useState<{ id: string; name: string } | null>(null);
  const [confirmTask, setConfirmTask] = useState<Task | null>(null);
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [editingTaskNameId, setEditingTaskNameId] = useState<string | null>(null);
  const [taskNameDraft, setTaskNameDraft] = useState('');

  const saveTaskName = (task: Task) => {
    const trimmed = taskNameDraft.trim();
    if (trimmed && trimmed !== task.name) onTaskUpdate(task.id, { name: trimmed });
    setEditingTaskNameId(null);
  };

  const headingMap = new Map(headings.map((h) => [h.id, h.name]));

  const toggleSection = (headingId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [headingId]: !prev[headingId],
    }));
  };

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  const toggleTaskComplete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();

    if (task.completed) {
      onTaskUpdate(task.id, { completed: false });
      return;
    }

    setConfirmTask(task);
  };

  const completeTask = (task: Task) => {
    setConfirmTask(null);
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

  // the dragged row may be a top-level task or a subtask
  const findTask = (id: string) => tasks.find((t) => t.id === id) ?? tasks.flatMap((t) => t.subtasks ?? []).find((t) => t.id === id);

  const canNestInto = (target: Task, targetIsSubtask: boolean) => {
    if (!onMakeSubtask || flat || targetIsSubtask || !draggedTaskId || draggedTaskId === target.id) return false;
    const dragged = findTask(draggedTaskId);
    return !!dragged && !dragged.subtasks?.length && dragged.parent_task_id !== target.id;
  };

  // Rows where letting go does nothing, so a short or accidental drag can't fall through to the section:
  // the dragged row itself, and for a subtask, its own parent and any subtask row. A subtask becomes a
  // top-level task only when dropped on a heading or the section's empty space.
  const isDeadZone = (target: Task, targetIsSubtask: boolean) => {
    if (!draggedTaskId) return false;
    if (draggedTaskId === target.id) return true;
    const dragged = findTask(draggedTaskId);
    return !!dragged?.parent_task_id && (targetIsSubtask || dragged.parent_task_id === target.id);
  };

  const handleDropOnSection = (targetHeadingId: string) => {
    setDragOverHeadingId(null);
    if (!draggedTaskId) return;
    const targetHeadingIdOrNull = targetHeadingId === '__no_heading__' ? null : targetHeadingId;
    const draggedTask = findTask(draggedTaskId);
    const targetTasks = groupedTasks[targetHeadingId] ?? [];
    const maxPosition = targetTasks.length ? Math.max(...targetTasks.map((t) => t.position)) : -1;
    if (draggedTask?.parent_task_id) {
      // a subtask dropped on a heading becomes a top-level task there
      onPromoteSubtask?.(draggedTask.id, targetHeadingIdOrNull, maxPosition + 1);
    } else if (draggedTask && draggedTask.heading_id !== targetHeadingIdOrNull) {
      onTaskUpdate(draggedTaskId, { heading_id: targetHeadingIdOrNull, position: maxPosition + 1 });
    }
    setDraggedTaskId(null);
  };

  const renderDueDateCell = (task: Task) => {
    const isOverdue = !!task.due_date && !task.completed && new Date(task.due_date) < new Date();
    const readOnly = !!task.due_locked && !canManage(task.project_id);
    return (
    <div
      className="task-metadata-cell task-cell-due"
      title={task.due_locked ? (readOnly ? 'Locked by a manager. Open the task to request an extension' : 'Due date locked') : undefined}
      style={{ position: 'relative', cursor: readOnly ? 'default' : 'pointer' }}
      // The date input is always there but invisible; clicking the cell opens its calendar
      // directly (showPicker needs the click itself, so it can't wait for a re-render).
      onClick={(e) => {
        e.stopPropagation();
        if (!readOnly) openPicker(e.currentTarget.querySelector('input'));
      }}
    >
      {task.due_date ? (
        <span
          className="due-date-cell"
          style={{ color: isOverdue ? '#D64545' : undefined, fontWeight: isOverdue ? 600 : undefined }}
        >
          {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          {task.due_locked && <Lock size={11} aria-label="Locked" style={{ marginLeft: 4, verticalAlign: -1, opacity: 0.7 }} />}
        </span>
      ) : (
        <div className="empty-cell" style={{ borderRadius: '4px' }}>
          📅
        </div>
      )}
      <input
        type="date"
        tabIndex={-1}
        aria-label="Due date"
        value={task.due_date ?? ''}
        onChange={(e) => onTaskUpdate(task.id, { due_date: e.target.value || null })}
        style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
      />
    </div>
    );
  };

  const renderTask = (task: Task, siblings: Task[], isLevel2 = false) => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTaskId === task.id;
    const isCompleted = task.completed;
    const siblingIndex = siblings.findIndex((t) => t.id === task.id);
    const prevSibling = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
    const nextSibling = siblingIndex >= 0 && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;
    const projectChip = task.project ? (
      <span
        role={onOpenProject ? 'button' : undefined}
        title={onOpenProject ? `Open in ${task.project.name}` : undefined}
        onClick={
          onOpenProject &&
          ((e) => {
            e.stopPropagation();
            onOpenProject(task.project_id, task.id);
          })
        }
        style={{
          cursor: onOpenProject ? 'pointer' : undefined,
          fontSize: '11px',
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: '10px',
          backgroundColor: hexToRgba(task.project.color, 0.15),
          color: task.project.color,
          whiteSpace: 'nowrap',
        }}
      >
        {task.project.name}
      </span>
    ) : null;

    return (
      <div key={task.id}>
        <div className={`task-row ${isLevel2 ? 'level-2' : ''} ${selectedTaskId === task.id ? 'selected' : ''} ${completingTaskId === task.id ? 'completing' : ''} ${dragOverTaskId === task.id ? 'drop-target' : ''}`}
          onMouseEnter={() => onTaskHover?.(task.id)}
          // Dropping a task onto another makes it a subtask. Not allowed: onto a subtask (two levels max),
          // onto itself, a task that has its own subtasks, or in My Tasks (which mixes projects).
          // Otherwise the event falls through to the section, which moves the task to that heading.
          onDragOver={(e) => {
            // rows where letting go does nothing (see isDeadZone) swallow the drop so it can't reach the section
            if (isDeadZone(task, isLevel2)) {
              e.preventDefault();
              e.stopPropagation();
              setDragOverHeadingId(null);
              return;
            }
            if (!canNestInto(task, isLevel2)) return;
            e.preventDefault();
            e.stopPropagation();
            if (dragOverTaskId !== task.id) setDragOverTaskId(task.id);
            setDragOverHeadingId(null);
          }}
          onDragLeave={() => setDragOverTaskId((prev) => (prev === task.id ? null : prev))}
          onDrop={(e) => {
            if (isDeadZone(task, isLevel2)) {
              e.preventDefault();
              e.stopPropagation();
              setDraggedTaskId(null);
              return;
            }
            if (!canNestInto(task, isLevel2) || !draggedTaskId) return;
            e.preventDefault();
            e.stopPropagation();
            onMakeSubtask?.(draggedTaskId, task.id);
            setExpandedTaskId(task.id); // show where it landed
            setDragOverTaskId(null);
            setDraggedTaskId(null);
          }}
          onClick={() => {
            onTaskSelect(task.id);
            if (hasSubtasks) toggleTaskExpand(task.id);
          }}
          draggable={!(isLevel2 && flat)}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            setDraggedTaskId(task.id);
          }}
          onDragEnd={() => {
            setDraggedTaskId(null);
            setDragOverTaskId(null);
          }}
          style={{ opacity: draggedTaskId === task.id ? 0.4 : 1, cursor: isLevel2 && flat ? undefined : 'grab' }}
        >
          <div className="task-row-content">
            {bulkSelected && (
              <input
                type="checkbox"
                className="task-bulk-check"
                aria-label={`Select ${task.name}`}
                checked={bulkSelected.has(task.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onBulkToggle?.(task.id)}
              />
            )}
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

            {editingTaskNameId === task.id ? (
              <input
                className="task-name-input"
                autoFocus
                value={taskNameDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTaskNameDraft(e.target.value)}
                onBlur={() => saveTaskName(task)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setEditingTaskNameId(null);
                }}
              />
            ) : (
              <div className={`task-name ${isCompleted ? 'completed' : ''}`}>
                {task.name}
              </div>
            )}

            {projectChip && <span className="task-project-inline" style={{ flexShrink: 0 }}>{projectChip}</span>}

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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuTaskId(null);
                        setTaskNameDraft(task.name);
                        setEditingTaskNameId(task.id);
                      }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}
                    >
                      <Pencil size={14} />
                      Rename
                    </button>
                    {!isLevel2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuTaskId(null);
                          setExpandedTaskId(task.id);
                          setAddingSubtaskTo(task.id);
                        }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}
                      >
                        <Plus size={14} />
                        Add subtask
                      </button>
                    )}
                    {/* same as dragging it onto its section; not in My Tasks, which mixes projects */}
                    {isLevel2 && !flat && onPromoteSubtask && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuTaskId(null);
                          const parent = tasks.find((t) => t.id === task.parent_task_id);
                          const section = groupedTasks[parent?.heading_id || '__no_heading__'] ?? [];
                          onPromoteSubtask(task.id, parent?.heading_id ?? null, section.length ? Math.max(...section.map((t) => t.position)) + 1 : 0);
                        }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}
                      >
                        <CornerLeftUp size={14} />
                        Make it a task
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuTaskId(null);
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
                </>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div
            className="task-metadata-cell task-cell-assignee"
            style={{ position: 'relative', cursor: 'pointer', zIndex: assigningId === task.id ? 50 : undefined }}
            onClick={(e) => {
              e.stopPropagation();
              setAssigningId(task.id);
            }}
          >
            {task.assignee ? (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  ...avatarStyle(task.assignee.avatar_url, task.assignee.avatar_color),
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
              <div className="empty-cell" data-hint="Assign">👤</div>
            )}
            {assigningId === task.id && (
              <PeoplePicker
                people={members}
                selectedId={task.assignee_id}
                allowNone
                emptyText="No members yet — invite someone from the project header."
                onPick={(id) => {
                  onTaskUpdate(task.id, { assignee_id: id });
                  setAssigningId(null);
                }}
                onClose={() => setAssigningId(null)}
              />
            )}
          </div>

          {renderDueDateCell(task)}

          {/* Priority */}
          <div
            className="task-metadata-cell task-cell-priority"
            style={{ position: 'relative', cursor: 'pointer', zIndex: priorityMenuId === task.id ? 50 : undefined }}
            onClick={(e) => {
              e.stopPropagation();
              setPriorityMenuId(task.id);
            }}
          >
            {task.priority ? (
              <span className={`priority-chip priority-${task.priority}`}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </span>
            ) : (
              <span className="priority-hint" data-hint="Set priority" />
            )}
            {priorityMenuId === task.id && (
              <>
                <div className="ct-picker-backdrop" onClick={(e) => { e.stopPropagation(); setPriorityMenuId(null); }} />
                <div className="ct-picker-pop" ref={flipIfOffscreen} style={{ width: 140, left: 'auto', right: 0 }} onClick={(e) => e.stopPropagation()}>
                  {(['high', 'medium', 'low', null] as const).map((opt) => (
                    <button
                      key={opt ?? 'none'}
                      type="button"
                      className="ct-picker-item"
                      style={{ width: '100%' }}
                      aria-selected={task.priority === opt}
                      onClick={() => {
                        onTaskUpdate(task.id, { priority: opt });
                        setPriorityMenuId(null);
                      }}
                    >
                      {opt ? (
                        <span className={`priority-chip priority-${opt}`}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</span>
                      ) : (
                        <span className="ct-muted">No priority</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Subtasks — level-2 tasks can't have their own subtasks, so this never recurses further */}
        {!isLevel2 && (hasSubtasks || addingSubtaskTo === task.id) && isExpanded && (
          <>
            {(() => {
              // completed subtasks follow the "Show completed" toggle; the n/m count above still includes them
              const visible = (task.subtasks ?? []).filter((st) => showCompleted || !st.completed);
              return visible.map((subtask) => renderTask(subtask, visible, true));
            })()}
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

  const confirmDialog = confirmTask && (
    <ConfirmModal
      title="Complete task?"
      message={`Mark "${confirmTask.name}" as complete?`}
      confirmLabel="Complete"
      onConfirm={() => completeTask(confirmTask)}
      onCancel={() => setConfirmTask(null)}
    />
  );

  const undoToast = undoTask && (
    <div className="undo-toast">
      <span>Task completed</span>
      <button onClick={undoComplete}>Undo</button>
    </div>
  );

  if (tasks.length === 0 && headings.length === 0) {
    return (
      <div className={`app-table-area ${compact ? 'is-compact' : ''} ${flat ? 'is-flat' : ''}`} ref={watchWidth}>
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
        {confirmDialog}
      </div>
    );
  }

  return (
    <div className={`app-table-area ${compact ? 'is-compact' : ''} ${flat ? 'is-flat' : ''}`} ref={watchWidth}>
      <div className="table-header">
        <div className="table-header-cell">Name</div>
        <div className="table-header-cell">Assignee</div>
        <div className="table-header-cell">Due date</div>
        <div className="table-header-cell">Priority</div>
      </div>

      <div className="table-body">
        {sectionIds.map((headingId) => {
          const headingTasks = groupedTasks[headingId] ?? [];
          if (flat) {
            return (
              <div key={headingId} className="table-section">
                {headingTasks.map((task) => renderTask(task, headingTasks))}
              </div>
            );
          }
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

        {flat ? null : addingSection ? (
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
      {confirmDialog}
    </div>
  );
}
