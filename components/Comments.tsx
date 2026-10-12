'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Trash2, MoreVertical } from 'lucide-react';
import { avatarStyle, avatarInitials } from '@/lib/avatar';
import { formatDay } from '@/lib/dates';
import { MemberAvatar } from '@/components/PeoplePicker';
import type { ProjectMember } from '@/lib/supabase/queries';
import { flipIfOffscreen } from '@/lib/flipIfOffscreen';
import { autoGrow } from '@/lib/autoGrow';
import { handle, mentioned, extractMentions } from '@/lib/mentions';
import { FormatToolbar, formatKeyDown, photoEvents } from './FormatToolbar';
import { Markdown } from './Markdown';

export interface CommentItem {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor?: string | null;
  authorAvatarUrl?: string | null;
  body: string;
  createdAt: string;
  editedAt?: string;
  likes: number;
  liked: boolean;
  likedBy: string[];
  isOwn: boolean;
  requestedDueDate?: string | null;
  requestStatus?: 'pending' | 'approved' | 'declined' | null;
}

interface CommentsProps {
  taskId: string;
  comments: CommentItem[];
  mentionableUsers: { id: string; name: string; member?: ProjectMember }[];
  onCommentAdd: (body: string, mentions: string[]) => Promise<void>;
  onCommentEdit: (commentId: string, body: string, newMentions?: string[]) => Promise<void>;
  onCommentDelete: (commentId: string) => Promise<void>;
  onCommentLike: (commentId: string) => Promise<void>;
  // project managers answer extension requests on a locked due date
  canAnswerRequests?: boolean;
  /** Shown just above the comment box (the task panel puts its followers here). */
  aboveComposer?: React.ReactNode;
  onRequestAnswer?: (commentId: string, approve: boolean) => void;
  loading?: boolean;
}

function formatCommentTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const day = date.getDate();
  const suffix = day % 100 >= 11 && day % 100 <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th');
  const dateLabel = `${day}${suffix} ${date.toLocaleString('en-GB', { month: 'short' })} ${date.getFullYear()}`;
  const timeLabel = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel}, ${timeLabel}`;
}

// Active "@partial" the cursor is currently sitting inside, if any -- must
// be preceded by whitespace/start-of-string so an email address's "@" (or
// one mid-word) doesn't trigger it.
function activeMentionAt(value: string, cursor: number): { start: number; query: string } | null {
  const before = value.slice(0, cursor);
  const match = before.match(/(?:^|\s)@([a-zA-Z0-9'_-]*)$/);
  if (!match) return null;
  return { start: cursor - match[1].length - 1, query: match[1] };
}

// Highlights "@name" tokens that actually resolve to a real project member
// (same rule as extractMentions) -- an "@" that doesn't match anyone stays
// plain text rather than being colored as if it worked.
export function renderBody(body: string, users: { id: string; name: string }[]) {
  return body.split(/(@[a-zA-Z][\w'-]*)/g).map((part, i) => {
    if (part[0] === '@' && mentioned(part, users)) {
      return (
        // no padding or bold: the composer draws this under its textarea, so the chip can't change the text's width
        <span key={i} style={{ color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 4, boxShadow: '0 0 0 2px var(--accent-soft)' }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

// The "@name" picker for a textarea: its dropdown and the keys that drive it.
// Shared by the comment box and the task description.
export function useMentionPicker(
  users: CommentsProps['mentionableUsers'],
  value: string,
  setValue: (value: string) => void,
  input: { current: HTMLTextAreaElement | null },
  marginTop = -4
) {
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = mention
    ? users
        // any part of the name: "@cor" finds Tom Cornish, as well as "@tomc"
        .filter((u) => [handle(u.name), ...u.name.split(/\s+/)].some((w) => w.toLowerCase().startsWith(mention.query.toLowerCase())))
        .slice(0, 6)
    : [];

  const track = (text: string, cursor: number) => {
    setMention(activeMentionAt(text, cursor));
    setActiveIndex(0);
  };

  const select = (user: { id: string; name: string }) => {
    if (!mention) return;
    const insertion = `@${handle(user.name)} `;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.start + 1 + mention.query.length);
    setValue(before + insertion + after);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      input.current?.focus();
      input.current?.setSelectionRange(pos, pos);
    });
  };

  // true while the picker is open: the key was its to handle, so the caller leaves it alone
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mention || !matches.length) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      select(matches[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMention(null);
    }
    return true;
  };

  const dropdown = mention && matches.length > 0 && (
    <div
      ref={flipIfOffscreen}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop,
        zIndex: 50,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '4px 0',
        overflow: 'hidden',
      }}
    >
      {matches.map((u, i) => (
        <button
          key={u.id}
          type="button"
          // onMouseDown, not onClick: fires before the textarea's onBlur, so the
          // dropdown doesn't close (and unmount this button) first.
          onMouseDown={(e) => {
            e.preventDefault();
            select(u);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            textAlign: 'left',
            padding: '7px 12px',
            border: 'none',
            background: i === activeIndex ? 'var(--surface-alt)' : 'transparent',
            color: 'var(--text)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          {u.member ? (
            <MemberAvatar member={u.member} size={24} />
          ) : (
            <span className="ct-avatar" style={{ width: 24, height: 24, fontSize: 11, ...avatarStyle() }} aria-hidden>
              {avatarInitials(u.name)}
            </span>
          )}
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{u.name}</span>
          <span style={{ flex: 1, minWidth: 0, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            @{handle(u.name)}
          </span>
          {i === activeIndex && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>Enter</span>
          )}
        </button>
      ))}
    </div>
  );

  return { track, onKeyDown, close: () => setMention(null), dropdown };
}

export function Comments({
  taskId,
  comments,
  mentionableUsers,
  onCommentAdd,
  onCommentEdit,
  onCommentDelete,
  onCommentLike,
  canAnswerRequests = false,
  aboveComposer,
  onRequestAnswer,
  loading = false,
}: CommentsProps) {
  const [composerValue, setComposerValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const picker = useMentionPicker(mentionableUsers, composerValue, setComposerValue, composerRef);

  // Grow with the text (wrapped lines too), and shrink back after sending
  useEffect(() => {
    const el = composerRef.current;
    autoGrow(el);
    // once the box scrolls, its scrollbar narrows the text: wrap the chip layer at the same width
    if (el && backdropRef.current) backdropRef.current.style.paddingRight = `${12 + el.offsetWidth - el.clientWidth - 2}px`;
  }, [composerValue]);

  const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComposerValue(value);
    picker.track(value, e.target.selectionStart);
  };

  const submitComment = async () => {
    if (!composerValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCommentAdd(composerValue, extractMentions(composerValue, mentionableUsers));
      setComposerValue('');
      picker.close();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submitComment();
      return;
    }
    if (!picker.onKeyDown(e)) formatKeyDown(e);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitComment();
  };

  const handleEditStart = (comment: CommentItem) => {
    setEditingId(comment.id);
    setEditingValue(comment.body);
  };

  const handleEditSave = async (commentId: string) => {
    if (!editingValue.trim()) return;
    // people @mentioned by the edit who weren't before: they're told, like in a new comment
    const before = extractMentions(comments.find((c) => c.id === commentId)?.body ?? '', mentionableUsers);
    const added = extractMentions(editingValue, mentionableUsers).filter((id) => !before.includes(id));
    await onCommentEdit(commentId, editingValue, added);
    setEditingId(null);
  };

  return (
    <div className="detail-comments">
      <div className="detail-comments-label">Comments ({comments.length})</div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading comments...
        </div>
      ) : (
        <>
          {comments.length > 0 ? (
            <div className="comment-thread">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  id={`comment-${comment.id}`}
                  style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      ...avatarStyle(comment.authorAvatarUrl, comment.authorColor),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {comment.authorInitials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px' }}>{comment.authorName}</strong>
                      <time
                        dateTime={comment.createdAt}
                        style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                      >
                        {formatCommentTimestamp(comment.createdAt)}
                      </time>
                      {comment.editedAt && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          (edited)
                        </span>
                      )}
                    </div>

                    {editingId === comment.id ? (
                      <>
                      <FormatToolbar target={editRef} photoTaskId={taskId} />
                      <textarea
                        autoFocus
                        {...photoEvents(taskId)}
                        ref={(el) => {
                          editRef.current = el;
                          autoGrow(el);
                        }}
                        onInput={(e) => autoGrow(e.currentTarget)}
                        onKeyDown={formatKeyDown}
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          color: 'var(--text)',
                          marginBottom: '8px',
                          maxHeight: '40vh',
                        }}
                      />
                      </>
                    ) : (
                      <div
                        style={{
                          fontSize: '14px',
                          lineHeight: 1.5,
                          color: 'var(--text)',
                          marginBottom: '8px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        <Markdown text={comment.body} plain={(s) => renderBody(s, mentionableUsers)} />
                      </div>
                    )}

                    {comment.requestedDueDate && (
                      <div className={`extension-request is-${comment.requestStatus ?? 'pending'}`}>
                        <span>
                          📅 Asked to move the due date to{' '}
                          <b>{formatDay(comment.requestedDueDate)}</b>
                          {' · '}
                          {comment.requestStatus === 'approved' ? 'Approved' : comment.requestStatus === 'declined' ? 'Declined' : 'Waiting for a manager'}
                        </span>
                        {comment.requestStatus === 'pending' && canAnswerRequests && onRequestAnswer && (
                          <span style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="modal-btn primary" onClick={() => onRequestAnswer(comment.id, true)}>Approve</button>
                            <button type="button" className="modal-btn ghost" onClick={() => onRequestAnswer(comment.id, false)}>Decline</button>
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <button
                        onClick={() => onCommentLike(comment.id)}
                        title={comment.likedBy.map((id) => mentionableUsers.find((u) => u.id === id)?.name ?? 'Someone').join(', ') || undefined}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: comment.liked ? 'var(--accent)' : 'var(--text-muted)',
                          fontSize: '12px',
                        }}
                      >
                        <Heart size={14} fill={comment.liked ? 'currentColor' : 'none'} />
                        {comment.likes > 0 && comment.likes}
                      </button>

                      {/* always shown, not on hover: a touch screen has no hover */}
                      {comment.isOwn && (
                        <>
                          {editingId === comment.id ? (
                            <>
                              <button
                                onClick={() => handleEditSave(comment.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--accent)',
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditStart(comment)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onCommentDelete(comment.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No comments yet. Start a conversation!
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        {aboveComposer && <div style={{ marginBottom: 12 }}>{aboveComposer}</div>}

        <form onSubmit={handleSubmit}>
          <FormatToolbar target={composerRef} photoTaskId={taskId} />
          <div style={{ position: 'relative' }}>
            {/* ponytail: the text is drawn here, with @mentions as chips, under a see-through textarea.
                A chip is still plain "@TomC" text to the keyboard; a real rich editor is the upgrade if it must act as one unit. */}
            <div
              ref={backdropRef}
              className="mention-backdrop"
              aria-hidden
              style={{
                position: 'absolute',
                inset: '0 0 8px 0',
                padding: '12px',
                border: '1px solid transparent',
                borderRadius: '8px',
                background: 'var(--surface)',
                fontSize: '14px',
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                overflow: 'hidden',
              }}
            >
              {renderBody(composerValue, mentionableUsers)}
              {'\n'}
            </div>
            <textarea
              ref={composerRef}
              className="mention-input"
              {...photoEvents(taskId)}
              value={composerValue}
              onChange={handleComposerChange}
              onScroll={(e) => {
                if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              onSelect={(e) => picker.track(composerValue, e.currentTarget.selectionStart)}
              onKeyDown={handleComposerKeyDown}
              onBlur={() => setTimeout(picker.close, 150)}
              rows={1}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                position: 'relative',
                display: 'block',
                background: 'transparent',
                color: 'transparent',
                caretColor: 'var(--text)',
                resize: 'vertical',
                marginBottom: '8px',
                maxHeight: '40vh',
              }}
              placeholder="Add a comment…"
            />

            {picker.dropdown}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{mentionableUsers.length > 0 && <>@name to mention &middot; </>}⌘/Ctrl+Enter to send</div>
            <button
              type="submit"
              disabled={!composerValue.trim() || isSubmitting}
              style={{
                height: '32px',
                borderRadius: '6px',
                background: composerValue.trim() ? 'var(--accent)' : 'var(--chrome-hover)',
                color: 'white',
                border: 'none',
                padding: '0 12px',
                cursor: composerValue.trim() ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: 500,
                opacity: composerValue.trim() ? 1 : 0.5,
              }}
            >
              {isSubmitting ? 'Sending...' : 'Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
