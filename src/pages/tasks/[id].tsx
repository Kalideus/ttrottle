import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Protected from '../../components/Protected';
import { dashboardSeed, deleteTask, fetchTaskById, fetchTasks, type TaskRecord, updateTask } from '../../lib/taskData';

type Comment = { id: string; user_id: string; content: string; created_at: string };
type Attachment = { id: string; file_name: string; uploaded_by: string; created_at: string };

const commentsByTask: Record<string, Comment[]> = {
  t1: [
    { id: 'c1', user_id: 'Ayesha', content: 'Need the inspection report attached before sign-off.', created_at: '2026-08-27T09:00:00Z' },
    { id: 'c2', user_id: 'You', content: 'I have the report in progress and will upload it today.', created_at: '2026-08-27T10:15:00Z' },
  ],
  p1: [
    { id: 'c3', user_id: 'Ayesha', content: 'Please ensure tyre wear is checked before dispatch.', created_at: '2026-08-26T08:00:00Z' },
  ],
};

const attachmentsByTask: Record<string, Attachment[]> = {
  t1: [
    { id: 'a1', file_name: 'inspection-checklist.pdf', uploaded_by: 'Ayesha', created_at: '2026-08-27T08:15:00Z' },
  ],
};

export default function TaskDetailPage() {
  const router = useRouter();
  const taskId = typeof router.query.id === 'string' ? router.query.id : '';
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [allTasks, setAllTasks] = useState<TaskRecord[]>(dashboardSeed.tasks);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<TaskRecord>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!taskId) return;

    let active = true;

    const load = async () => {
      const [taskData, taskList] = await Promise.all([fetchTaskById(taskId), fetchTasks()]);
      if (!active) return;
      setTask(taskData ?? null);
      setAllTasks(taskList);
      if (taskData) {
        setDraft({
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.due_date,
          assignee: taskData.assignee,
        });
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [taskId]);

  const comments = taskId ? commentsByTask[taskId] ?? [] : [];
  const attachments = taskId ? attachmentsByTask[taskId] ?? [] : [];
  const parentTask = useMemo(
    () => (task && task.parent_task_id ? allTasks.find((entry) => entry.id === task.parent_task_id) ?? null : null),
    [allTasks, task],
  );
  const childTasks = useMemo(
    () => (taskId ? allTasks.filter((entry) => entry.parent_task_id === taskId) : []),
    [allTasks, taskId],
  );

  async function handleSave() {
    if (!taskId || !task) return;
    setSaving(true);
    setError('');

    try {
      const nextTask = await updateTask(taskId, {
        title: draft.title ?? task.title,
        description: draft.description ?? task.description,
        status: draft.status ?? task.status,
        priority: draft.priority ?? task.priority,
        due_date: draft.due_date ?? task.due_date,
      });

      setTask((current) => ({ ...(current ?? task), ...nextTask, project: current?.project ?? task.project, assignee: current?.assignee ?? task.assignee, level: current?.level ?? task.level, project_id: current?.project_id ?? task.project_id, parent_task_id: current?.parent_task_id ?? task.parent_task_id }));
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save task.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!taskId || !task) return;
    const confirmed = window.confirm(`Delete "${task.title}"?`);
    if (!confirmed) return;

    try {
      await deleteTask(taskId);
      void router.push('/my-tasks');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete task.');
    }
  }

  return (
    <Protected>
      <div className="page-shell">
        <header className="topbar">
          <div className="brand-block">
            <p className="kicker">TukTukRental</p>
            <h1 className="page-title">{task?.title ?? 'Task not found'}</h1>
          </div>
          <nav className="topbar-nav" aria-label="Sub navigation">
            <Link href="/" className="nav-pill">Dashboard</Link>
            <Link href="/my-tasks" className="nav-pill nav-pill-active">My Tasks</Link>
          </nav>
        </header>

        {task ? (
          <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <section style={{ display: 'grid', gap: '24px' }}>
              <div className="surface-card" style={{ padding: '22px' }}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="badge badge-neutral">{task.status}</span>
                  <span className="badge badge-warning">{task.priority}</span>
                  <span className="badge badge-primary">{task.level === 2 ? 'L2 subtask' : 'L1 task'}</span>
                </div>

                {isEditing ? (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <label className="form-group">
                      <span className="field-label">Task title</span>
                      <input value={draft.title ?? ''} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="text-field" />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="form-group">
                        <span className="field-label">Status</span>
                        <select value={draft.status ?? 'Not Started'} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} className="select-field">
                          <option>Not Started</option>
                          <option>In Progress</option>
                          <option>Waiting</option>
                          <option>Completed</option>
                        </select>
                      </label>

                      <label className="form-group">
                        <span className="field-label">Priority</span>
                        <select value={draft.priority ?? 'Normal'} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))} className="select-field">
                          <option>Low</option>
                          <option>Normal</option>
                          <option>High</option>
                          <option>Urgent</option>
                        </select>
                      </label>
                    </div>

                    <label className="form-group">
                      <span className="field-label">Due date</span>
                      <input type="date" value={draft.due_date ?? ''} onChange={(event) => setDraft((current) => ({ ...current, due_date: event.target.value }))} className="text-field" />
                    </label>

                    <label className="form-group">
                      <span className="field-label">Description</span>
                      <textarea value={draft.description ?? ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={4} className="textarea-field" />
                    </label>

                    {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button type="button" onClick={handleSave} disabled={saving} className="primary-button">
                        {saving ? 'Saving...' : 'Save changes'}
                      </button>
                      <button type="button" onClick={() => setIsEditing(false)} className="secondary-button">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="task-meta" style={{ color: '#374151', marginTop: '8px' }}>{task.description}</p>

                    <div className="grid gap-3 md:grid-cols-2" style={{ marginTop: '22px', color: '#475467', fontSize: '0.92rem' }}>
                      <div><span style={{ fontWeight: 700, color: '#111827' }}>Project:</span> {task.project}</div>
                      <div><span style={{ fontWeight: 700, color: '#111827' }}>Assignee:</span> {task.assignee}</div>
                      <div><span style={{ fontWeight: 700, color: '#111827' }}>Due date:</span> {task.due_date}</div>
                      <div>
                        <span style={{ fontWeight: 700, color: '#111827' }}>Parent:</span>{' '}
                        {parentTask ? (
                          <Link href={`/tasks/${parentTask.id}`} className="text-link">{parentTask.title}</Link>
                        ) : (
                          'Top-level task'
                        )}
                      </div>
                    </div>

                    {task.level === 1 && (
                      <div className="inline-meta" style={{ marginTop: '20px' }}>
                        <button type="button" className="primary-button">Add subtask</button>
                        <span>{childTasks.length} subtask{childTasks.length === 1 ? '' : 's'}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {task.level === 1 && childTasks.length > 0 && (
                <div className="surface-card" style={{ padding: '22px' }}>
                  <h2 className="section-title" style={{ marginBottom: '16px' }}>Subtasks</h2>
                  <ul className="stack-list">
                    {childTasks.map((child) => (
                      <li key={child.id} className="list-card" style={{ padding: '12px 14px' }}>
                        <Link href={`/tasks/${child.id}`} className="text-link">{child.title}</Link>
                        <span className="task-meta">{child.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="surface-card" style={{ padding: '22px' }}>
                <h2 className="section-title" style={{ marginBottom: '16px' }}>Comments</h2>
                <div className="stack-list">
                  {comments.length === 0 ? (
                    <p className="task-meta">No comments yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="ghost-card">
                        <div className="inline-meta" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#111827' }}>{comment.user_id}</span>
                          <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="task-meta" style={{ color: '#374151' }}>{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <aside style={{ display: 'grid', gap: '24px' }}>
              <div className="surface-card" style={{ padding: '22px' }}>
                <h2 className="section-title" style={{ marginBottom: '16px' }}>Actions</h2>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <button type="button" onClick={() => setIsEditing((current) => !current)} className="primary-button">
                    {isEditing ? 'Close editor' : 'Edit task'}
                  </button>
                  <button type="button" onClick={handleDelete} className="secondary-button" style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fff7f7' }}>
                    Delete task
                  </button>
                </div>
              </div>

              <div className="surface-card" style={{ padding: '22px' }}>
                <h2 className="section-title" style={{ marginBottom: '16px' }}>Dependencies</h2>
                <ul className="stack-list" style={{ fontSize: '0.9rem', color: '#475467' }}>
                  <li>Waiting on: <span style={{ fontWeight: 700, color: '#111827' }}>Vehicle handover approval</span></li>
                  <li>Blocking: <span style={{ fontWeight: 700, color: '#111827' }}>Dispatch checklist sign-off</span></li>
                </ul>
              </div>

              <div className="surface-card" style={{ padding: '22px' }}>
                <h2 className="section-title" style={{ marginBottom: '16px' }}>Attachments</h2>
                {attachments.length === 0 ? (
                  <p className="task-meta">No attachments.</p>
                ) : (
                  <ul className="stack-list" style={{ fontSize: '0.9rem' }}>
                    {attachments.map((attachment) => (
                      <li key={attachment.id} className="ghost-card">
                        <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#111827' }}>{attachment.file_name}</p>
                        <p className="task-meta">Uploaded by {attachment.uploaded_by}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        ) : (
          <p className="surface-card" style={{ padding: '22px' }}>Task not found.</p>
        )}
      </div>
    </Protected>
  );
}
