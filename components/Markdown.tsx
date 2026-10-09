import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { PHOTO_PATTERN, photoPath, taskPhotoUrl } from '@/lib/taskPhotos';

// Renders the markdown-lite written via FormatToolbar (see lib/format). Builds React nodes, never HTML,
// so user text can't inject markup. ponytail: no nesting/links/headings; swap for a real parser if needed.
const INLINE = new RegExp(`(${PHOTO_PATTERN}|\\*\\*[^*\\n]+\\*\\*|~~[^~\\n]+~~|\`[^\`\\n]+\`|\\*[^*\\s\\n][^*\\n]*\\*)`, 'g');
const URL = /(https?:\/\/[^\s<>"']+)/gi;

// A photo from the private bucket, shown through a signed link; click opens it full size.
function Photo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    taskPhotoUrl(path).then(
      (u) => current && setUrl(u),
      () => current && setUrl(null)
    );
    return () => {
      current = false;
    };
  }, [path]);
  if (url === undefined) return <span className="md-photo is-loading" />;
  if (url === null) return <span className="md-photo-missing">[photo unavailable]</span>;
  return (
    // stopPropagation: clicking a photo in the description shouldn't also open the editor
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed link to a private bucket */}
      <img className="md-photo" src={url} alt="Photo" />
    </a>
  );
}

function linkify(text: string, plain: (s: string) => ReactNode) {
  return text.split(URL).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{plain(part)}</Fragment>;
    const href = part.replace(/[.,!?;:)\]}]+$/, '');
    const trailing = part.slice(href.length);
    return (
      <Fragment key={i}>
        <a href={href} target="_blank" rel="noopener noreferrer">{plain(href)}</a>
        {plain(trailing)}
      </Fragment>
    );
  });
}

function inline(text: string, plain: (s: string) => ReactNode) {
  return text.split(INLINE).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{linkify(part, plain)}</Fragment>;
    if (part.startsWith('![')) return <Photo key={i} path={photoPath(part)} />;
    if (part.startsWith('**')) return <strong key={i}>{linkify(part.slice(2, -2), plain)}</strong>;
    if (part.startsWith('~~')) return <s key={i}>{linkify(part.slice(2, -2), plain)}</s>;
    if (part[0] === '`') return <code key={i}>{part.slice(1, -1)}</code>;
    return <em key={i}>{linkify(part.slice(1, -1), plain)}</em>;
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
