'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';

interface ChangePasswordModalProps {
  /** Resolves to why it couldn't be changed, or null once it has. */
  onSave: (password: string) => Promise<string | null>;
  onClose: () => void;
}

// A new password for whoever is signed in. Typed twice, hidden unless "Show" is ticked.
// (The current one can't be shown to anyone: only a scrambled form of it is stored.)
export function ChangePasswordModal({ onSave, onClose }: ChangePasswordModalProps) {
  useEscapeToClose(onClose);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const problem = password.length < 6 ? 'At least 6 characters.' : password !== again ? 'The two passwords don’t match yet.' : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem || busy) return;
    setBusy(true);
    setError(null);
    const failed = await onSave(password);
    setBusy(false);
    if (failed) setError(failed);
    else setDone(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head">
          <h2 className="modal-title">Change password</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <>
            <p className="modal-message" role="status">Password updated. Use it the next time you sign in.</p>
            <div className="modal-actions">
              <button type="button" className="modal-btn primary" onClick={onClose} autoFocus>Done</button>
            </div>
          </>
        ) : (
          <>
            <label className="modal-field">
              <span className="modal-field-label">New password</span>
              <input className="modal-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </label>
            <label className="modal-field">
              <span className="modal-field-label">Type it again</span>
              <input className="modal-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
              {(password || again) && problem && <span className="modal-field-hint">{problem}</span>}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show what I&rsquo;m typing
            </label>

            {error && <p className="modal-field-hint" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

            <div className="modal-actions">
              <button type="button" className="modal-btn ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="modal-btn primary" disabled={!!problem || busy}>
                {busy ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
