'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { avatarInitials, AVATAR_COLORS, DEFAULT_AVATAR_COLOR } from '@/lib/avatar';
import type { Profile } from '@/lib/supabase/queries';

interface ProfileModalProps {
  profile: Profile;
  onSave: (updates: { name: string; initials: string; avatar_color: string }) => Promise<void>;
  onClose: () => void;
}

export function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [name, setName] = useState(profile.name ?? '');
  const [color, setColor] = useState(profile.avatar_color ?? DEFAULT_AVATAR_COLOR);
  const [saving, setSaving] = useState(false);

  const initials = avatarInitials(name, profile.email);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim(), initials, avatar_color: color });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Profile</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

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
          <span className="modal-field-hint">Your avatar shows the first and last initial ({initials}).</span>
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
          <button className="modal-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="modal-btn primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
