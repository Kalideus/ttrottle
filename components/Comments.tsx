'use client';

import { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Trash2, MoreVertical } from 'lucide-react';
import { avatarStyle } from '@/lib/avatar';
import { MemberAvatar } from '@/components/PeoplePicker';
import type { ProjectMember } from '@/lib/supabase/queries';
import { flipIfOffscreen } from '@/lib/flipIfOffscreen';
import { autoGrow } from '@/lib/autoGrow';
import { FormatToolbar, formatKeyDown } from './FormatToolbar';
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
  isOwn: boolean;
  requestedDueDate?: string | null;
  requestStatus?: 'pending' | 'approved' | 'declined' | null;
}

interface CommentsProps {
  taskId: string;
  comments: CommentItem[];
  mentionableUsers: { id: string; name: string; member?: ProjectMember }[];
  onCommentAdd: (body: string, mentions: string[]) => Promise<void>;
  onCommentEdit: (commentId: string, body: string) => Promise<void>;
  onCommentDelete: (commentId: string) => Promise<void>;
  onCommentLike: (commentId: string) => Promise<void>;
  // project managers answer extension requests on a locked due date
  canAnswerRequests?: boolean;
  /** Shown just above the comment box (the task panel puts its followers here). */
  aboveComposer?: React.ReactNode;
  onRequestAnswer?: (commentId: string, approve: boolean) => void;
  loading?: boolean;
}

// "@name" only matches a single word, so this only requires (and only
// supports) matching on someone's first name -- good enough for a small
// team. Doesn't disambiguate two people sharing a first name (first match
// wins); add last-name matching if that becomes a real problem.
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

function extractMentions(body: string, users: { id: string; name: string }[]): string[] {
  const tokens = body.match(/@([a-zA-Z][\w'-]*)/g) ?? [];
  const ids = new Set<string>();
  for (const token of tokens) {
    const needle = token.slice(1).toLowerCase();
    const match = users.find((u) => firstName(u.name).toLowerCase() === needle);
    if (match) ids.add(match.id);
  }
  return Array.from(ids);
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
function renderBody(body: string, users: { id: string; name: string }[]) {
  return body.split(/(@[a-zA-Z][\w'-]*)/g).map((part, i) => {
    if (part[0] === '@' && users.some((u) => firstName(u.name).toLowerCase() === part.slice(1).toLowerCase())) {
      return (
        <span key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>
          {part}
        </span>
      );
    }
    return part;
  });
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
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  // Grow with the text (wrapped lines too), and shrink back after sending
  useEffect(() => autoGrow(composerRef.current), [composerValue]);

  const mentionMatches = mention
    ? mentionableUsers
        .filter((u) => firstName(u.name).toLowerCase().startsWith(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

  const updateMentionState = (value: string, cursor: number) => {
    setMention(activeMentionAt(value, cursor));
    setActiveMentionIndex(0);
  };

  const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComposerValue(value);
    updateMentionState(value, e.target.selectionStart);
  };

  const selectMention = (user: { id: string; name: string }) => {
    if (!mention) return;
    const insertion = `@${firstName(user.name)} `;
    const before = composerValue.slice(0, mention.start);
    const after = composerValue.slice(mention.start + 1 + mention.query.length);
    const next = before + insertion + after;
    setComposerValue(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(pos, pos);
    });
  };

  const submitComment = async () => {
    if (!composerValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCommentAdd(composerValue, extractMentions(composerValue, mentionableUsers));
      setComposerValue('');
      setMention(null);
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
    if (!mention || !mentionMatches.length) {
      formatKeyDown(e);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveMentionIndex((i) => (i + 1) % mentionMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectMention(mentionMatches[activeMentionIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMention(null);
    }
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
    await onCommentEdit(commentId, editingValue);
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
                  style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}
                  onMouseEnter={() => setHoveredCommentId(comment.id)}
                  onMouseLeave={() => setHoveredCommentId(null)}
                >
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
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>now</span>
                      {comment.editedAt && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          (edited)
                        </span>
                      )}
                    </div>

                    {editingId === comment.id ? (
                      <>
                      <FormatToolbar target={editRef} />
                      <textarea
                        autoFocus
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
                          <b>{new Date(comment.requestedDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
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

                      {comment.isOwn && hoveredCommentId === comment.id && (
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
          <FormatToolbar target={composerRef} />
          <div style={{ position: 'relative' }}>
            <textarea
              ref={composerRef}
              value={composerValue}
              onChange={handleComposerChange}
              onSelect={(e) => updateMentionState(composerValue, e.currentTarget.selectionStart)}
              onKeyDown={handleComposerKeyDown}
              onBlur={() => setTimeout(() => setMention(null), 150)}
              rows={1}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                color: 'var(--text)',
                resize: 'vertical',
                marginBottom: '8px',
                maxHeight: '40vh',
              }}
              placeholder="Add a comment…"
            />

            {mention && mentionMatches.length > 0 && (
              <div
                ref={flipIfOffscreen}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '-4px',
                  zIndex: 50,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  minWidth: '240px',
                  overflow: 'hidden',
                }}
              >
                {mentionMatches.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    // onMouseDown, not onClick: fires before the textarea's onBlur, so the
                    // dropdown doesn't close (and unmount this button) first.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectMention(u);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 12px',
                      border: 'none',
                      background: i === activeMentionIndex ? 'var(--surface-alt)' : 'transparent',
                      color: 'var(--text)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {u.member && <MemberAvatar member={u.member} size={24} />}
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 500 }}>{u.name}</span>
                      {u.member && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{u.member.email}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@name to mention &middot; ⌘/Ctrl+Enter to send</div>
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
