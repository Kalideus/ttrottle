'use client';

import { useState } from 'react';
import { Plus, CheckSquare, Bell, MoreVertical, Mail, Lock, Pencil, Trash2, Upload, Copy } from 'lucide-react';
import type { Project } from '@/lib/supabase/queries';

interface SidebarProps {
  activeSection: 'my-tasks' | 'inbox' | 'projects';
  activeProjectId?: string;
  projects: Project[];
  myTasksBadge?: number;
  notificationsBadge?: number;
  onSectionChange: (section: 'my-tasks' | 'inbox' | 'projects') => void;
  onProjectSelect: (projectId: string) => void;
  onProjectHover?: (projectId: string) => void;
  onProjectCreate: () => void;
  // profile's can_create_projects; also what the projects insert policy checks (migration 012)
  canCreateProjects?: boolean;
  onProjectImport: () => void;
  onProjectDuplicate: (projectId: string) => void;
  onProjectRename: (projectId: string, name: string) => void;
  onProjectDelete: (projectId: string) => void;
  onCreateTask: () => void;
  onInvite: () => void;
}

export function Sidebar({
  activeSection,
  activeProjectId,
  projects,
  myTasksBadge = 0,
  notificationsBadge = 0,
  onSectionChange,
  onProjectSelect,
  onProjectHover,
  onProjectCreate,
  canCreateProjects = false,
  onProjectImport,
  onProjectDuplicate,
  onProjectRename,
  onProjectDelete,
  onCreateTask,
  onInvite,
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState(true);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const finishRename = (project: Project) => {
    setRenamingId(null);
    const name = draft.trim();
    if (name && name !== project.name) onProjectRename(project.id, name);
  };

  return (
    <div className="app-sidebar">
      <button className="sidebar-create-btn" onClick={onCreateTask}>
        <Plus size={20} />
        <span>Create task</span>
      </button>

      <div className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${activeSection === 'my-tasks' ? 'active' : ''}`}
          onClick={() => onSectionChange('my-tasks')}
        >
          <CheckSquare size={20} className="sidebar-nav-icon" />
          <span>My tasks</span>
          {myTasksBadge > 0 && <div className="sidebar-nav-badge">{myTasksBadge}</div>}
        </button>

        <button
          className={`sidebar-nav-item ${activeSection === 'inbox' ? 'active' : ''}`}
          onClick={() => onSectionChange('inbox')}
        >
          <Bell size={20} className="sidebar-nav-icon" />
          <span>Notifications</span>
          {notificationsBadge > 0 && <div className="sidebar-nav-badge">{notificationsBadge}</div>}
        </button>
      </div>

      <div className="sidebar-divider" />

      <div>
        <div className="sidebar-projects-header">
          <span>Projects</span>
          {canCreateProjects && (
            <>
              <button className="sidebar-projects-header-plus" title="Import project from CSV" onClick={onProjectImport} style={{ marginLeft: 'auto' }}>
                <Upload size={14} />
              </button>
              <button className="sidebar-projects-header-plus" title="Add project" onClick={onProjectCreate}>
                <Plus size={16} />
              </button>
            </>
          )}
        </div>

        <div className="sidebar-projects">
          {(projects || []).map((project) => (
            <div
              key={project.id}
              onMouseEnter={() => onProjectHover?.(project.id)}
              className={`sidebar-project-row ${activeProjectId === project.id && activeSection === 'projects' ? 'active' : ''}`}
              onClick={() => {
                if (renamingId === project.id) return;
                onSectionChange('projects');
                onProjectSelect(project.id);
              }}
            >
              <div
                className="sidebar-project-dot"
                style={{ backgroundColor: project.color }}
              />
              {renamingId === project.id ? (
                <input
                  className="sidebar-rename-input"
                  aria-label="Project name"
                  value={draft}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => finishRename(project)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setRenamingId(null);
                    }
                  }}
                />
              ) : (
                <span className="sidebar-project-name">{project.name}</span>
              )}
              {project.is_private && <Lock size={12} aria-label="Private" style={{ opacity: 0.6 }} />}
              <button
                type="button"
                className={`sidebar-project-menu ${menuFor === project.id ? 'is-open' : ''}`}
                aria-label={`Options for ${project.name}`}
                aria-haspopup="menu"
                aria-expanded={menuFor === project.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuFor(menuFor === project.id ? null : project.id);
                }}
              >
                <MoreVertical size={16} />
              </button>

              {menuFor === project.id && (
                <>
                  <div className="sidebar-menu-backdrop" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                  <div className="sidebar-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuFor(null);
                        setDraft(project.name);
                        setRenamingId(project.id);
                      }}
                    >
                      <Pencil size={14} /> Rename
                    </button>
                    {canCreateProjects && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuFor(null);
                          onProjectDuplicate(project.id);
                        }}
                      >
                        <Copy size={14} /> Duplicate
                      </button>
                    )}
                    {!project.is_private && (
                      <button
                        type="button"
                        role="menuitem"
                        className="is-danger"
                        onClick={() => {
                          setMenuFor(null);
                          onProjectDelete(project.id);
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {(projects || []).length > 5 && (
          <div style={{ padding: '12px', fontSize: '13px', color: 'var(--chrome-text-dim)', cursor: 'pointer' }}>
            Show more
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-invite-btn" onClick={onInvite}>
          <Mail size={18} />
          <span>Invite teammates</span>
        </button>
      </div>
    </div>
  );
}
