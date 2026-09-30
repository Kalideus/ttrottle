import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Protected from '../../components/Protected';
import { createClient } from '@/lib/supabase/client';
import { getCurrentProfile, getDeletedTasks, restoreTask, type Task, type Profile } from '@/lib/supabase/queries';

export default function DeletedTasksAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');

  useEffect(() => {
    (async () => {
      const p = await getCurrentProfile(supabase);
      setProfile(p);
      if (p?.is_super_admin) {
        const { data } = await getDeletedTasks(supabase);
        setTasks(data ?? []);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const handleRestore = async (id: string) => {
    await restoreTask(supabase, id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const projects = Array.from(
    new Map(tasks.filter((t) => t.project).map((t) => [t.project!.id, t.project!])).values()
  );
  const filtered = projectFilter ? tasks.filter((t) => t.project?.id === projectFilter) : tasks;

  return (
    <Protected>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/app" className="mb-4 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to app
        </Link>
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Deleted tasks</h1>
          <p className="mt-1 text-sm text-slate-600">Kept for 90 days after deletion, then purged permanently.</p>
        </header>

        {loading ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : !profile?.is_super_admin ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            You don&rsquo;t have access to this page.
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span className="text-sm text-slate-500">{filtered.length} deleted</span>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-slate-600">Nothing deleted{projectFilter ? ' in this project' : ''}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="py-2 pr-4">Task</th>
                      <th className="py-2 pr-4">Project</th>
                      <th className="py-2 pr-4">Deleted by</th>
                      <th className="py-2 pr-4">Deleted</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4">{t.name}</td>
                        <td className="py-2 pr-4">{t.project?.name ?? '—'}</td>
                        <td className="py-2 pr-4">{t.deletedByProfile?.name ?? t.deletedByProfile?.email ?? '—'}</td>
                        <td className="py-2 pr-4">{t.deleted_at ? new Date(t.deleted_at).toLocaleString() : '—'}</td>
                        <td className="py-2">
                          <button
                            onClick={() => handleRestore(t.id)}
                            className="rounded-lg border border-sky-300 px-3 py-1 text-sky-700 hover:bg-sky-50"
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </Protected>
  );
}
