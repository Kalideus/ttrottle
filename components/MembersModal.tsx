'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { avatarStyle } from '@/lib/avatar';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import type { Profile, ProjectMember } from '@/lib/supabase/queries';

interface MembersModalProps {
  projectName: string;
  members: ProjectMember[];
  people: Profile[]; // everyone in the workspace
  currentUserId: string | null;
  isPrivate: boolean;
  onAdd: (profile: Profile) => Promise<void>;
  onRemove: (member: ProjectMember) => Promise<void>;
  onClose: () => void;
}

const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const;

function Avatar({ url, color, initials }: { url?: string | null; color?: string | null; initials: string }) {
  return (
    <span className="mm-avatar" style={avatarStyle(url, color)} aria-hidden>
      {initials}
    </span>
  );
}

export function MembersModal({ projectName, members, people, currentUserId, isPrivate, onAdd, onRemove, onClose }: MembersModalProps) {
  useEscapeToClose(onClose);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const myRole = members.find((m) => m.profile_id === currentUserId)?.role;
  const canManage = !isPrivate && (myRole === 'owner' || myRole === 'admin');

  const memberIds = new Set(members.map((m) => m.profile_id));
  const q = query.trim().toLowerCase();
  const addable = people.filter(
    (p) => !memberIds.has(p.id) && (!q || `${p.name} ${p.email}`.toLowerCase().includes(q))
  );

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card mm-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Members · {projectName}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="mm-section-label">In this project ({members.length})</div>
        <ul className="mm-list">
          {members.map((m) => (
            <li key={m.email} className="mm-row">
              <Avatar
                url={m.profile?.avatar_url}
                color={m.profile?.avatar_color}
                initials={m.profile?.initials ?? m.email.slice(0, 2).toUpperCase()}
              />
              <div className="mm-who">
                <span className="mm-name">
                  {m.profile?.name ?? m.email}
                  {m.profile_id === currentUserId && <span className="mm-you"> (you)</span>}
                </span>
                <span className="mm-email">{m.profile_id ? m.email : `${m.email} · invite pending`}</span>
              </div>
              <span className="mm-role">{ROLE_LABEL[m.role]}</span>
              {canManage && m.role !== 'owner' && m.profile_id !== currentUserId && (
                <button
                  type="button"
                  className="mm-btn"
                  disabled={busy !== null}
                  onClick={() => run(m.email, () => onRemove(m))}
                  aria-label={`Remove ${m.profile?.name ?? m.email}`}
                >
                  {busy === m.email ? '…' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>

        {isPrivate && <p className="modal-field-hint">This is your private project, so only you can be in it.</p>}

        {canManage && (
          <>
            <div className="mm-section-label" style={{ marginTop: 18 }}>Add from your team</div>
            <input
              className="modal-input"
              placeholder="Search everyone by name or email"
              aria-label="Search team"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ul className="mm-list mm-list-scroll">
              {addable.map((p) => (
                <li key={p.id} className="mm-row">
                  <Avatar url={p.avatar_url} color={p.avatar_color} initials={p.initials} />
                  <div className="mm-who">
                    <span className="mm-name">{p.name}</span>
                    <span className="mm-email">{p.email}</span>
                  </div>
                  <button
                    type="button"
                    className="mm-btn mm-btn-add"
                    disabled={busy !== null}
                    onClick={() => run(p.id, () => onAdd(p))}
                  >
                    {busy === p.id ? '…' : 'Add'}
                  </button>
                </li>
              ))}
              {addable.length === 0 && (
                <li className="mm-empty">
                  {q ? 'No one matches. Use Invite to add someone new by email.' : 'Everyone on the team is already in this project.'}
                </li>
              )}
            </ul>
          </>
        )}

        {!canManage && !isPrivate && (
          <p className="modal-field-hint">Only this project&rsquo;s owner or admins can add or remove people.</p>
        )}
      </div>
    </div>
  );
}
