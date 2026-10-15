'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, CheckCircle2, Circle, Lock, User, BookUser } from 'lucide-react';
import type { Contact, Project, TaskSearch } from '@/lib/supabase/queries';
import { contactMatches, contactTitle } from '@/lib/contacts';

export interface TaskHit {
  id: string;
  name: string;
  project_id: string | null;
  completed: boolean;
  parent_task_id: string | null;
  due_date?: string | null;
  // set when it matched on its assignee or a tag, not its name: "Assigned to Tom Cornish", "Tag: Urgent"
  why?: string;
}

type Person = { id: string; name: string };
type TagHit = { id: string; name: string; color: string };

interface GlobalSearchProps {
  projects: Project[];
  // `projectId`: only that project's tasks (null = every project the user is in)
  search: (query: string, projectId: string | null) => Promise<{ tasks: TaskHit[]; people: Person[]; tags: TagHit[] }>;
  /** Show what's being searched as a full task list on the page, to work through. */
  onOpenList: (by: TaskSearch, label: string, projectId: string | null) => void;
  onOpenTask: (projectId: string, taskId: string) => void;
  onOpenProject: (projectId: string) => void;
  /** Already loaded by the page, so they're matched here as you type. */
  contacts: Contact[];
  onOpenContact: (contactId: string) => void;
}

type Hit =
  | { kind: 'person'; person: Person }
  | { kind: 'tag'; tag: TagHit }
  | { kind: 'project'; project: Project }
  | { kind: 'contact'; contact: Contact }
  | { kind: 'task'; task: TaskHit };

const SECTION = { person: 'People', tag: 'Tags', project: 'Projects', contact: 'Contacts', task: 'Tasks' };

// Top-bar search across every task, person, tag and project the user can see (RLS limits
// the tasks to their projects). Picking a person or tag opens all of their tasks as a list. Ctrl/⌘+K focuses it.
export function GlobalSearch({ projects, search, onOpenList, onOpenTask, onOpenProject, contacts, onOpenContact }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<{ tasks: TaskHit[]; people: Person[]; tags: TagHit[] }>({ tasks: [], people: [], tags: [] });
  // which project to search: '' = all of them
  const [where, setWhere] = useState('');
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

  // Debounced lookup; the latest query wins if responses arrive out of order.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound({ tasks: [], people: [], tags: [] });
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const next = await search(q, where || null);
      if (!cancelled) {
        setFound(next);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, where, search]);

  const q = query.trim().toLowerCase();
  const projectHits = q ? projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5) : [];
  const contactHits = q.length >= 2 ? contacts.filter((c) => contactMatches(c, q)).slice(0, 5) : [];
  const hits: Hit[] = [
    ...found.people.map((person) => ({ kind: 'person' as const, person })),
    ...found.tags.map((tag) => ({ kind: 'tag' as const, tag })),
    ...projectHits.map((project) => ({ kind: 'project' as const, project })),
    ...contactHits.map((contact) => ({ kind: 'contact' as const, contact })),
    ...found.tasks.map((task) => ({ kind: 'task' as const, task })),
  ];
  const projectById = new Map(projects.map((p) => [p.id, p]));

  useEffect(() => setActive(0), [query, hits.length]);

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const pick = (hit: Hit | undefined) => {
    if (!hit) return;
    // a person or tag opens all of their tasks as a list on the page; a task or project opens itself
    if (hit.kind === 'person') onOpenList({ assignee_id: hit.person.id }, `Assigned to ${hit.person.name}`, where || null);
    else if (hit.kind === 'tag') onOpenList({ tag_id: hit.tag.id }, `Tagged ${hit.tag.name}`, where || null);
    else if (hit.kind === 'project') onOpenProject(hit.project.id);
    else if (hit.kind === 'contact') onOpenContact(hit.contact.id);
    else if (hit.task.project_id) onOpenTask(hit.task.project_id, hit.task.id);
    setQuery('');
    close();
  };

  const showPanel = open && q.length > 0;

  const openList = () => {
    onOpenList({ text: query.trim() }, `“${query.trim()}”`, where || null);
    setQuery('');
    close();
  };

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
          aria-label="Search tasks, people, tags, projects and contacts"
          placeholder="Search tasks, people, tags, projects and contacts"
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
            <div className="gsearch-tools">
              <select aria-label="Where to search" value={where} onChange={(e) => setWhere(e.target.value)}>
                <option value="">All my projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {q.length >= 2 && (
                // mousedown so the input doesn't blur before the click lands
                <button type="button" onMouseDown={(e) => { e.preventDefault(); openList(); }}>
                  Open as a list
                </button>
              )}
            </div>
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
              // a heading above the first hit of each kind
              const heading = hits[i - 1]?.kind !== hit.kind && <div className="gsearch-section">{SECTION[hit.kind]}</div>;
              if (hit.kind === 'person' || hit.kind === 'tag') {
                return (
                  <div key={`${hit.kind}-${hit.kind === 'person' ? hit.person.id : hit.tag.id}`}>
                    {heading}
                    <div {...common}>
                      {hit.kind === 'person' ? (
                        <User size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      ) : (
                        <span className="gsearch-dot" style={{ background: hit.tag.color }} />
                      )}
                      <span className="gsearch-name">{hit.kind === 'person' ? hit.person.name : hit.tag.name}</span>
                      <span className="gsearch-project">{hit.kind === 'person' ? 'See their tasks' : 'See tagged tasks'}</span>
                    </div>
                  </div>
                );
              }
              if (hit.kind === 'project') {
                return (
                  <div key={`p-${hit.project.id}`}>
                    {heading}
                    <div {...common}>
                      <span className="gsearch-dot" style={{ background: hit.project.color }} />
                      <span className="gsearch-name">{hit.project.name}</span>
                      {hit.project.is_private && <Lock size={12} style={{ opacity: 0.6 }} />}
                    </div>
                  </div>
                );
              }
              if (hit.kind === 'contact') {
                const c = hit.contact;
                return (
                  <div key={`c-${c.id}`}>
                    {heading}
                    <div {...common}>
                      <BookUser size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span className="gsearch-name">{contactTitle(c)}</span>
                      <span className="gsearch-project">
                        {[c.name.trim() ? c.company : '', c.role || c.tags.slice(0, 2).join(', '), c.phone].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  </div>
                );
              }
              const project = hit.task.project_id ? projectById.get(hit.task.project_id) : undefined;
              return (
                <div key={`t-${hit.task.id}`}>
                  {heading}
                  <div {...common}>
                    {hit.task.completed ? (
                      <CheckCircle2 size={16} style={{ color: '#2E9E6B', flexShrink: 0 }} />
                    ) : (
                      <Circle size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    <span className={`gsearch-name ${hit.task.completed ? 'is-done' : ''}`}>{hit.task.name}</span>
                    {hit.task.why && <span className="gsearch-project">{hit.task.why}</span>}
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
                {loading
                  ? 'Searching…'
                  : q.length < 2
                    ? 'Keep typing to search…'
                    : `Nothing matches “${query.trim()}”`}
              </div>
            )}
            {loading && hits.length > 0 && <div className="gsearch-empty">Searching…</div>}
          </div>
        </>
      )}
    </div>
  );
}
