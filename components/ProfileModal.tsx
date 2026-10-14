'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { avatarInitials, avatarStyle, AVATAR_COLORS, DEFAULT_AVATAR_COLOR } from '@/lib/avatar';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { playChime, setSoundOn, setSoundVolume, soundOn, soundVolume } from '@/lib/notifySound';
import type { Profile } from '@/lib/supabase/queries';

interface ProfileModalProps {
  profile: Profile;
  onSave: (updates: { name: string; initials: string; avatar_color: string; avatar_url: string | null }) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<string>;
  onClose: () => void;
  // No X/Cancel/backdrop-dismiss, and Save is disabled until a first + last
  // name is entered -- used to make new/invited users set a real name
  // instead of the email-derived default.
  requireFullName?: boolean;
}

export function ProfileModal({ profile, onSave, onUploadPhoto, onClose, requireFullName = false }: ProfileModalProps) {
  const [name, setName] = useState(profile.name ?? '');
  const [color, setColor] = useState(profile.avatar_color ?? DEFAULT_AVATAR_COLOR);
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sound, setSound] = useState(soundOn);
  const [volume, setVolume] = useState(soundVolume);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError('');
    setUploading(true);
    try {
      setPhotoUrl(await onUploadPhoto(file));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const initials = avatarInitials(name, profile.email);
  const hasFullName = name.trim().includes(' ');
  const canSave = requireFullName ? hasFullName : true;

  useEscapeToClose(onClose, !requireFullName);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), initials, avatar_color: color, avatar_url: photoUrl });
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
          <div className="profile-avatar-lg" style={avatarStyle(photoUrl, color)}>{initials}</div>
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
          <span className="modal-field-label">Photo</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label className="modal-btn ghost" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              {uploading ? 'Uploading…' : photoUrl ? 'Change photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={uploading}
                onChange={(e) => {
                  pickPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {photoUrl && (
              <button type="button" className="modal-btn ghost" onClick={() => setPhotoUrl(null)} disabled={uploading}>
                Remove
              </button>
            )}
          </div>
          <span className="modal-field-hint">
            {photoError || 'Optional. Shown instead of your initials; the colour is used if you remove it.'}
          </span>
        </div>

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

        <div className="modal-field">
          <span className="modal-field-label">Notification sound</span>
          {/* applies straight away, not on Save: it's kept in this browser, not the profile */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => {
                setSound(e.target.checked);
                setSoundOn(e.target.checked);
                if (e.target.checked) playChime(true); // let them hear it
              }}
            />
            Play a sound when a notification comes in
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', opacity: sound ? 1 : 0.5 }}>
            <span style={{ flexShrink: 0 }}>Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              disabled={!sound}
              aria-label="Notification volume"
              aria-valuetext={`${volume}%`}
              style={{ flex: 1 }}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setSoundVolume(Number(e.target.value));
              }}
              // a sample at the new level once it's let go (mouse, touch or arrow keys), not on every step of a drag
              onPointerUp={() => playChime(true)}
              onKeyUp={() => playChime(true)}
            />
            <span style={{ width: '36px', textAlign: 'right', color: 'var(--text-muted)' }}>{volume}%</span>
          </label>
          <span className="modal-field-hint">Works while TRack is open in a tab, even one you&rsquo;re not looking at. Saved on this computer.</span>
        </div>

        <div className="modal-actions">
          {!requireFullName && (
            <button className="modal-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          )}
          <button className="modal-btn primary" onClick={handleSave} disabled={saving || uploading || !canSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
