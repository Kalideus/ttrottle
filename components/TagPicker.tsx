'use client';

import { useState } from 'react';
import { X, Plus, Pencil } from 'lucide-react';
import type { Tag } from '@/lib/supabase/queries';
import { flipIfOffscreen } from '@/lib/flipIfOffscreen';

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
  /** Renames the tag everywhere (tags are shared by every project). */
  onTagRename?: (tagId: string, name: string) => void;
}

export function TagPicker({
  selectedTags,
  availableTags,
  onTagAdd,
  onTagRemove,
  onNewTag,
  onTagRename,
}: TagPickerProps) {
  // a tag being renamed: from its chip on the task, or the pencil in the list
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const renameTo = renaming?.draft.trim() ?? '';
  // names are unique (the database refuses a twin), so a clash is shown instead of saved
  const renameClash = !!renaming && availableTags.some((t) => t.id !== renaming.id && t.name.toLowerCase() === renameTo.toLowerCase());
  const saveRename = () => {
    if (!renaming || renameClash) return;
    const old = availableTags.find((t) => t.id === renaming.id)?.name;
    if (renameTo && renameTo !== old) onTagRename?.(renaming.id, renameTo);
    setRenaming(null);
  };
  const renameInput = (tag: Tag) => (
    <input
      autoFocus
      aria-label={`Rename tag ${tag.name}`}
      value={renaming?.draft ?? ''}
      onChange={(e) => setRenaming({ id: tag.id, draft: e.target.value })}
      onBlur={() => (renameClash ? setRenaming(null) : saveRename())}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveRename();
        } else if (e.key === 'Escape') {
          e.stopPropagation(); // cancel the rename, not close the task panel
          setRenaming(null);
        }
      }}
      title={renameClash ? 'There is already a tag with that name' : 'Enter to save, Esc to cancel'}
      style={{
        flex: 1,
        minWidth: '80px',
        padding: '2px 6px',
        fontSize: '12px',
        color: 'var(--text)',
        border: `1px solid ${renameClash ? '#D64545' : 'var(--border-strong)'}`,
        borderRadius: '4px',
      }}
    />
  );
  const [showDropdown, setShowDropdown] = useState(false);
  // what's typed in the dropdown's box: filters the tags, and names a new one if none matches
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#4573D2');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typed = newTagName.trim();
  const unselectedTags = availableTags.filter(
    (tag) => !selectedTags.some((st) => st.id === tag.id) && tag.name.toLowerCase().includes(typed.toLowerCase())
  );
  // already a tag by that name (on this task or not): pick it rather than make a twin
  const canCreate = !!onNewTag && !!typed && !availableTags.some((t) => t.name.toLowerCase() === typed.toLowerCase());

  const close = () => {
    setShowDropdown(false);
    setNewTagName('');
  };

  const pick = (tag: Tag) => {
    onTagAdd(tag);
    close();
  };

  const handleNewTag = async () => {
    if (!canCreate || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onNewTag!(typed, newTagColor);
      setNewTagColor('#4573D2');
      close();
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
            {renaming?.id === tag.id ? renameInput(tag) : tag.name}
            {onTagRename && renaming?.id !== tag.id && (
              <button
                type="button"
                aria-label={`Rename tag ${tag.name}`}
                title="Rename (everywhere it's used)"
                onClick={() => setRenaming({ id: tag.id, draft: tag.name })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center', color: tag.color }}
              >
                <Pencil size={11} />
              </button>
            )}
            <button
              aria-label={`Remove tag ${tag.name}`}
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
        onClick={() => (showDropdown ? close() : setShowDropdown(true))}
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
          ref={flipIfOffscreen}
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
          <input
            type="text"
            placeholder={onNewTag ? 'Type a tag, or a new one…' : 'Type a tag…'}
            aria-label="Tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (unselectedTags[0]) pick(unselectedTags[0]);
                else void handleNewTag();
              } else if (e.key === 'Escape') {
                e.stopPropagation(); // close the list, not the task panel around it
                close();
              }
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              fontSize: '13px',
              color: 'var(--text)',
              background: 'transparent',
              outline: 'none',
            }}
          />
          {unselectedTags.length > 0 ? (
            <>
              {unselectedTags.map((tag) => (
                <div key={tag.id} className="tag-option" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                  {renaming?.id === tag.id ? (
                    <div style={{ flex: 1, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: tag.color, flexShrink: 0 }} />
                      {renameInput(tag)}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => pick(tag)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '10px 12px',
                          border: 'none',
                          background: 'transparent',
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
                      {onTagRename && (
                        <button
                          type="button"
                          className="tag-option-rename"
                          aria-label={`Rename tag ${tag.name}`}
                          title="Rename (everywhere it's used)"
                          onClick={() => setRenaming({ id: tag.id, draft: tag.name })}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px 12px', color: 'var(--text-muted)', display: 'flex' }}
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </>
          ) : null}

          {canCreate && (
            <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => void handleNewTag()}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: 0,
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
                {isSubmitting ? 'Creating…' : `Create “${typed}”`}
              </button>
              {['#4573D2', '#FF8F8F', '#FFA766', '#FFD15E', '#4CAF50'].map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Colour ${color}`}
                  aria-pressed={newTagColor === color}
                  onClick={() => setNewTagColor(color)}
                  style={{
                    width: '18px',
                    height: '18px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: newTagColor === color ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}
          {!canCreate && unselectedTags.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {!typed ? 'No more tags' : selectedTags.some((t) => t.name.toLowerCase() === typed.toLowerCase()) ? 'Already on this task' : 'No matching tag'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
