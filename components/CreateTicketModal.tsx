'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import type { TicketProject } from '@/lib/supabase/queries';

export type NewTicketInput = { project_id: string; name: string; description: string; due_date: string | null };

interface CreateTicketModalProps {
  // null while the list of teams is still loading
  teams: TicketProject[] | null;
  // resolves to an error message, or null once the ticket is sent
  onCreate: (ticket: NewTicketInput) => Promise<string | null>;
  onClose: () => void;
}

// A request to another team (Marketing, Tech, Facilities...). It lands in that team's project
// for their managers to hand out; the sender follows it from My tickets.
export function CreateTicketModal({ teams, onCreate, onClose }: CreateTicketModalProps) {
  useEscapeToClose(onClose);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // with one team there is nothing to choose
  const team = projectId || (teams?.length === 1 ? teams[0].id : '');

  const submit = async () => {
    if (!team || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const failed = await onCreate({ project_id: team, name: name.trim(), description: description.trim(), due_date: dueDate || null });
    setBusy(false);
    if (failed) setError(failed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Create ticket</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {teams?.length === 0 ? (
          <p className="modal-field-hint">
            No team is taking tickets yet. A project manager can turn it on from their project&rsquo;s menu (&ldquo;Accept tickets&rdquo;).
          </p>
        ) : (
          <>
            <label className="modal-field">
              <span className="modal-field-label">Send to</span>
              <select className="modal-input" value={team} onChange={(e) => setProjectId(e.target.value)} disabled={!teams}>
                <option value="">{teams ? 'Choose a team…' : 'Loading…'}</option>
                {(teams ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                ))}
              </select>
            </label>

            <label className="modal-field">
              <span className="modal-field-label">What do you need?</span>
              <input
                className="modal-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. New banner for the Colombo event"
                autoFocus
              />
            </label>

            <label className="modal-field">
              <span className="modal-field-label">Details</span>
              <textarea
                className="modal-input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Anything the team needs to know to get started"
                style={{ height: 'auto', padding: '10px 12px', resize: 'vertical' }}
              />
            </label>

            <label className="modal-field">
              <span className="modal-field-label">Needed by (optional)</span>
              <input className="modal-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <span className="modal-field-hint">The team&rsquo;s manager will confirm the date and who picks it up.</span>
            </label>

            {error && <p className="modal-field-hint" style={{ color: '#D64545' }}>{error}</p>}

            <div className="modal-actions">
              <button className="modal-btn ghost" onClick={onClose}>Cancel</button>
              <button className="modal-btn primary" onClick={submit} disabled={!team || !name.trim() || busy}>
                {busy ? 'Sending…' : 'Send ticket'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
