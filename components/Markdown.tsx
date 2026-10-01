import { Fragment, type ReactNode } from 'react';

// Renders the markdown-lite written via FormatToolbar (see lib/format). Builds React nodes, never HTML,
// so user text can't inject markup. ponytail: no nesting/links/headings; swap for a real parser if needed.
const INLINE = /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\*[^*\s\n][^*\n]*\*)/g;

function inline(text: string, plain: (s: string) => ReactNode) {
  return text.split(INLINE).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{plain(part)}</Fragment>;
    if (part.startsWith('**')) return <strong key={i}>{plain(part.slice(2, -2))}</strong>;
    if (part.startsWith('~~')) return <s key={i}>{plain(part.slice(2, -2))}</s>;
    if (part[0] === '`') return <code key={i}>{part.slice(1, -1)}</code>;
    return <em key={i}>{plain(part.slice(1, -1))}</em>;
  });
}

export function Markdown({ text, plain = (s) => s }: { text: string; plain?: (s: string) => ReactNode }) {
  const blocks: { kind: 'ul' | 'ol' | 'p'; lines: string[] }[] = [];
  for (const line of text.split('\n')) {
    const kind = /^[-*] /.test(line) ? 'ul' : /^\d+\. /.test(line) ? 'ol' : 'p';
    const last = blocks[blocks.length - 1];
    if (last?.kind === kind) last.lines.push(line);
    else blocks.push({ kind, lines: [line] });
  }
  return (
    <div className="md">
      {blocks.map((b, i) => {
        if (b.kind === 'p') return <div key={i}>{inline(b.lines.join('\n'), plain)}</div>;
        const items = b.lines.map((l, j) => <li key={j}>{inline(l.replace(/^([-*]|\d+\.) /, ''), plain)}</li>);
        return b.kind === 'ul' ? <ul key={i}>{items}</ul> : <ol key={i} start={parseInt(b.lines[0], 10)}>{items}</ol>;
      })}
    </div>
  );
}
