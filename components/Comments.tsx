'use client';

import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Trash2, MoreVertical } from 'lucide-react';

export interface CommentItem {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  likes: number;
  liked: boolean;
  isOwn: boolean;
}

interface CommentsProps {
  taskId: string;
  comments: CommentItem[];
  onCommentAdd: (body: string) => Promise<void>;
  onCommentEdit: (commentId: string, body: string) => Promise<void>;
  onCommentDelete: (commentId: string) => Promise<void>;
  onCommentLike: (commentId: string) => Promise<void>;
  loading?: boolean;
}

export function Comments({
  taskId,
  comments,
  onCommentAdd,
  onCommentEdit,
  onCommentDelete,
  onCommentLike,
  loading = false,
}: CommentsProps) {
  const [composerValue, setComposerValue] = useState('');
  const [composerRows, setComposerRows] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);

  const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComposerValue(value);
    const lines = value.split('\n').length;
    setComposerRows(Math.min(Math.max(lines, 1), 6));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerValue.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCommentAdd(composerValue);
      setComposerValue('');
      setComposerRows(1);
    } finally {
      setIsSubmitting(false);
    }
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
                  style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}
                  onMouseEnter={() => setHoveredCommentId(comment.id)}
                  onMouseLeave={() => setHoveredCommentId(null)}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: 'white',
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
                      <textarea
                        autoFocus
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
                        }}
                      />
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
                        {comment.body}
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            JD
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            value={composerValue}
            onChange={handleComposerChange}
            rows={composerRows}
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
            }}
            placeholder="Add a comment…"
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tip: use @name to mention</div>
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
