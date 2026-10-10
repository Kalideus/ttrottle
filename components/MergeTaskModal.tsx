'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Circle } from 'lucide-react';
import type { Project, Task } from '@/lib/supabase/queries';
import type { TaskHit } from '@/components/GlobalSearch';
import { useEscapeToClose } from '@/lib/useEscapeToClose';

interface MergeTaskModalProps {
  task: Task;
  projects: Project[];
  searchTasks: (query: string) => Promise<TaskHit[]>;
  /** Resolves to why it couldn't be done, or null once merged. */
  onMerge: (keep: { id: string; project_id: string | null }, removeId: string) => Promise<string | null>;
  onClose: () => void;
}

// Merge a duplicate: find the other task (any project you can see), then say which of the two is the main one.
export function MergeTaskModal({ task, projects, searchTasks, onMerge, onClose }: MergeTaskModalProps) {
  useEscapeToClose(onClose);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<TaskHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [other, setOther] = useState<TaskHit | null>(null);
  const [keepOther, setKeepOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced lookup, same as GlobalSearch; the latest query wins if responses arrive out of order.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const found = await searchTasks(q);
      if (!cancelled) {
        setHits(found.filter((h) => h.id !== task.id));
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, searchTasks, task.id]);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const projectLabel = (id: string | null) => {
    const project = id ? projectById.get(id) : undefined;
    return (
      project && (
        <span className="gsearch-project">
          <span className="gsearch-dot" style={{ background: project.color }} />
          {project.name}
        </span>
      )
    );
  };

  const merge = async () => {
    if (!other) return;
    setBusy(true);
    setError(null);
    const failed = await onMerge(keepOther ? other : task, keepOther ? task.id : other.id);
    if (failed === null) return onClose();
    setError(failed);
    setBusy(false);
  };

  const choice = (isOther: boolean, name: string, projectId: string | null) => (
    <label className={`gsearch-hit ${keepOther === isOther ? 'is-active' : ''}`}>
      <input type="radio" name="merge-keep" checked={keepOther === isOther} onChange={() => setKeepOther(isOther)} />
      <span className="gsearch-name">{name}</span>
      {projectLabel(projectId)}
    </label>
  );

  // portal to <body>: it's opened from the task panel, whose layout would otherwise clip it
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-labelledby="merge-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title" id="merge-title">Merge task</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!other ? (
          <div className="modal-field">
            <label>
              <span className="modal-field-label">Merge “{task.name}” with</span>
              <input
                className="modal-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks in any of your projects"
                autoFocus
              />
            </label>
            <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
              {hits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="gsearch-hit"
                  style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
                  onClick={() => setOther(hit)}
                >
                  {hit.completed ? (
                    <CheckCircle2 size={16} style={{ color: '#2E9E6B', flexShrink: 0 }} />
                  ) : (
                    <Circle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                  <span className={`gsearch-name ${hit.completed ? 'is-done' : ''}`}>{hit.name}</span>
                  {projectLabel(hit.project_id)}
                </button>
              ))}
              {hits.length === 0 && (
                <div className="gsearch-empty">
                  {query.trim().length < 2 ? 'Type the name of the duplicate task.' : loading ? 'Searching…' : `No tasks match “${query.trim()}”`}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="modal-field" role="radiogroup" aria-labelledby="merge-keep-label">
            <span className="modal-field-label" id="merge-keep-label">Which one is the main task?</span>
            {choice(false, task.name, task.project_id)}
            {choice(true, other.name, other.project_id)}
            <span className="modal-field-hint">
              The main task keeps its own name, description, assignee and dates. The other one’s are saved as a comment on it,
              its comments, subtasks, followers and tags move across, and it is then deleted.
            </span>
          </div>
        )}

        {error && <p className="modal-field-hint" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="modal-actions">
          {other && (
            <button type="button" className="modal-btn ghost" style={{ marginRight: 'auto' }} onClick={() => { setOther(null); setError(null); }} disabled={busy}>
              Back
            </button>
          )}
          <button type="button" className="modal-btn ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="modal-btn primary" onClick={merge} disabled={!other || busy}>
            {busy ? 'Merging…' : 'Merge'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
