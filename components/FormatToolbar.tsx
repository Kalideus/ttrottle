'use client';

import type { KeyboardEvent, RefObject } from 'react';
import { Bold, Italic, Strikethrough, Code, List, ListOrdered } from 'lucide-react';
import { wrapEdit, listEdit, enterEdit, type Edit } from '@/lib/format';

function apply(el: HTMLTextAreaElement, edit: Edit) {
  el.focus();
  el.setSelectionRange(edit.start, edit.end);
  // execCommand keeps native undo and fires `input` (so React's onChange runs); fallback if refused
  if (!document.execCommand(edit.text ? 'insertText' : 'delete', false, edit.text)) {
    el.setRangeText(edit.text, edit.start, edit.end);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.setSelectionRange(edit.selStart, edit.selEnd);
}

type Run = (v: string, s: number, e: number) => Edit;
const TOOLS: { icon: typeof Bold; label: string; run: Run }[] = [
  { icon: Bold, label: 'Bold (Ctrl+B)', run: (v, s, e) => wrapEdit(v, s, e, '**') },
  { icon: Italic, label: 'Italic (Ctrl+I)', run: (v, s, e) => wrapEdit(v, s, e, '*') },
  { icon: Strikethrough, label: 'Strikethrough', run: (v, s, e) => wrapEdit(v, s, e, '~~') },
  { icon: Code, label: 'Code', run: (v, s, e) => wrapEdit(v, s, e, '`') },
  { icon: List, label: 'Bulleted list', run: (v, s, e) => listEdit(v, s, e, 'ul') },
  { icon: ListOrdered, label: 'Numbered list', run: (v, s, e) => listEdit(v, s, e, 'ol') },
];

export function FormatToolbar({ target }: { target: RefObject<HTMLTextAreaElement | null> }) {
  return (
    <div className="fmt-toolbar">
      {TOOLS.map(({ icon: Icon, label, run }) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          // preventDefault keeps focus (and the selection) in the textarea, so the description doesn't blur-save
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const el = target.current;
            if (el) apply(el, run(el.value, el.selectionStart, el.selectionEnd));
          }}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

// Ctrl/⌘+B, Ctrl/⌘+I, and list continuation on Enter. Returns true if it handled the key.
export function formatKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
  const el = e.currentTarget;
  const { value, selectionStart: s, selectionEnd: end } = el;
  const mod = e.metaKey || e.ctrlKey;
  const edit =
    mod && e.key === 'b' ? wrapEdit(value, s, end, '**')
    : mod && e.key === 'i' ? wrapEdit(value, s, end, '*')
    : e.key === 'Enter' && !mod && !e.shiftKey ? enterEdit(value, s, end)
    : null;
  if (!edit) return false;
  e.preventDefault();
  apply(el, edit);
  return true;
}
