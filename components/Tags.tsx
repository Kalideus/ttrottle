'use client';

import { X } from 'lucide-react';
import { Tag } from '@/src/lib/types';

interface TagsProps {
  tags: Tag[];
  onTagRemove?: (tagId: string) => void;
  variant?: 'default' | 'small' | 'inline';
}

export function Tags({ tags, onTagRemove, variant = 'default' }: TagsProps) {
  if (tags.length === 0) return null;

  const sizes = {
    default: { padding: '6px 12px', fontSize: '13px' },
    small: { padding: '4px 8px', fontSize: '12px' },
    inline: { padding: '2px 6px', fontSize: '11px' },
  };

  const size = sizes[variant];

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {tags.map((tag) => (
        <div
          key={tag.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: size.padding,
            borderRadius: '12px',
            backgroundColor: tag.color,
            opacity: 0.1,
            border: `1px solid ${tag.color}`,
            fontSize: size.fontSize,
            fontWeight: 500,
            color: tag.color,
          }}
        >
          {tag.name}
          {onTagRemove && (
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
                opacity: 0.7,
              }}
              title="Remove tag"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
