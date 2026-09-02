'use client';

import { Plus, ChevronDown, Filter, ArrowUpDown, Search } from 'lucide-react';
import { useState } from 'react';
import type { Tag } from '@/lib/supabase/queries';

export type FilterValue = 'priority:high' | 'priority:medium' | 'priority:low' | 'no-due-date' | 'overdue' | `tag:${string}`;

export type SortField = 'due_date' | 'priority' | 'name' | 'created_at' | 'position';

interface ToolbarProps {
  onAddTask: () => void;
  activeFilters: FilterValue[];
  onFilterChange: (filters: FilterValue[]) => void;
  onSortChange: (field: SortField) => void;
  onSortDirectionChange: (direction: 'asc' | 'desc') => void;
  onSearchChange: (query: string) => void;
  sortField?: SortField;
  sortDirection?: 'asc' | 'desc';
  availableTags?: Tag[];
  showCompleted: boolean;
  onShowCompletedChange: (show: boolean) => void;
}

export function Toolbar({
  onAddTask,
  activeFilters,
  onFilterChange,
  onSortChange,
  onSortDirectionChange,
  onSearchChange,
  sortField = 'due_date',
  sortDirection = 'asc',
  availableTags = [],
  showCompleted,
  onShowCompletedChange,
}: ToolbarProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [openMenu, setOpenMenu] = useState<'sort' | 'filter' | null>(null);

  const sortOptions: Array<{ label: string; field: SortField }> = [
    { label: 'Manual order', field: 'position' },
    { label: 'Due Date', field: 'due_date' },
    { label: 'Priority', field: 'priority' },
    { label: 'Task Name', field: 'name' },
    { label: 'Created Date', field: 'created_at' },
  ];

  const filterOptions: Array<{ label: string; value: FilterValue }> = [
    { label: 'High Priority', value: 'priority:high' },
    { label: 'Medium Priority', value: 'priority:medium' },
    { label: 'Low Priority', value: 'priority:low' },
    { label: 'No Due Date', value: 'no-due-date' },
    { label: 'Overdue', value: 'overdue' },
    ...availableTags.map((tag) => ({ label: `Tag: ${tag.name}`, value: `tag:${tag.id}` as FilterValue })),
  ];

  return (
    <div className="app-toolbar">
      <button className="toolbar-add-task-btn" onClick={onAddTask}>
        <span className="toolbar-add-task-plus">+</span>
        <span>Add task</span>
      </button>

      <div className="toolbar-actions">
        {openMenu && (
          <div
            onClick={() => setOpenMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
          />
        )}

        <div style={{ position: 'relative' }}>
          <button
            className={`toolbar-btn ${activeFilters.length > 0 || showCompleted ? 'active' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'filter' ? null : 'filter')}
          >
            <Filter size={18} />
            <span>
              {activeFilters.length > 0 ? `Filter: ${activeFilters.length}` : 'Filter'}
            </span>
          </button>

          {openMenu === 'filter' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                minWidth: '200px',
                zIndex: 100,
                marginTop: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={showCompleted}
                  style={{ marginRight: '8px', cursor: 'pointer' }}
                  onChange={(e) => onShowCompletedChange(e.target.checked)}
                />
                Show completed tasks
              </label>
              {filterOptions.map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '13px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={activeFilters.includes(opt.value)}
                    style={{
                      marginRight: '8px',
                      cursor: 'pointer',
                    }}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onFilterChange([...activeFilters, opt.value]);
                      } else {
                        onFilterChange(activeFilters.filter((f) => f !== opt.value));
                      }
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            className="toolbar-btn"
            onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
          >
            <ArrowUpDown size={18} />
            <span>Sort</span>
            <ChevronDown size={14} />
          </button>

          {openMenu === 'sort' && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                minWidth: '180px',
                zIndex: 100,
                marginTop: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {sortOptions.map((opt) => (
                <button
                  key={opt.field}
                  onClick={() => {
                    if (sortField === opt.field) {
                      onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange(opt.field);
                      onSortDirectionChange('asc');
                    }
                    setOpenMenu(null);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    border: 'none',
                    background: sortField === opt.field ? 'var(--accent-soft)' : 'transparent',
                    color: sortField === opt.field ? 'var(--accent)' : 'var(--text)',
                    fontSize: '13px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {opt.label}
                  {sortField === opt.field && (
                    <span style={{ marginLeft: '8px', fontSize: '11px' }}>
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {showSearch ? (
          <input
            type="text"
            placeholder="Search tasks..."
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
            onBlur={() => {
              setShowSearch(false);
              onSearchChange('');
            }}
            className="toolbar-search-input"
          />
        ) : (
          <button className="toolbar-btn" onClick={() => setShowSearch(true)}>
            <Search size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
