'use client';

import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { Ticket } from '@/lib/supabase/queries';
import { Comments, type CommentItem } from '@/components/Comments';
import { Markdown } from '@/components/Markdown';
import { hexToRgba } from '@/components/TagPicker';
import { formatDay, isOverdue } from '@/lib/dates';

interface TicketsProps {
  tickets: Ticket[];
  loading: boolean;
  // the ticket whose details and comments are showing, if any
  openTicketId: string | null;
  onToggle: (ticketId: string) => void;
  onCreate: () => void;
  comments: CommentItem[];
  commentsLoading: boolean;
  onCommentAdd: (body: string, mentions: string[]) => Promise<void>;
  onCommentEdit: (commentId: string, body: string) => Promise<void>;
  onCommentDelete: (commentId: string) => Promise<void>;
  onCommentLike: (commentId: string) => Promise<void>;
}

// Where a ticket has got to, from the sender's side: waiting, with someone, done, or removed by the team.
function status(t: Ticket) {
  if (t.deleted_at) return { label: 'Closed', color: '#6D6E6F' };
  if (t.completed) return { label: 'Done', color: '#5DA283' };
  if (t.assignee_name) return { label: 'In progress', color: '#4573D2' };
  return { label: 'Waiting', color: '#C98A1B' };
}

// "My tickets": everything I've sent to other teams. The sender can read and comment, not edit.
export function Tickets({ tickets, loading, openTicketId, onToggle, onCreate, comments, commentsLoading, onCommentAdd, onCommentEdit, onCommentDelete, onCommentLike }: TicketsProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>My tickets</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>Requests you&rsquo;ve sent to other teams.</p>
        </div>
        <button className="inbox-head-btn" onClick={onCreate}>
          <Plus size={15} />
          Create ticket
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && tickets.length === 0 ? (
          <p className="ticket-empty">Loading…</p>
        ) : tickets.length === 0 ? (
          <p className="ticket-empty">You haven&rsquo;t sent any tickets yet.</p>
        ) : (
          tickets.map((t) => {
            const open = t.id === openTicketId;
            const s = status(t);
            const overdue = isOverdue(t.due_date, t.completed || !!t.deleted_at);
            return (
              <div key={t.id} className={`ticket ${open ? 'is-open' : ''}`}>
                <button type="button" className="ticket-row" onClick={() => onToggle(t.id)} aria-expanded={open}>
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="ticket-name">{t.name}</span>
                  {t.project_name && (
                    <span className="ticket-chip" style={{ backgroundColor: hexToRgba(t.project_color ?? '#6D6E6F', 0.15), color: t.project_color ?? '#6D6E6F' }}>
                      {t.project_icon} {t.project_name}
                    </span>
                  )}
                  <span className="ticket-chip" style={{ backgroundColor: hexToRgba(s.color, 0.15), color: s.color }}>{s.label}</span>
                </button>

                {open && (
                  <div className="ticket-body">
                    <dl className="ticket-facts">
                      <div><dt>With</dt><dd>{t.assignee_name ?? 'Not assigned yet'}</dd></div>
                      <div>
                        <dt>Due</dt>
                        <dd style={overdue ? { color: '#D64545', fontWeight: 600 } : undefined}>{t.due_date ? formatDay(t.due_date) : 'No date yet'}</dd>
                      </div>
                      <div><dt>Sent</dt><dd>{formatDay(t.created_at)}</dd></div>
                    </dl>
                    {t.description && <Markdown text={t.description} />}
                    <Comments
                      taskId={t.id}
                      comments={comments}
                      loading={commentsLoading}
                      mentionableUsers={[]}
                      onCommentAdd={onCommentAdd}
                      onCommentEdit={onCommentEdit}
                      onCommentDelete={onCommentDelete}
                      onCommentLike={onCommentLike}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
