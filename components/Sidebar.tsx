'use client';

import { useState } from 'react';
import { Plus, CheckSquare, Inbox, MoreVertical, Mail } from 'lucide-react';
import type { Project } from '@/lib/supabase/queries';

interface SidebarProps {
  activeSection: 'my-tasks' | 'inbox' | 'projects';
  activeProjectId?: string;
  projects: Project[];
  onSectionChange: (section: 'my-tasks' | 'inbox' | 'projects') => void;
  onProjectSelect: (projectId: string) => void;
  onProjectCreate: () => void;
  onInvite: () => void;
}

export function Sidebar({
  activeSection,
  activeProjectId,
  projects,
  onSectionChange,
  onProjectSelect,
  onProjectCreate,
  onInvite,
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState(true);

  return (
    <div className="app-sidebar">
      <button className="sidebar-create-btn" onClick={onProjectCreate}>
        <Plus size={20} />
        <span>Create</span>
      </button>

      <div className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${activeSection === 'my-tasks' ? 'active' : ''}`}
          onClick={() => onSectionChange('my-tasks')}
        >
          <CheckSquare size={20} className="sidebar-nav-icon" />
          <span>My tasks</span>
          <div className="sidebar-nav-badge">3</div>
        </button>

        <button
          className={`sidebar-nav-item ${activeSection === 'inbox' ? 'active' : ''}`}
          onClick={() => onSectionChange('inbox')}
        >
          <Inbox size={20} className="sidebar-nav-icon" />
          <span>Inbox</span>
          <div className="sidebar-nav-badge">2</div>
        </button>
      </div>

      <div className="sidebar-divider" />

      <div>
        <div className="sidebar-projects-header">
          <span>Projects</span>
          <button className="sidebar-projects-header-plus" title="Add project" onClick={onProjectCreate}>
            <Plus size={16} />
          </button>
        </div>

        <div className="sidebar-projects">
          {(projects || []).map((project) => (
            <div
              key={project.id}
              className={`sidebar-project-row ${activeProjectId === project.id && activeSection === 'projects' ? 'active' : ''}`}
              onClick={() => {
                onSectionChange('projects');
                onProjectSelect(project.id);
              }}
            >
              <div
                className="sidebar-project-dot"
                style={{ backgroundColor: project.color }}
              />
              <span className="sidebar-project-name">{project.name}</span>
              <div className="sidebar-project-menu" style={{ cursor: 'pointer' }}>
                <MoreVertical size={16} />
              </div>
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
