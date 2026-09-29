'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';

interface CreateTaskModalProps {
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}

export function CreateTaskModal({ onCreate, onClose }: CreateTaskModalProps) {
  useEscapeToClose(onClose);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate(name.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Create task</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <label className="modal-field">
            <span className="modal-field-label">Task name</span>
            <input
              className="modal-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What needs doing?"
              autoFocus
            />
            <span className="modal-field-hint">You can add a description, assignee, due date and more after creating it.</span>
          </label>

          <div className="modal-actions">
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
