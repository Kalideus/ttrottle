'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { CONTACT_KINDS, type Contact } from '@/lib/supabase/queries';
import { contactMatches, contactTitle, sortContacts, type ContactSort } from '@/lib/contacts';

interface ContactsProps {
  contacts: Contact[];
  /** Every tag in use, for the filter. */
  knownTags: string[];
  loading: boolean;
  /** The contact whose details are showing, if any. */
  openId: string | null;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  /** Whoever added a contact, and site admins, may delete it (the database checks the same). */
  canDelete: (contact: Contact) => boolean;
}

const COLUMNS: { key: ContactSort; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'kind', label: 'Type' },
  { key: 'tags', label: 'Tags' },
  { key: 'updated', label: 'Updated' },
];

const updatedOn = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// The shared contacts list: everyone's staff, suppliers, subcontractors, venues. Search, filter, sort by a
// column heading; a row opens to show how to reach them.
export function Contacts({ contacts, knownTags, loading, openId, onToggle, onAdd, onEdit, onDelete, canDelete }: ContactsProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<{ field: ContactSort; direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });
  const [copied, setCopied] = useState<string | null>(null);

  const shown = useMemo(
    () =>
      sortContacts(
        contacts.filter(
          (c) => (!kind || c.kind === kind) && (!tag || c.tags.includes(tag)) && (contactMatches(c, query) || c.id === openId)
        ),
        sort.field,
        sort.direction
      ),
    [contacts, kind, tag, query, sort, openId]
  );

  // a second click on the same heading flips the order
  const sortBy = (field: ContactSort) =>
    setSort((s) => (s.field === field ? { field, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' }));

  const copy = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
    });
  };

  const filtering = !!(query.trim() || kind || tag);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Contacts</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>Staff, suppliers, subcontractors and venues, shared by everyone.</p>
        </div>
        <button className="inbox-head-btn" onClick={onAdd}>
          <Plus size={15} />
          Add contact
        </button>
      </div>

      <div className="contacts-tools">
        <label className="contacts-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, tag, phone…"
            aria-label="Search contacts"
          />
        </label>
        <select className="modal-input contacts-filter" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {CONTACT_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select className="modal-input contacts-filter" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
          <option value="">All tags</option>
          {knownTags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="contacts-count">{shown.length} of {contacts.length}</span>
      </div>

      <div className="contacts-scroll">
        <div className="contact-grid contacts-head" role="row">
          <span className="contact-disclosure" />
          {COLUMNS.map((col) => (
            <span
              key={col.key}
              role="columnheader"
              className={`col-${col.key}`}
              aria-sort={sort.field === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button
                type="button"
                className={`contacts-sort ${sort.field === col.key ? 'is-on' : ''}`}
                onClick={() => sortBy(col.key)}
                title={`Sort by ${col.label.toLowerCase()}`}
              >
                {col.label}
                {sort.field === col.key && (sort.direction === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
              </button>
            </span>
          ))}
          <span className="col-phone">Phone</span>
        </div>

        {loading && contacts.length === 0 ? (
          <p className="ticket-empty">Loading…</p>
        ) : contacts.length === 0 ? (
          <p className="ticket-empty">No contacts yet. Add the first with &ldquo;Add contact&rdquo;.</p>
        ) : shown.length === 0 ? (
          <p className="ticket-empty">{filtering ? 'No contacts match.' : 'No contacts.'}</p>
        ) : (
          shown.map((c) => {
            const open = c.id === openId;
            return (
              <div key={c.id} className={`ticket ${open ? 'is-open' : ''}`}>
                <div className="contact-grid contact-row" onClick={() => onToggle(c.id)}>
                  <button type="button" className="contact-disclosure" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} ${contactTitle(c)}`}
                    onClick={(e) => { e.stopPropagation(); onToggle(c.id); }}>
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <span className="contact-name-cell">
                    <span className="ticket-name">{contactTitle(c)}</span>
                    {/* the role, or for a company-only entry what it supplies; on a phone the company too */}
                    <span className="contact-sub">
                      {[c.name.trim() && c.company.trim() ? c.company : '', c.role || c.tags.join(', ')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="col-company contact-cell">{c.name.trim() ? c.company : ''}</span>
                  <span className="col-kind contact-cell">{c.kind}</span>
                  <span className="col-tags contact-cell">{c.tags.join(', ')}</span>
                  <span className="col-updated contact-cell">{updatedOn(c.updated_at)}</span>
                  <span className="col-phone contact-cell">
                    {c.phone && (
                      <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()}>{c.phone}</a>
                    )}
                  </span>
                </div>

                {open && (
                  <div className="ticket-body">
                    <dl className="ticket-facts">
                      {c.phone && (
                        <div>
                          <dt>Phone</dt>
                          <dd className="contact-reach">
                            <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}><Phone size={13} /> {c.phone}</a>
                            <button type="button" className="inbox-head-btn" onClick={() => copy(c.phone, `${c.id}-phone`)}>
                              <Copy size={13} /> {copied === `${c.id}-phone` ? 'Copied' : 'Copy'}
                            </button>
                          </dd>
                        </div>
                      )}
                      {c.email && (
                        <div>
                          <dt>Email</dt>
                          <dd className="contact-reach">
                            <a href={`mailto:${c.email}`}><Mail size={13} /> {c.email}</a>
                            <button type="button" className="inbox-head-btn" onClick={() => copy(c.email, `${c.id}-email`)}>
                              <Copy size={13} /> {copied === `${c.id}-email` ? 'Copied' : 'Copy'}
                            </button>
                          </dd>
                        </div>
                      )}
                      {c.company && c.name.trim() && <div><dt>Company</dt><dd>{c.company}</dd></div>}
                      {c.role && <div><dt>Role</dt><dd>{c.role}</dd></div>}
                      <div><dt>Type</dt><dd>{c.kind}</dd></div>
                      <div><dt>Updated</dt><dd>{updatedOn(c.updated_at)}</dd></div>
                    </dl>
                    {c.tags.length > 0 && (
                      <div className="contact-chips">
                        {c.tags.map((s) => (
                          <button key={s} type="button" className="ct-chip" title={`Everyone tagged ${s}`} onClick={() => setTag(s)}>{s}</button>
                        ))}
                      </div>
                    )}
                    {c.notes && <p className="contact-notes">{c.notes}</p>}
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button type="button" className="inbox-head-btn" onClick={() => onEdit(c)}>
                        <Pencil size={14} /> Edit
                      </button>
                      {canDelete(c) && (
                        <button type="button" className="inbox-head-btn" style={{ color: '#D64545' }} onClick={() => onDelete(c)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
