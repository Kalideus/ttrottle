'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { autoGrow } from '@/lib/autoGrow';
import { formatKeyDown } from '@/components/FormatToolbar';
import type { Heading, ProjectMember, Tag } from '@/lib/supabase/queries';
import { PeoplePicker, MemberAvatar } from '@/components/PeoplePicker';

export interface NewTaskInput {
  name: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  heading_id: string | null;
  new_heading: string | null;
  tag_ids: string[];
  follower_ids: string[];
  subtasks: string[];
  comment: string | null;
}

const NEW_HEADING = '__new__';

interface CreateTaskModalProps {
  members: ProjectMember[];
  headings: Heading[];
  tags: Tag[];
  onCreateTag: (name: string) => Promise<Tag | null>;
  onCreate: (task: NewTaskInput) => Promise<void>;
  onClose: () => void;
}

const matches = (text: string, q: string) => text.toLowerCase().includes(q.trim().toLowerCase());
const memberName = (m: ProjectMember) => m.profile?.name ?? m.email;

const PRIORITIES = [
  { value: null, label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

export function CreateTaskModal({ members, headings, tags, onCreateTag, onCreate, onClose }: CreateTaskModalProps) {
  useEscapeToClose(onClose);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<NewTaskInput['priority']>(null);
  const [headingId, setHeadingId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [newHeading, setNewHeading] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const [tagQuery, setTagQuery] = useState('');
  const [personQuery, setPersonQuery] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  const people = members.filter((m) => m.profile_id);

  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const assignee = people.find((m) => m.profile_id === assigneeId);

  // Selected items always stay visible; the search narrows the rest.
  const visibleTags = tags.filter((t) => tagIds.includes(t.id) || matches(t.name, tagQuery));
  const exactTag = tags.find((t) => t.name.toLowerCase() === tagQuery.trim().toLowerCase());
  const visiblePeople = people.filter(
    (m) => followerIds.includes(m.profile_id!) || matches(`${m.profile?.name ?? ''} ${m.email}`, personQuery)
  );

  const selectTag = (id: string) => {
    if (!tagIds.includes(id)) setTagIds([...tagIds, id]);
    setTagQuery('');
  };

  const handleNewTag = async () => {
    const tagName = tagQuery.trim();
    if (!tagName || creatingTag) return;
    setCreatingTag(true);
    try {
      const tag = await onCreateTag(tagName);
      if (tag) {
        setTagIds((prev) => [...prev, tag.id]);
        setTagQuery('');
      }
    } finally {
      setCreatingTag(false);
    }
  };

  const addSubtask = () => {
    if (!subtaskDraft.trim()) return;
    setSubtasks([...subtasks, subtaskDraft.trim()]);
    setSubtaskDraft('');
  };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        priority,
        heading_id: headingId && headingId !== NEW_HEADING ? headingId : null,
        new_heading: headingId === NEW_HEADING && newHeading.trim() ? newHeading.trim() : null,
        tag_ids: tagIds,
        follower_ids: followerIds,
        // a subtask typed but not yet added with Enter still counts
        subtasks: subtaskDraft.trim() ? [...subtasks, subtaskDraft.trim()] : subtasks,
        comment: comment.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card ct-card" onClick={(e) => e.stopPropagation()}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleCreate();
            }
          }}
        >
          <div className="ct-head">
            <span className="ct-eyebrow">New task</span>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <input
            className="ct-title"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Task name"
            aria-label="Task name"
            autoFocus
          />
          <textarea
            className="ct-notes"
            ref={autoGrow}
            onInput={(e) => autoGrow(e.currentTarget)}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={formatKeyDown}
            placeholder="Add a description…"
            aria-label="Description"
            rows={3}
          />

          <div className="ct-props">
            <div className="ct-row">
              <span className="ct-label">Assignee</span>
              <div className="ct-picker">
                <button
                  type="button"
                  className="ct-control ct-picker-btn"
                  aria-haspopup="listbox"
                  aria-expanded={assigneeOpen}
                  onClick={() => setAssigneeOpen(!assigneeOpen)}
                >
                  {assignee ? (
                    <>
                      <MemberAvatar member={assignee} />
                      {memberName(assignee)}
                    </>
                  ) : (
                    <span className="ct-muted">Unassigned</span>
                  )}
                </button>

                {assigneeOpen && (
                  <PeoplePicker
                    people={people}
                    selectedId={assigneeId || null}
                    allowNone
                    onPick={(id) => {
                      setAssigneeId(id ?? '');
                      setAssigneeOpen(false);
                    }}
                    onClose={() => setAssigneeOpen(false)}
                  />
                )}
              </div>
            </div>

            <label className="ct-row">
              <span className="ct-label">Due date</span>
              <input className="ct-control" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>

            <div className="ct-row">
              <span className="ct-label">Priority</span>
              <div className="ct-segmented" role="radiogroup" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    role="radio"
                    aria-checked={priority === p.value}
                    className={priority === p.value ? 'is-on' : ''}
                    onClick={() => setPriority(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ct-row">
              <span className="ct-label">Heading</span>
              <div className="ct-inline">
                <select
                  className="ct-control"
                  aria-label="Heading"
                  value={headingId}
                  onChange={(e) => setHeadingId(e.target.value)}
                >
                  <option value="">No heading</option>
                  {headings.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                  <option value={NEW_HEADING}>New heading…</option>
                </select>
                {headingId === NEW_HEADING && (
                  <input
                    className="ct-control"
                    aria-label="New heading name"
                    placeholder="Heading name"
                    value={newHeading}
                    onChange={(e) => setNewHeading(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            </div>

            <div className="ct-row ct-row-top">
              <span className="ct-label">Tags</span>
              <div className="ct-list">
                <input
                  className="ct-control ct-full"
                  aria-label="Search or create tag"
                  placeholder="Search or create a tag"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return;
                    e.preventDefault();
                    if (exactTag) selectTag(exactTag.id);
                    else if (tagQuery.trim()) handleNewTag();
                  }}
                />
                <div className="ct-chips">
                  {visibleTags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={tagIds.includes(t.id)}
                      className={`ct-chip ${tagIds.includes(t.id) ? 'is-on' : ''}`}
                      style={{ '--chip': t.color } as React.CSSProperties}
                      onClick={() => setTagIds(toggle(tagIds, t.id))}
                    >
                      <span className="ct-chip-dot" />
                      {t.name}
                    </button>
                  ))}
                  {tagQuery.trim() && !exactTag && (
                    <button type="button" className="ct-chip ct-chip-add" onClick={handleNewTag} disabled={creatingTag}>
                      + Create “{tagQuery.trim()}”
                    </button>
                  )}
                </div>
              </div>
            </div>

            {people.length > 0 && (
              <div className="ct-row ct-row-top">
                <span className="ct-label">Followers</span>
                <div className="ct-list">
                <input
                  className="ct-control ct-full"
                  aria-label="Search people"
                  placeholder="Search people"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return;
                    e.preventDefault();
                    const first = visiblePeople.find((m) => !followerIds.includes(m.profile_id!));
                    if (first) {
                      setFollowerIds([...followerIds, first.profile_id!]);
                      setPersonQuery('');
                    }
                  }}
                />
                <div className="ct-chips">
                  {visiblePeople.map((m) => (
                    <button
                      key={m.profile_id!}
                      type="button"
                      aria-pressed={followerIds.includes(m.profile_id!)}
                      className={`ct-chip ${followerIds.includes(m.profile_id!) ? 'is-on' : ''}`}
                      onClick={() => setFollowerIds(toggle(followerIds, m.profile_id!))}
                    >
                      {m.profile?.name ?? m.email}
                    </button>
                  ))}
                  {personQuery.trim() && visiblePeople.length === 0 && <span className="ct-empty">No one matches</span>}
                </div>
                </div>
              </div>
            )}

            <div className="ct-row ct-row-top">
              <span className="ct-label">Subtasks</span>
              <div className="ct-list">
                {subtasks.map((s, i) => (
                  <div key={i} className="ct-list-item">
                    <span className="ct-check" aria-hidden />
                    <span className="ct-list-text">{s}</span>
                    <button
                      type="button"
                      className="ct-remove"
                      aria-label={`Remove subtask ${s}`}
                      onClick={() => setSubtasks(subtasks.filter((_, j) => j !== i))}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <input
                  className="ct-control ct-full"
                  aria-label="Add subtask"
                  placeholder="Add a subtask and press Enter"
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                />
              </div>
            </div>

            <label className="ct-row ct-row-top">
              <span className="ct-label">Comment</span>
              <textarea
                className="ct-control ct-full ct-textarea"
                placeholder="Add a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
            </label>
          </div>

          <div className="ct-actions">
            <span className="ct-hint">⌘ Enter to create</span>
            <button type="button" className="modal-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="modal-btn primary" disabled={saving || !name.trim()}>
              {saving ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
