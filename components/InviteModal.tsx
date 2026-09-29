'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface InviteModalProps {
  onInvite: (email: string, sendEmail: boolean) => Promise<{ ok: boolean; message: string }>;
  onClose: () => void;
}

export function InviteModal({ onInvite, onClose }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'email' | 'link' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const submit = async (sendEmail: boolean) => {
    if (!email.trim()) return;
    setBusy(sendEmail ? 'email' : 'link');
    setResult(null);
    try {
      setResult(await onInvite(email.trim(), sendEmail));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Invite to project</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="modal-field">
          <span className="modal-field-label">Email</span>
          <input
            className="modal-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoFocus
          />
          <span className="modal-field-hint">
            Send them an email, or copy a link to send yourself (skips corporate email link-scanners that can break the emailed one).
          </span>
        </label>

        {result && (
          <p className="modal-field-hint" style={result.ok ? undefined : { color: 'var(--danger)' }}>
            {result.message}
          </p>
        )}

        <div className="modal-actions">
          <button className="modal-btn ghost" onClick={() => submit(false)} disabled={!email.trim() || !!busy}>
            {busy === 'link' ? 'Copying…' : 'Copy link'}
          </button>
          <button className="modal-btn primary" onClick={() => submit(true)} disabled={!email.trim() || !!busy}>
            {busy === 'email' ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  );
}
