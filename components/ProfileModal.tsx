'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { avatarInitials, AVATAR_COLORS, DEFAULT_AVATAR_COLOR } from '@/lib/avatar';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import type { Profile } from '@/lib/supabase/queries';

interface ProfileModalProps {
  profile: Profile;
  onSave: (updates: { name: string; initials: string; avatar_color: string }) => Promise<void>;
  onClose: () => void;
  // No X/Cancel/backdrop-dismiss, and Save is disabled until a first + last
  // name is entered -- used to make new/invited users set a real name
  // instead of the email-derived default.
  requireFullName?: boolean;
}

export function ProfileModal({ profile, onSave, onClose, requireFullName = false }: ProfileModalProps) {
  const [name, setName] = useState(profile.name ?? '');
  const [color, setColor] = useState(profile.avatar_color ?? DEFAULT_AVATAR_COLOR);
  const [saving, setSaving] = useState(false);

  const initials = avatarInitials(name, profile.email);
  const hasFullName = name.trim().includes(' ');
  const canSave = requireFullName ? hasFullName : true;

  useEscapeToClose(onClose, !requireFullName);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), initials, avatar_color: color });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={requireFullName ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Profile</h2>
          {!requireFullName && (
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>

        {requireFullName && (
          <p className="modal-field-hint" style={{ marginTop: '-8px' }}>
            Enter your first and last name so teammates can tell who&rsquo;s who.
          </p>
        )}

        <div className="profile-preview">
          <div className="profile-avatar-lg" style={{ background: color }}>{initials}</div>
          <div>
            <div className="profile-preview-name">{name.trim() || 'Your name'}</div>
            <div className="profile-preview-email">{profile.email}</div>
          </div>
        </div>

        <label className="modal-field">
          <span className="modal-field-label">Full name</span>
          <input
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First Last"
            autoFocus
          />
          <span className="modal-field-hint">
            {requireFullName && !hasFullName
              ? 'Enter a first and last name (e.g. "Jamie Lee").'
              : `Your avatar shows the first and last initial (${initials}).`}
          </span>
        </label>

        <div className="modal-field">
          <span className="modal-field-label">Avatar colour</span>
          <div className="swatch-grid">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${c === color ? 'is-selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Use ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="modal-actions">
          {!requireFullName && (
            <button className="modal-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          )}
          <button className="modal-btn primary" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
