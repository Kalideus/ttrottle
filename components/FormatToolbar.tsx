'use client';

import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type RefObject } from 'react';
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, ImagePlus, Paperclip, Smile } from 'lucide-react';
import { wrapEdit, listEdit, enterEdit, emojiEdit, type Edit } from '@/lib/format';
import { uploadTaskPhoto, uploadTaskFile } from '@/lib/taskPhotos';
import { FILE_ACCEPT, fileExt } from '@/lib/taskFiles';

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

const EMOJI = ['👍', '👎', '❤️', '😄', '🙂', '😂', '😉', '😮', '😢', '🙏', '👏', '🎉', '🔥', '✅', '❌', '👀'];

// Uploads the photos and documents one by one and drops each in at the cursor, on its own line.
async function insertPhotos(el: HTMLTextAreaElement, taskId: string, files: File[]) {
  for (const file of files) {
    try {
      const token = await (isImage(file) ? uploadTaskPhoto : uploadTaskFile)(taskId, file);
      if (!el.isConnected) return; // the box was closed while it uploaded
      const { value, selectionStart: s, selectionEnd: e } = el;
      const text = `${s > 0 && value[s - 1] !== '\n' ? '\n' : ''}${token}\n`;
      apply(el, { start: s, end: e, text, selStart: s + text.length, selEnd: s + text.length });
    } catch (err) {
      window.alert(`Couldn't add ${file.name || 'that photo'}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }
}

const isImage = (f: File) => f.type.startsWith('image/');
// photos, and the documents that can be attached (PDF, Word, Excel); anything else is left to the browser
const images = (list: FileList | null) => Array.from(list ?? []).filter((f) => isImage(f) || fileExt(f.name));

// Paste or drag a photo or document straight into a description/comment box: spread onto the textarea.
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  // one hidden picker for both buttons: each sets what it offers before opening it
  const pick = (accept: string) => {
    if (!fileRef.current) return;
    fileRef.current.accept = accept;
    fileRef.current.click();
  };
  return (
    <div className="fmt-toolbar" style={{ position: 'relative' }}>
      {photoTaskId && (
        <input
          ref={fileRef}
          type="file"
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
      <button
        type="button"
        title="Emoji (or type <3, :) or :D then a space)"
        aria-label="Emoji"
        aria-expanded={emojiOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setEmojiOpen((o) => !o)}
      >
        <Smile size={14} />
      </button>
      {emojiOpen && (
        <>
          {/* a press anywhere else closes it */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onMouseDown={() => setEmojiOpen(false)} />
          <div
            role="menu"
            style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 41, display: 'grid', gridTemplateColumns: 'repeat(8, 32px)',
              padding: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitem"
                aria-label={emoji}
                style={{ width: 32, height: 32, fontSize: 18 }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const el = target.current;
                  if (el) apply(el, { start: el.selectionStart, end: el.selectionEnd, text: emoji, selStart: el.selectionStart + emoji.length, selEnd: el.selectionStart + emoji.length });
                  setEmojiOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
      {photoTaskId && (
        <button
          type="button"
          title="Add a photo (kept until 180 days after the task is completed)"
          aria-label="Add a photo"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick('image/*')}
        >
          <ImagePlus size={14} />
        </button>
      )}
      {photoTaskId && (
        <button
          type="button"
          title="Attach a PDF, Word or Excel file (up to 10 MB; kept until 180 days after the task is completed)"
          aria-label="Attach a file"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pick(FILE_ACCEPT)}
        >
          <Paperclip size={14} />
        </button>
      )}
    </div>
  );
}

// Ctrl/⌘+B, Ctrl/⌘+I, list continuation on Enter, and "<3 " to ❤️. Returns true if it handled the key.
export function formatKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
  const el = e.currentTarget;
  const { value, selectionStart: s, selectionEnd: end } = el;
  const mod = e.metaKey || e.ctrlKey;
  const edit =
    mod && e.key === 'b' ? wrapEdit(value, s, end, '**')
    : mod && e.key === 'i' ? wrapEdit(value, s, end, '*')
    : e.key === 'Enter' && !mod && !e.shiftKey ? enterEdit(value, s, end)
    : e.key === ' ' && !mod ? emojiEdit(value, s, end)
    : null;
  if (!edit) return false;
  e.preventDefault();
  apply(el, edit);
  return true;
}
