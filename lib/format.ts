// Markdown-lite editing for the description and comment boxes: **bold**, *italic*,
// ~~strike~~, `code`, "- " and "1. " lists. Each helper returns a replacement of
// value[start, end) plus the selection to restore afterwards (rendered by components/Markdown).
export type Edit = { start: number; end: number; text: string; selStart: number; selEnd: number };

const LIST_PREFIX = /^([-*]|\d+\.) /;

// Wrap the selection in `mark`, or unwrap it if it's already wrapped.
export function wrapEdit(value: string, s: number, e: number, mark: string): Edit {
  while (e > s && /\s/.test(value[e - 1])) e--; // double-click on Windows grabs the trailing space
  const m = mark.length;
  if (value.slice(s - m, s) === mark && value.slice(e, e + m) === mark) {
    return { start: s - m, end: e + m, text: value.slice(s, e), selStart: s - m, selEnd: e - m };
  }
  return { start: s, end: e, text: mark + value.slice(s, e) + mark, selStart: s + m, selEnd: e + m };
}

// Toggle the selected lines in/out of a bulleted or numbered list.
export function listEdit(value: string, s: number, e: number, kind: 'ul' | 'ol'): Edit {
  const start = value.lastIndexOf('\n', s - 1) + 1;
  let end = value.indexOf('\n', e);
  if (end < 0) end = value.length;
  const lines = value.slice(start, end).split('\n');
  const re = kind === 'ul' ? /^[-*] / : /^\d+\. /;
  const on = lines.every((l) => re.test(l));
  const text = lines
    .map((l, i) => {
      const bare = l.replace(LIST_PREFIX, '');
      return on ? bare : (kind === 'ul' ? '- ' : `${i + 1}. `) + bare;
    })
    .join('\n');
  const caret = start + text.length;
  return { start, end, text, selStart: lines.length > 1 ? start : caret, selEnd: caret };
}

// Enter inside a list item starts the next item; Enter on an empty item ends the list.
export function enterEdit(value: string, s: number, e: number): Edit | null {
  if (s !== e) return null;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  let lineEnd = value.indexOf('\n', s);
  if (lineEnd < 0) lineEnd = value.length;
  const m = value.slice(lineStart, s).match(LIST_PREFIX);
  if (!m) return null;
  if (value.slice(lineStart, lineEnd) === m[0]) {
    return { start: lineStart, end: lineEnd, text: '', selStart: lineStart, selEnd: lineStart };
  }
  const text = '\n' + (/\d/.test(m[1]) ? `${parseInt(m[1], 10) + 1}. ` : `${m[1]} `);
  return { start: s, end: s, text, selStart: s + text.length, selEnd: s + text.length };
}
