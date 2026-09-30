'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, CheckCircle2, Circle, Lock } from 'lucide-react';
import type { Project } from '@/lib/supabase/queries';

export interface TaskHit {
  id: string;
  name: string;
  project_id: string | null;
  completed: boolean;
  parent_task_id: string | null;
}

interface GlobalSearchProps {
  projects: Project[];
  searchTasks: (query: string) => Promise<TaskHit[]>;
  onOpenTask: (projectId: string, taskId: string) => void;
  onOpenProject: (projectId: string) => void;
}

type Hit = { kind: 'project'; project: Project } | { kind: 'task'; task: TaskHit };

// Top-bar search across every task and project the user can see (RLS limits
// the task query to their projects). Ctrl/⌘+K focuses it.
export function GlobalSearch({ projects, searchTasks, onOpenTask, onOpenProject }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [modKey, setModKey] = useState('Ctrl');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setModKey('⌘');
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounced task lookup; the latest query wins if responses arrive out of order.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setTasks([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const hits = await searchTasks(q);
      if (!cancelled) {
        setTasks(hits);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, searchTasks]);

  const q = query.trim().toLowerCase();
  const projectHits = q ? projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5) : [];
  const hits: Hit[] = [
    ...projectHits.map((project) => ({ kind: 'project' as const, project })),
    ...tasks.map((task) => ({ kind: 'task' as const, task })),
  ];
  const projectById = new Map(projects.map((p) => [p.id, p]));

  useEffect(() => setActive(0), [query, tasks.length]);

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const pick = (hit: Hit | undefined) => {
    if (!hit) return;
    if (hit.kind === 'project') onOpenProject(hit.project.id);
    else if (hit.task.project_id) onOpenTask(hit.task.project_id, hit.task.id);
    setQuery('');
    close();
  };

  const showPanel = open && q.length > 0;

  return (
    <div className="gsearch">
      <label className="topbar-search">
        <Search size={16} aria-hidden />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="gsearch-results"
          aria-activedescendant={showPanel && hits[active] ? `gsearch-hit-${active}` : undefined}
          aria-label="Search tasks and projects"
          placeholder="Search tasks and projects"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              pick(hits[active]);
            } else if (e.key === 'Escape') {
              e.stopPropagation(); // close search, not whatever modal/panel is underneath
              if (query) setQuery('');
              else close();
            }
          }}
        />
        <span className="topbar-keycaps" aria-hidden>
          <kbd className="topbar-keycap">{modKey}</kbd>
          <kbd className="topbar-keycap">K</kbd>
        </span>
      </label>

      {showPanel && (
        <>
          <div className="gsearch-backdrop" onClick={() => setOpen(false)} />
          <div className="gsearch-panel" id="gsearch-results" role="listbox">
            {projectHits.length > 0 && <div className="gsearch-section">Projects</div>}
            {hits.map((hit, i) => {
              const isActive = i === active;
              const common = {
                id: `gsearch-hit-${i}`,
                role: 'option' as const,
                'aria-selected': isActive,
                className: `gsearch-hit ${isActive ? 'is-active' : ''}`,
                onMouseEnter: () => setActive(i),
                // mousedown so the input doesn't blur before the click lands
                onMouseDown: (e: React.MouseEvent) => {
                  e.preventDefault();
                  pick(hit);
                },
              };
              if (hit.kind === 'project') {
                return (
                  <div key={`p-${hit.project.id}`} {...common}>
                    <span className="gsearch-dot" style={{ background: hit.project.color }} />
                    <span className="gsearch-name">{hit.project.name}</span>
                    {hit.project.is_private && <Lock size={12} style={{ opacity: 0.6 }} />}
                  </div>
                );
              }
              const project = hit.task.project_id ? projectById.get(hit.task.project_id) : undefined;
              return (
                <div key={`t-${hit.task.id}`}>
                  {i === projectHits.length && <div className="gsearch-section">Tasks</div>}
                  <div {...common}>
                    {hit.task.completed ? (
                      <CheckCircle2 size={16} style={{ color: '#2E9E6B', flexShrink: 0 }} />
                    ) : (
                      <Circle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    <span className={`gsearch-name ${hit.task.completed ? 'is-done' : ''}`}>{hit.task.name}</span>
                    {project && (
                      <span className="gsearch-project">
                        <span className="gsearch-dot" style={{ background: project.color }} />
                        {project.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {hits.length === 0 && (
              <div className="gsearch-empty">
                {q.length < 2 ? 'Keep typing to search tasks…' : loading ? 'Searching…' : `No tasks or projects match “${query.trim()}”`}
              </div>
            )}
            {loading && hits.length > 0 && <div className="gsearch-empty">Searching…</div>}
          </div>
        </>
      )}
    </div>
  );
}
