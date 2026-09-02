'use client';

import { useState } from 'react';
import { Menu, HelpCircle, ChevronDown } from 'lucide-react';

interface TopBarProps {
  onHamburgerClick: () => void;
}

export function TopBar({ onHamburgerClick }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('');

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
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
        <div className="topbar-avatar">JD</div>
        <button className="topbar-account-btn">
          <ChevronDown size={18} />
        </button>
      </div>
    </div>
  );
}
