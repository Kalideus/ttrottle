'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';

interface InviteModalProps {
  onInvite: (email: string, sendEmail: boolean) => Promise<{ ok: boolean; message: string; link?: string }>;
  onClose: () => void;
}

export function InviteModal({ onInvite, onClose }: InviteModalProps) {
  useEscapeToClose(onClose);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'email' | 'link' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string; link?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (sendEmail: boolean) => {
    if (!email.trim()) return;
    setBusy(sendEmail ? 'email' : 'link');
    setResult(null);
    setCopied(false);
    try {
      setResult(await onInvite(email.trim(), sendEmail));
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    if (!result?.link) return;
    // Called straight from this click (no await before it), so the clipboard
    // permission -- which needs a fresh user gesture -- is still valid. Doing
    // this right after the invite fetch resolves loses that gesture and fails
    // silently instead.
    try {
      await navigator.clipboard.writeText(result.link);
      setCopied(true);
    } catch {
      // Clipboard denied -- link is still shown below, select-and-copy works.
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
            Send them an email, or get a link to send yourself (skips corporate email link-scanners that can break the emailed one).
          </span>
        </label>

        {result?.link ? (
          <label className="modal-field">
            <span className="modal-field-label">Invite link</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="modal-input"
                readOnly
                value={result.link}
                onFocus={(e) => e.target.select()}
              />
              <button type="button" className="modal-btn ghost" onClick={copyLink}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </label>
        ) : (
          result && (
            <p className="modal-field-hint" style={result.ok ? undefined : { color: 'var(--danger)' }}>
              {result.message}
            </p>
          )
        )}

        <div className="modal-actions">
          <button className="modal-btn ghost" onClick={() => submit(false)} disabled={!email.trim() || !!busy}>
            {busy === 'link' ? 'Generating…' : 'Get link'}
          </button>
          <button className="modal-btn primary" onClick={() => submit(true)} disabled={!email.trim() || !!busy}>
            {busy === 'email' ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  );
}
