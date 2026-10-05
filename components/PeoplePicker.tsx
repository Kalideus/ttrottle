'use client';

import { useState } from 'react';
import type { ProjectMember } from '@/lib/supabase/queries';
import { avatarStyle } from '@/lib/avatar';
import { flipIfOffscreen } from '@/lib/flipIfOffscreen';

// Searchable dropdown of people: type to filter, arrows + Enter to pick,
// Escape to close. Used for assignee and follower pickers.
interface PeoplePickerProps {
  people: ProjectMember[];
  selectedId?: string | null;
  onPick: (profileId: string | null) => void;
  onClose: () => void;
  allowNone?: boolean; // adds an "Unassigned" option (picks null)
  emptyText?: string;
  alignRight?: boolean; // open leftwards from the right edge, for triggers near the right side
}

const nameOf = (m: ProjectMember) => m.profile?.name ?? m.email;

export function MemberAvatar({ member, size = 20 }: { member: ProjectMember; size?: number }) {
  return (
    <span
      className="ct-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45), ...avatarStyle(member.profile?.avatar_url, member.profile?.avatar_color) }}
      aria-hidden
    >
      {member.profile?.initials ?? member.email.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function PeoplePicker({ people, selectedId, onPick, onClose, allowNone = false, emptyText = 'No one to pick', alignRight = false }: PeoplePickerProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const q = query.trim().toLowerCase();
  const matches = people.filter((m) => m.profile_id && (!q || `${nameOf(m)} ${m.email}`.toLowerCase().includes(q)));
  // "Unassigned" only while not searching, and always first
  const options: (ProjectMember | null)[] = allowNone && !q ? [null, ...matches] : matches;

  const pick = (option: ProjectMember | null | undefined) => {
    if (option === undefined) return;
    onPick(option ? option.profile_id! : null);
  };

  return (
    <>
      <div className="ct-picker-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        className="ct-picker-pop"
        ref={flipIfOffscreen}
        style={alignRight ? { left: 'auto', right: 0 } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="ct-control ct-full"
          aria-label="Search people"
          placeholder="Type a name…"
          value={query}
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="people-picker-list"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              pick(options[active]);
            } else if (e.key === 'Escape') {
              e.stopPropagation(); // close just the picker, not the panel/modal behind it
              onClose();
            }
          }}
        />
        <div className="ct-picker-list" role="listbox" id="people-picker-list">
          {options.map((option, i) => {
            const id = option ? option.profile_id! : '__none__';
            const isSelected = option ? option.profile_id === selectedId : !selectedId;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`ct-picker-item ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(option)}
              >
                {option ? <MemberAvatar member={option} /> : <span className="ct-avatar ct-avatar-empty" />}
                <span className="ct-picker-name">{option ? nameOf(option) : 'Unassigned'}</span>
              </button>
            );
          })}
          {options.length === 0 && <span className="ct-empty">{q ? 'No one matches' : emptyText}</span>}
        </div>
      </div>
    </>
  );
}
