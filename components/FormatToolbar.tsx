'use client';

import { useRef, type ClipboardEvent, type DragEvent, type KeyboardEvent, type RefObject } from 'react';
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, ImagePlus } from 'lucide-react';
import { wrapEdit, listEdit, enterEdit, type Edit } from '@/lib/format';
import { uploadTaskPhoto } from '@/lib/taskPhotos';

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

// Uploads the images one by one and drops each in at the cursor, on its own line.
async function insertPhotos(el: HTMLTextAreaElement, taskId: string, files: File[]) {
  for (const file of files) {
    try {
      const token = await uploadTaskPhoto(taskId, file);
      if (!el.isConnected) return; // the box was closed while it uploaded
      const { value, selectionStart: s, selectionEnd: e } = el;
      const text = `${s > 0 && value[s - 1] !== '\n' ? '\n' : ''}${token}\n`;
      apply(el, { start: s, end: e, text, selStart: s + text.length, selEnd: s + text.length });
    } catch (err) {
      window.alert(`Couldn't add that photo: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }
}

const images = (list: FileList | null) => Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));

// Paste or drag a photo straight into a description/comment box: spread onto the textarea.
export function photoEvents(taskId: string) {
  return {
    onPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => {
      // copying from Word/Excel puts a picture of the text on the clipboard too; the text wins
      const files = e.clipboardData.getData('text/plain') ? [] : images(e.clipboardData.files);
      if (!files.length) return;
      e.preventDefault();
      void insertPhotos(e.currentTarget, taskId, files);
    },
    onDrop: (e: DragEvent<HTMLTextAreaElement>) => {
      const files = images(e.dataTransfer.files);
      if (!files.length) return;
      e.preventDefault();
      void insertPhotos(e.currentTarget, taskId, files);
    },
  };
}

// photoTaskId: the task whose folder photos go into; leave it out for a toolbar without the photo button.
export function FormatToolbar({ target, photoTaskId }: { target: RefObject<HTMLTextAreaElement | null>; photoTaskId?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="fmt-toolbar">
      {photoTaskId && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = images(e.target.files);
            e.target.value = ''; // so picking the same photo again still fires
            if (target.current) void insertPhotos(target.current, photoTaskId, files);
          }}
        />
      )}
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
      {photoTaskId && (
        <button
          type="button"
          title="Add a photo"
          aria-label="Add a photo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={14} />
        </button>
      )}
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
