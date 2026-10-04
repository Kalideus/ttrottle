'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { IMPORT_FIELDS, EXAMPLE_CSV, parseCsv, guessMapping, buildPlan, type DateFormat, type Mapping, type ProjectPlan } from '@/lib/csvImport';
import type { Profile } from '@/lib/supabase/queries';

const count = (plan: Pick<ProjectPlan, 'tasks'>) => plan.tasks.reduce((n, t) => n + 1 + (t.subtasks?.length ?? 0), 0);

interface ImportProps {
  people: Profile[];
  onImport: (name: string, plan: ProjectPlan) => Promise<void>;
  onClose: () => void;
}

export function ProjectImportModal({ people, onImport, onClose }: ImportProps) {
  useEscapeToClose(onClose);
  const [name, setName] = useState('');
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [dateFormat, setDateFormat] = useState<DateFormat>('dmy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const headers = rows?.[0] ?? [];
  const plan = useMemo(
    () => (rows && mapping ? buildPlan(rows.slice(1), mapping, people, dateFormat) : null),
    [rows, mapping, people, dateFormat]
  );

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      setError('That file has no rows under the header. Save it from Excel as "CSV UTF-8".');
      return;
    }
    setRows(parsed);
    setMapping(guessMapping(parsed[0]));
    if (!name) setName(file.name.replace(/\.csv$/i, ''));
  };

  const submit = async () => {
    if (!plan || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onImport(name.trim(), plan);
    } catch (e) {
      setError(`Import failed: ${(e as { message?: string })?.message ?? e}`);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Import project from CSV</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="modal-field">
          <span className="modal-field-label">CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => pickFile(e.target.files?.[0])} />
          <span className="modal-field-hint">
            In Excel: File → Save As → <b>CSV UTF-8</b>. One row per task, first row = column names.{' '}
            <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(EXAMPLE_CSV)}`} download="example-project.csv">
              Download an example
            </a>
          </span>
        </label>

        {rows && mapping && plan && (
          <>
            <label className="modal-field">
              <span className="modal-field-label">Project name</span>
              <input className="modal-input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <div className="modal-field">
              <span className="modal-field-label">Match your columns</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', alignItems: 'center' }}>
                {IMPORT_FIELDS.map((f) => (
                  <label key={f.key} style={{ display: 'contents' }}>
                    <span style={{ fontSize: 13 }}>{f.label}{'required' in f && ' *'}</span>
                    <select
                      className="modal-input"
                      style={{ height: 34 }}
                      value={mapping[f.key]}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                    >
                      <option value={-1}>— don&apos;t import —</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {mapping.due >= 0 && (
                  <label style={{ display: 'contents' }}>
                    <span style={{ fontSize: 13 }}>Dates are written</span>
                    <select className="modal-input" style={{ height: 34 }} value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
                      <option value="dmy">Day/Month/Year (25/12/2026)</option>
                      <option value="mdy">Month/Day/Year (12/25/2026)</option>
                    </select>
                  </label>
                )}
              </div>
            </div>

            <p className="modal-message">
              {mapping.name < 0
                ? 'Pick which column holds the task name.'
                : `${count(plan)} tasks in ${plan.sections.length} sections.`}
            </p>
            {plan.warnings.length > 0 && (
              <ul style={{ maxHeight: 120, overflow: 'auto', fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0', paddingLeft: 18 }}>
                {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </>
        )}

        {error && <p className="modal-message" style={{ color: '#D64545', marginTop: 8 }}>{error}</p>}

        <div className="modal-actions">
          <button type="button" className="modal-btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="modal-btn primary" disabled={busy || !plan || (mapping?.name ?? -1) < 0 || !count(plan) || !name.trim()} onClick={submit}>
            {busy ? 'Importing…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DuplicateProps {
  sourceName: string;
  onDuplicate: (name: string, opts: { assignees: boolean; dueDates: boolean; completion: boolean; members: boolean }) => Promise<void>;
  onClose: () => void;
}

// Also the "template" flow: keep a project as the master copy and duplicate it with everything unticked.
export function ProjectDuplicateModal({ sourceName, onDuplicate, onClose }: DuplicateProps) {
  useEscapeToClose(onClose);
  const [name, setName] = useState(`${sourceName} (copy)`);
  const [opts, setOpts] = useState({ assignees: true, dueDates: true, completion: false, members: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onDuplicate(name.trim(), opts);
    } catch (e) {
      setError(`Duplicate failed: ${(e as { message?: string })?.message ?? e}`);
      setBusy(false);
    }
  };

  const box = (key: keyof typeof opts, label: string) => (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 8 }}>
      <input type="checkbox" checked={opts[key]} onChange={(e) => setOpts({ ...opts, [key]: e.target.checked })} />
      {label}
    </label>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Duplicate project</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="modal-field">
          <span className="modal-field-label">New project name</span>
          <input className="modal-input" value={name} autoFocus onFocus={(e) => e.target.select()} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="modal-field">
          <span className="modal-field-label">Sections, tasks, subtasks, descriptions, priorities and tags are always copied. Also keep:</span>
          {box('assignees', 'Assignees')}
          {box('dueDates', 'Due dates')}
          {box('completion', 'Done/not done (otherwise every task starts open)')}
          {box('members', 'Project members')}
          <span className="modal-field-hint">Using it as a template? Untick everything for a clean copy.</span>
        </div>

        {error && <p className="modal-message" style={{ color: '#D64545' }}>{error}</p>}

        <div className="modal-actions">
          <button type="button" className="modal-btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="modal-btn primary" disabled={busy || !name.trim()} onClick={submit}>
            {busy ? 'Copying…' : 'Duplicate'}
          </button>
        </div>
      </div>
    </div>
  );
}
