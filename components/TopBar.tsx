'use client';

import { useState, type ReactNode } from 'react';
import { Menu, HelpCircle, ChevronDown, Plus } from 'lucide-react';
import { avatarStyle } from '@/lib/avatar';

interface TopBarProps {
  onHamburgerClick: () => void;
  sidebarOpen: boolean;
  search: ReactNode;
  avatarInitials?: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  userName?: string;
  userEmail?: string;
  isSuperAdmin?: boolean;
  onCreateTask: () => void;
  onOpenProfile: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onShowShortcuts: () => void;
}

export function TopBar({
  onHamburgerClick,
  sidebarOpen,
  search,
  avatarInitials = '?',
  avatarColor = 'var(--accent)',
  avatarUrl,
  userName,
  userEmail,
  isSuperAdmin = false,
  onCreateTask,
  onOpenProfile,
  onChangePassword,
  onLogout,
  onShowShortcuts,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItem = (label: string, action: () => void) => (
    <button
      role="menuitem"
      onClick={() => {
        setMenuOpen(false);
        action();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="app-top-bar">
      <div className="topbar-left">
        <button
          className="topbar-icon-btn"
          onClick={onHamburgerClick}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          aria-expanded={sidebarOpen}
        >
          <Menu size={20} />
        </button>

        <div className="topbar-logo">
          <div className="topbar-logo-mark">
            <img src="/logo.svg" alt="" />
          </div>
          <span className="brand-word">ttrottle</span>
        </div>
      </div>

      <div className="topbar-center">
        {search}
        <button className="topbar-icon-btn topbar-create" onClick={onCreateTask} title="Create task (C)" aria-label="Create task">
          <Plus size={20} />
        </button>
      </div>

      <div className="topbar-right">
        <button className="topbar-icon-btn" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={onShowShortcuts}>
          <HelpCircle size={18} />
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className="topbar-account-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account menu"
          >
            <span className="topbar-avatar" style={avatarStyle(avatarUrl, avatarColor)}>{avatarInitials}</span>
            <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
              <div className="topbar-account-menu" role="menu">
                {(userName || userEmail) && (
                  <div className="topbar-menu-who">
                    <span className="topbar-avatar" style={avatarStyle(avatarUrl, avatarColor)}>{avatarInitials}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="topbar-menu-name">{userName}</div>
                      <div className="topbar-menu-email">{userEmail}</div>
                    </div>
                  </div>
                )}
                {menuItem('Profile', onOpenProfile)}
                {menuItem('Change password', onChangePassword)}
                {isSuperAdmin && menuItem('Team & permissions', () => (window.location.href = '/admin/team'))}
                {isSuperAdmin && menuItem('Deleted tasks', () => (window.location.href = '/admin/deleted-tasks'))}
                <div className="topbar-menu-sep" />
                {menuItem('Log out', onLogout)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
