'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import type { Heading, ProjectMember, Tag } from '@/lib/supabase/queries';

export interface NewTaskInput {
  name: string;
  description: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  heading_id: string | null;
  tag_ids: string[];
  follower_ids: string[];
}

interface CreateTaskModalProps {
  members: ProjectMember[];
  headings: Heading[];
  tags: Tag[];
  isPrivate?: boolean;
  onCreate: (task: NewTaskInput) => Promise<void>;
  onClose: () => void;
}

const PRIORITIES = [
  { value: null, label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

export function CreateTaskModal({ members, headings, tags, isPrivate = false, onCreate, onClose }: CreateTaskModalProps) {
  useEscapeToClose(onClose);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<NewTaskInput['priority']>(null);
  const [headingId, setHeadingId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const people = members.filter((m) => m.profile_id);
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
        heading_id: headingId || null,
        tag_ids: tagIds,
        follower_ids: followerIds,
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes…"
            aria-label="Description"
            rows={3}
          />

          <div className="ct-props">
            <label className="ct-row">
              <span className="ct-label">Assignee</span>
              <select className="ct-control" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {people.map((m) => (
                  <option key={m.profile_id!} value={m.profile_id!}>{m.profile?.name ?? m.email}</option>
                ))}
              </select>
            </label>

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

            {headings.length > 0 && (
              <label className="ct-row">
                <span className="ct-label">Section</span>
                <select className="ct-control" value={headingId} onChange={(e) => setHeadingId(e.target.value)}>
                  <option value="">No section</option>
                  {headings.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </label>
            )}

            {tags.length > 0 && (
              <div className="ct-row ct-row-top">
                <span className="ct-label">Tags</span>
                <div className="ct-chips">
                  {tags.map((t) => (
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
                </div>
              </div>
            )}

            {/* ponytail: private projects have only you as a member, so nobody to follow */}
            {!isPrivate && people.length > 0 && (
              <div className="ct-row ct-row-top">
                <span className="ct-label">Followers</span>
                <div className="ct-chips">
                  {people.map((m) => (
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
                </div>
              </div>
            )}
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
