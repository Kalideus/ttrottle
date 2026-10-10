'use client';

import { ChevronDown, Lock, Printer, UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Heading, ProjectMember } from '@/lib/supabase/queries';
import { avatarStyle } from '@/lib/avatar';

const PROJECT_COLORS = ['#4573D2', '#F06A6A', '#A970D1', '#4ECBC4', '#E8A5C8', '#F1BD6C', '#5DA283'];
// ponytail: a fixed handful covers project names; Win+. / Ctrl+Cmd+Space opens the full OS picker
const NAME_EMOJIS = [
  '🚀', '⭐', '🔥', '✅', '📌', '📣', '💡', '🎯',
  '📅', '📈', '💰', '🛠️', '🎨', '🌐', '📱', '📦',
  '👥', '🤝', '📝', '🧪', '🐛', '⚡', '🏆', '❤️',
  '🌏', '🗺️', '🛺', '🌴', '☕', '🍜', '🏖️', '✈️',
];

const PROJECT_ICONS =['📋', '🎨', '🌐', '📊', '👥', '🚀', '💡', '📱', '🛠️', '📦'];

interface ProjectHeaderProps {
  projectName: string;
  projectColor: string;
  projectIcon: string;
  isPrivate?: boolean;
  isSuperAdmin?: boolean;
  members: ProjectMember[];
  currentUserId: string | null;
  onInvite: () => void;
  onShowMembers: () => void;
  onProjectUpdate: (updates: { name?: string; color?: string; icon?: string }) => Promise<void>;
  onProjectArchive: () => void;
  onProjectDelete: () => void;
  acceptsTickets?: boolean;
  // only passed for people who may change it (project managers and super admins)
  onAcceptsTicketsChange?: (on: boolean) => void;
  // which section tickets land in (migration 034)
  headings: Heading[];
  ticketHeadingId: string | null;
  onTicketHeadingChange: (headingId: string) => void;
}

export function ProjectHeader({
  projectName,
  projectColor,
  projectIcon,
  isPrivate = false,
  isSuperAdmin = false,
  members,
  currentUserId,
  onInvite,
  onShowMembers,
  onProjectUpdate,
  onProjectArchive,
  onProjectDelete,
  acceptsTickets = false,
  onAcceptsTicketsChange,
  headings,
  ticketHeadingId,
  onTicketHeadingChange,
}: ProjectHeaderProps) {
  const visibleMembers = members.slice(0, 3);
  const [showEdit, setShowEdit] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);
  const [showEmoji, setShowEmoji] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const insertEmoji = (emoji: string) => {
    const input = nameRef.current;
    const start = input?.selectionStart ?? nameDraft.length;
    const end = input?.selectionEnd ?? nameDraft.length;
    setNameDraft(nameDraft.slice(0, start) + emoji + nameDraft.slice(end));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };
  const myRole = members.find((m) => m.profile_id === currentUserId)?.role;
  // same rule as the database: only a project's owner or managers change its name, colour and icon
  const canEdit = myRole === 'owner' || myRole === 'admin';
  const canArchive = !isPrivate && canEdit;
  const canDelete = !isPrivate && (myRole === 'owner' || isSuperAdmin);

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
        {isPrivate && (
          <span title="Only you can see this project" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Lock size={12} /> Only you
          </span>
        )}
        {/* no menu at all for someone it would be empty for */}
        {(canEdit || canDelete || (onAcceptsTicketsChange && !isPrivate)) && (
          <button className="project-header-menu" onClick={() => (showEdit ? setShowEdit(false) : openEdit())}>
            <ChevronDown size={18} />
          </button>
        )}

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
              {canEdit && (
              <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Name</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    ref={nameRef}
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { saveName(); setShowEdit(false); }
                      if (e.key === 'Escape') { setNameDraft(projectName); setShowEdit(false); }
                    }}
                    style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    title="Insert emoji"
                    aria-label="Insert emoji"
                    aria-expanded={showEmoji}
                    onClick={() => setShowEmoji(!showEmoji)}
                    style={{ width: '36px', flexShrink: 0, border: '1px solid var(--border)', borderRadius: '6px', background: showEmoji ? 'var(--accent-soft)' : 'var(--surface-alt)', cursor: 'pointer', fontSize: '16px' }}
                  >
                    😀
                  </button>
                </div>
                {showEmoji && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '2px', marginTop: '4px' }}>
                    {NAME_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        aria-label={`Insert ${emoji}`}
                        // mousedown keeps focus in the name field, so it doesn't blur-save mid-edit
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertEmoji(emoji)}
                        style={{ height: '28px', border: 'none', borderRadius: '5px', background: 'transparent', cursor: 'pointer', fontSize: '16px' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-alt)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
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
              </>
              )}

              {onAcceptsTicketsChange && !isPrivate && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', borderTop: canEdit ? '1px solid var(--border)' : undefined, padding: '12px 0', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}>
                  <input type="checkbox" checked={acceptsTickets} onChange={(e) => onAcceptsTicketsChange(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>
                    Accept tickets
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Anyone with an account can send this project a request. They only ever see their own.
                    </span>
                  </span>
                </label>
              )}

              {onAcceptsTicketsChange && !isPrivate && acceptsTickets && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '12px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  Tickets go into
                  <select
                    value={ticketHeadingId ?? ''}
                    onChange={(e) => e.target.value && onTicketHeadingChange(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', color: 'var(--text)', background: 'var(--surface)' }}
                  >
                    {!ticketHeadingId && <option value="">A new “Tickets” section</option>}
                    {headings.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {(canArchive || canDelete) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  {canArchive && (
                    <button
                      onClick={() => { setShowEdit(false); onProjectArchive(); }}
                      style={{ textAlign: 'left', padding: '6px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--text)' }}
                    >
                      Archive project
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => { setShowEdit(false); onProjectDelete(); }}
                      style={{ textAlign: 'left', padding: '6px 0', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: '#D64545' }}
                    >
                      Delete project permanently
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="project-header-right">
        <button
          type="button"
          className="project-members"
          onClick={onShowMembers}
          title="See who's in this project"
          aria-label={`Members (${members.length})`}
        >
          {visibleMembers.map((member) => (
            <div
              key={member.email}
              className="project-member-avatar"
              title={member.profile?.name ?? member.email}
              style={avatarStyle(member.profile?.avatar_url, member.profile?.avatar_color)}
            >
              {member.profile?.initials ?? member.email.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {members.length > 3 && (
            <div className="project-member-more">+{members.length - 3}</div>
          )}
        </button>

        {!isPrivate && (canArchive || isSuperAdmin) && (
          <button className="project-share-btn" onClick={onInvite}>
            <UserPlus size={16} />
            <span>Invite</span>
          </button>
        )}

        {/* prints components/ProjectPrintSheet.tsx, as does Ctrl/⌘+P */}
        <button className="project-star-btn" title="Print this project as a checklist" aria-label="Print this project" onClick={() => window.print()}>
          <Printer size={16} />
        </button>
      </div>
    </div>
  );
}
