'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Mail, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { CONTACT_KINDS, type Contact, type Department } from '@/lib/supabase/queries';
import { contactMatches, contactTitle, sortContacts, type ContactSort } from '@/lib/contacts';

interface ContactsProps {
  contacts: Contact[];
  departments: Department[];
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
  { key: 'department', label: 'Department' },
];

// The shared contacts list: everyone's staff, suppliers, subcontractors, venues. Search, filter, sort by a
// column heading; a row opens to show how to reach them.
export function Contacts({ contacts, departments, loading, openId, onToggle, onAdd, onEdit, onDelete, canDelete }: ContactsProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [dept, setDept] = useState('');
  const [sort, setSort] = useState<{ field: ContactSort; direction: 'asc' | 'desc' }>({ field: 'name', direction: 'asc' });
  const [copied, setCopied] = useState<string | null>(null);

  const deptName = useMemo(() => {
    const byId = new Map(departments.map((d) => [d.id, d.name]));
    return (id: string) => byId.get(id);
  }, [departments]);

  const shown = useMemo(
    () =>
      sortContacts(
        contacts.filter(
          (c) => (!kind || c.kind === kind) && (!dept || c.department_ids.includes(dept)) && (contactMatches(c, query, deptName) || c.id === openId)
        ),
        sort.field,
        sort.direction,
        deptName
      ),
    [contacts, kind, dept, query, sort, deptName, openId]
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

  const filtering = !!(query.trim() || kind || dept);

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
            placeholder="Search name, company, service, phone…"
            aria-label="Search contacts"
          />
        </label>
        <select className="modal-input contacts-filter" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {CONTACT_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select className="modal-input contacts-filter" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
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
            const depts = c.department_ids.map(deptName).filter(Boolean) as string[];
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
                      {[c.name.trim() && c.company.trim() ? c.company : '', c.role || c.services.join(', ')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="col-company contact-cell">{c.name.trim() ? c.company : ''}</span>
                  <span className="col-kind contact-cell">{c.kind}</span>
                  <span className="col-department contact-cell">{depts.join(', ')}</span>
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
                      {depts.length > 0 && <div><dt>{c.kind === 'Staff' ? 'Department' : 'Departments'}</dt><dd>{depts.join(', ')}</dd></div>}
                    </dl>
                    {c.services.length > 0 && (
                      <div className="contact-chips">
                        {c.services.map((s) => (
                          <button key={s} type="button" className="ct-chip" title={`Everyone who does ${s}`} onClick={() => setQuery(s)}>{s}</button>
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
