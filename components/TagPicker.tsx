'use client';

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import type { Tag } from '@/lib/supabase/queries';

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface TagPickerProps {
  selectedTags: Tag[];
  availableTags: Tag[];
  onTagAdd: (tag: Tag) => void;
  onTagRemove: (tagId: string) => void;
  onNewTag?: (name: string, color: string) => Promise<void>;
}

export function TagPicker({
  selectedTags,
  availableTags,
  onTagAdd,
  onTagRemove,
  onNewTag,
}: TagPickerProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#4573D2');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unselectedTags = availableTags.filter((tag) => !selectedTags.some((st) => st.id === tag.id));

  const handleNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !onNewTag || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onNewTag(newTagName, newTagColor);
      setNewTagName('');
      setNewTagColor('#4573D2');
      setShowNewTagForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {selectedTags.map((tag) => (
          <div
            key={tag.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: hexToRgba(tag.color, 0.15),
              fontSize: '12px',
              fontWeight: 500,
              color: tag.color,
            }}
          >
            {tag.name}
            <button
              onClick={() => onTagRemove(tag.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0 2px',
                display: 'flex',
                alignItems: 'center',
                color: tag.color,
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '13px',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Plus size={14} />
        Add tags
      </button>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            zIndex: 100,
            marginTop: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {unselectedTags.length > 0 ? (
            <>
              {unselectedTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    onTagAdd(tag);
                    setShowDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: tag.color,
                    }}
                  />
                  {tag.name}
                </button>
              ))}
            </>
          ) : null}

          <button
            onClick={() => setShowNewTagForm(!showNewTagForm)}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '13px',
              color: 'var(--accent)',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={14} />
            New tag
          </button>

          {showNewTagForm && (
            <form
              onSubmit={handleNewTag}
              style={{
                padding: '12px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <input
                type="text"
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                autoFocus
                style={{
                  padding: '6px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'var(--text)',
                }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {['#4573D2', '#FF8F8F', '#FFA766', '#FFD15E', '#4CAF50'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: newTagColor === color ? '2px solid white' : '1px solid rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={!newTagName.trim() || isSubmitting}
                style={{
                  padding: '6px 12px',
                  background: newTagName.trim() ? 'var(--accent)' : 'var(--chrome-hover)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: newTagName.trim() ? 'pointer' : 'not-allowed',
                  opacity: newTagName.trim() ? 1 : 0.5,
                }}
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
