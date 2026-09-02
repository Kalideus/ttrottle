import { type FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Protected from '../../components/Protected';
import { createTask, fetchProjects, type ProjectRecord } from '../../lib/taskData';

type TaskDraft = {
  title: string;
  project_id: string;
  assignee: string;
  status: string;
  priority: string;
  due_date: string;
  description: string;
  parent_task_id: string;
};

const initialDraft: TaskDraft = {
  title: '',
  project_id: '',
  assignee: 'Ayesha',
  status: 'Not Started',
  priority: 'Normal',
  due_date: '',
  description: '',
  parent_task_id: '',
};

export default function NewTaskPage() {
  const [draft, setDraft] = useState<TaskDraft>(initialDraft);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [created, setCreated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedProjects = useRef(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const nextProjects = await fetchProjects();
      if (!active) return;
      setProjects(nextProjects);
      if (nextProjects.length > 0 && !hasLoadedProjects.current) {
        hasLoadedProjects.current = true;
        setDraft((current) => ({
          ...current,
          project_id: current.project_id || nextProjects[0].id,
        }));
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError('Task title is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await createTask({
        title: draft.title.trim(),
        project_id: draft.project_id,
        description: draft.description,
        assignee: draft.assignee,
        status: draft.status,
        priority: draft.priority,
        due_date: draft.due_date || undefined,
        parent_task_id: draft.parent_task_id || null,
      });

      setCreated(true);
      setDraft(initialDraft);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save task right now.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Protected>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">TukTukRental</p>
            <h1 className="text-3xl font-bold text-slate-900">New task</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Link href="/" className="rounded px-3 py-2 hover:bg-slate-100">Dashboard</Link>
            <Link href="/my-tasks" className="rounded px-3 py-2 hover:bg-slate-100">My Tasks</Link>
          </nav>
        </header>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Task title
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-500"
                placeholder="e.g. Review driver onboarding checklist"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Project
              <select
                value={draft.project_id}
                onChange={(event) => setDraft((current) => ({ ...current, project_id: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-500"
              >
                {projects.length === 0 ? (
                  <option value="">Loading projects...</option>
                ) : (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))
                )}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Assignee
              <select
                value={draft.assignee}
                onChange={(event) => setDraft((current) => ({ ...current, assignee: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-500"
              >
                <option>Ayesha</option>
                <option>Nimal</option>
                <option>Saman</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-500"
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Waiting</option>
                <option>Completed</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Priority
              <select
                value={draft.priority}
                onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-500"
              >
                <option>Low</option>
                <option>Normal</option>
                <option>High</option>
                <option>Urgent</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Parent task (optional)
              <input
                value={draft.parent_task_id}
                onChange={(event) => setDraft((current) => ({ ...current, parent_task_id: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-500"
                placeholder="Optional L2 parent task id"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Due date
              <input
                type="date"
                value={draft.due_date}
                onChange={(event) => setDraft((current) => ({ ...current, due_date: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-500"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Description
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                rows={5}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-sky-500"
                placeholder="Add task details, notes, and handoff context..."
              />
            </label>
          </div>

          {error && (
            <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {created && (
            <div className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Task created successfully.
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
            >
              {saving ? 'Saving...' : 'Save task'}
            </button>
            <Link href="/my-tasks" className="rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </Protected>
  );
}
