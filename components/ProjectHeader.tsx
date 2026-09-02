'use client';

import { ChevronDown, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { ProjectMember } from '@/lib/supabase/queries';

const PROJECT_COLORS = ['#4573D2', '#F06A6A', '#A970D1', '#4ECBC4', '#E8A5C8', '#F1BD6C', '#5DA283'];
const PROJECT_ICONS = ['📋', '🎨', '🌐', '📊', '👥', '🚀', '💡', '📱', '🛠️', '📦'];

interface ProjectHeaderProps {
  projectName: string;
  projectColor: string;
  projectIcon: string;
  members: ProjectMember[];
  onInvite: () => void;
  onProjectUpdate: (updates: { name?: string; color?: string; icon?: string }) => Promise<void>;
}

export function ProjectHeader({
  projectName,
  projectColor,
  projectIcon,
  members,
  onInvite,
  onProjectUpdate,
}: ProjectHeaderProps) {
  const visibleMembers = members.slice(0, 3);
  const [showEdit, setShowEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);

  const openEdit = () => {
    setNameDraft(projectName);
    setShowEdit(true);
  };

  const saveName = () => {
    if (nameDraft.trim() && nameDraft.trim() !== projectName) {
      onProjectUpdate({ name: nameDraft.trim() });
    }
  };

  return (
    <div className="project-header">
      <div className="project-header-left" style={{ position: 'relative' }}>
        <div
          className="project-icon"
          style={{ backgroundColor: projectColor }}
        >
          {projectIcon}
        </div>
        <div className="project-name">{projectName}</div>
        <button className="project-header-menu" onClick={() => (showEdit ? setShowEdit(false) : openEdit())}>
          <ChevronDown size={18} />
        </button>

        {showEdit && (
          <>
            <div onClick={() => setShowEdit(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '16px',
                minWidth: '260px',
                zIndex: 100,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Name</span>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { saveName(); setShowEdit(false); }
                    if (e.key === 'Escape') { setNameDraft(projectName); setShowEdit(false); }
                  }}
                  style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Colour</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => onProjectUpdate({ color })}
                      title={color}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: projectColor === color ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Icon</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {PROJECT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => onProjectUpdate({ icon })}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        fontSize: '15px',
                        background: projectIcon === icon ? 'var(--accent-soft)' : 'var(--surface-alt)',
                        border: projectIcon === icon ? '1px solid var(--accent)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="project-header-right">
        <div className="project-members">
          {visibleMembers.map((member) => (
            <div key={member.email} className="project-member-avatar" title={member.profile?.name ?? member.email}>
              {member.profile?.initials ?? member.email.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {members.length > 3 && (
            <div className="project-member-more">+{members.length - 3}</div>
          )}
        </div>

        <button className="project-share-btn" onClick={onInvite}>
          <UserPlus size={16} />
          <span>Invite</span>
        </button>

        <button className="project-star-btn" title="Favorite">
          ☆
        </button>
      </div>
    </div>
  );
}
