'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { CONTACT_KINDS, type Contact, type ContactFields, type Department } from '@/lib/supabase/queries';

interface ContactModalProps {
  /** Left out to add a new contact. */
  contact?: Contact;
  departments: Department[];
  /** Every service already used, offered while typing a new one. */
  knownServices: string[];
  // resolves to an error message, or null once saved
  onSave: (fields: ContactFields) => Promise<string | null>;
  onClose: () => void;
}

// Add or edit one contact: a person, or a company with nobody named.
export function ContactModal({ contact, departments, knownServices, onSave, onClose }: ContactModalProps) {
  useEscapeToClose(onClose);
  const [f, setF] = useState<ContactFields>(() => ({
    kind: contact?.kind ?? 'Supplier',
    name: contact?.name ?? '',
    company: contact?.company ?? '',
    role: contact?.role ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    services: contact?.services ?? [],
    department_ids: contact?.department_ids ?? [],
    notes: contact?.notes ?? '',
  }));
  const set = <K extends keyof ContactFields>(key: K, value: ContactFields[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const [serviceDraft, setServiceDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staff = f.kind === 'Staff';
  const canSave = !!(f.name.trim() || (!staff && f.company.trim()));

  // Enter or a comma turns what's typed into a service chip; the same service twice is ignored
  const addService = (raw: string) => {
    const s = raw.trim().replace(/,$/, '').trim();
    if (s && !f.services.some((x) => x.toLowerCase() === s.toLowerCase())) set('services', [...f.services, s]);
    setServiceDraft('');
  };

  const submit = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    const services = serviceDraft.trim() ? [...f.services, serviceDraft.trim()] : f.services;
    const trimmed = (s: string) => s.trim();
    const failed = await onSave({
      ...f,
      name: trimmed(f.name),
      company: staff ? '' : trimmed(f.company),
      role: trimmed(f.role),
      phone: trimmed(f.phone),
      email: trimmed(f.email),
      notes: f.notes.trim(),
      services,
    });
    setBusy(false);
    if (failed) setError(failed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{contact ? 'Edit contact' : 'Add contact'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="modal-field">
          <span className="modal-field-label">Type</span>
          <select className="modal-input" value={f.kind} onChange={(e) => set('kind', e.target.value as ContactFields['kind'])}>
            {CONTACT_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>

        <label className="modal-field">
          <span className="modal-field-label">Name</span>
          <input className="modal-input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sokha Chan" autoFocus />
          {!staff && <span className="modal-field-hint">Leave blank for a company with no one named yet.</span>}
        </label>

        {!staff && (
          <label className="modal-field">
            <span className="modal-field-label">Company</span>
            <input className="modal-input" value={f.company} onChange={(e) => set('company', e.target.value)} placeholder="e.g. Phnom Penh Print Co." />
          </label>
        )}

        <label className="modal-field">
          <span className="modal-field-label">{staff ? 'Role' : 'Role / what they do'}</span>
          <input
            className="modal-input"
            value={f.role}
            onChange={(e) => set('role', e.target.value)}
            placeholder={staff ? 'e.g. Fleet supervisor' : 'e.g. Account manager'}
          />
        </label>

        <div className="contact-form-pair">
          <label className="modal-field">
            <span className="modal-field-label">Phone</span>
            <input className="modal-input" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+855 12 345 678" />
          </label>
          <label className="modal-field">
            <span className="modal-field-label">Email</span>
            <input className="modal-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          </label>
        </div>

        {!staff && (
          <div className="modal-field">
            <span className="modal-field-label" id="contact-services">Services</span>
            <div className="contact-chips">
              {f.services.map((s) => (
                <span key={s} className="ct-chip is-on">
                  {s}
                  <button
                    type="button"
                    aria-label={`Remove ${s}`}
                    onClick={() => set('services', f.services.filter((x) => x !== s))}
                    style={{ border: 'none', background: 'none', padding: 0, color: 'inherit', cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                className="contact-chip-input"
                aria-labelledby="contact-services"
                list="contact-known-services"
                value={serviceDraft}
                placeholder={f.services.length ? 'Add another…' : 'e.g. Printing, then Enter'}
                onChange={(e) => (e.target.value.endsWith(',') ? addService(e.target.value) : setServiceDraft(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addService(serviceDraft);
                  } else if (e.key === 'Backspace' && !serviceDraft && f.services.length) {
                    set('services', f.services.slice(0, -1));
                  }
                }}
                onBlur={() => serviceDraft.trim() && addService(serviceDraft)}
              />
              <datalist id="contact-known-services">
                {knownServices.filter((s) => !f.services.includes(s)).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <span className="modal-field-hint">What they supply or do, so a search for it finds them.</span>
          </div>
        )}

        <div className="modal-field">
          <span className="modal-field-label">{staff ? 'Department' : 'Departments that use them'}</span>
          <div className="contact-chips">
            {departments.map((d) => {
              const on = f.department_ids.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  className={`ct-chip ${on ? 'is-on' : ''}`}
                  onClick={() => set('department_ids', on ? f.department_ids.filter((id) => id !== d.id) : [...f.department_ids, d.id])}
                >
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>

        <label className="modal-field">
          <span className="modal-field-label">Notes</span>
          <textarea
            className="modal-input"
            rows={3}
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="e.g. Needs 5 days' notice; invoices to finance@"
            style={{ height: 'auto', padding: '10px 12px', resize: 'vertical' }}
          />
        </label>

        {error && <p className="modal-field-hint" style={{ color: '#D64545' }}>{error}</p>}

        <div className="modal-actions">
          <button className="modal-btn ghost" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" onClick={submit} disabled={!canSave || busy}>
            {busy ? 'Saving…' : contact ? 'Save' : 'Add contact'}
          </button>
        </div>
      </div>
    </div>
  );
}
