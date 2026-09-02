'use client';

import { useState } from 'react';
import { Menu, HelpCircle, ChevronDown } from 'lucide-react';

interface TopBarProps {
  onHamburgerClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  avatarInitials?: string;
  avatarColor?: string;
  onOpenProfile: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

export function TopBar({
  onHamburgerClick,
  searchQuery,
  onSearchChange,
  avatarInitials = '?',
  avatarColor = 'var(--accent)',
  onOpenProfile,
  onChangePassword,
  onLogout,
}: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-top-bar">
      <button className="topbar-hamburger" onClick={onHamburgerClick}>
        <Menu size={24} />
      </button>

      <div className="topbar-logo">
        <div className="topbar-logo-mark">τ</div>
        <span>TukTuk</span>
      </div>

      <div className="topbar-search">
        <span style={{ opacity: 0.6 }}>🔍</span>
        <input
          type="text"
          placeholder="Search tasks"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="topbar-keycaps">
          <div className="topbar-keycap">⌘</div>
          <div className="topbar-keycap">K</div>
        </div>
      </div>

      <div className="topbar-right">
        <button className="topbar-help-btn" title="Help">
          <HelpCircle size={18} />
        </button>
        <div className="topbar-avatar" style={{ background: avatarColor }}>{avatarInitials}</div>
        <div style={{ position: 'relative' }}>
          <button className="topbar-account-btn" onClick={() => setMenuOpen((o) => !o)}>
            <ChevronDown size={18} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
              <div className="topbar-account-menu">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenProfile();
                  }}
                >
                  Profile
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onChangePassword();
                  }}
                >
                  Change password
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
