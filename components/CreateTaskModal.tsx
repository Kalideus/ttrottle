'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { ProjectMember, Heading } from '@/lib/supabase/queries';

interface CreateTaskModalProps {
  projectMembers: ProjectMember[];
  headings: Heading[];
  onCreate: (task: { name: string; assignee_id: string | null; due_date: string | null; description: string | null; heading_id: string | null; follower_ids: string[] }) => Promise<void>;
  onClose: () => void;
}

export function CreateTaskModal({ projectMembers, headings, onCreate, onClose }: CreateTaskModalProps) {
  const [name, setName] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [headingId, setHeadingId] = useState('');
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleFollower = (profileId: string) => {
    setFollowerIds((prev) => (prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        assignee_id: assigneeId || null,
        due_date: dueDate || null,
        description: description.trim() || null,
        heading_id: headingId || null,
        follower_ids: followerIds,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '10px',
          padding: '24px',
          width: '440px',
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text)' }}>New task</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Name</span>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Task name"
            required
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Assignee</span>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)' }}
          >
            <option value="">Unassigned</option>
            {projectMembers.filter((m) => m.profile_id).map((m) => (
              <option key={m.profile_id} value={m.profile_id!}>
                {m.profile?.name ?? m.email}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Heading</span>
          <select
            value={headingId}
            onChange={(e) => setHeadingId(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)' }}
          >
            <option value="">No heading</option>
            {headings.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Followers</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px' }}>
            {projectMembers.filter((m) => m.profile_id).length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 8px' }}>No members yet.</span>
            )}
            {projectMembers.filter((m) => m.profile_id).map((m) => (
              <label
                key={m.profile_id}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}
              >
                <input
                  type="checkbox"
                  checked={followerIds.includes(m.profile_id!)}
                  onChange={() => toggleFollower(m.profile_id!)}
                  style={{ cursor: 'pointer' }}
                />
                {m.profile?.name ?? m.email}
              </label>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)' }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs doing?"
            rows={4}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 14px', borderRadius: '6px', background: 'rgba(214, 69, 69, 0.1)', color: '#D64545', border: '1px solid rgba(214, 69, 69, 0.3)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Trash2 size={14} />
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
              opacity: name.trim() ? 1 : 0.5,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {isSubmitting ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </form>
    </div>
  );
}
