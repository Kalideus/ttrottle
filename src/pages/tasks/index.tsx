import Link from 'next/link';
import { useEffect, useState } from 'react';
import Protected from '../../components/Protected';
import { dashboardSeed, fetchTasks, type TaskRecord } from '../../lib/taskData';

export default function TasksIndexPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>(dashboardSeed.tasks);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const data = await fetchTasks();
      if (!active) return;
      setTasks(data);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);
  return (
    <Protected>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">TukTukRental</p>
            <h1 className="text-3xl font-bold text-slate-900">All Tasks</h1>
          </div>
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Link href="/tasks/new" className="rounded bg-sky-600 px-3 py-2 text-white hover:bg-sky-700">New task</Link>
            <Link href="/" className="rounded px-3 py-2 hover:bg-slate-100">Dashboard</Link>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">Task</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Parent</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Project</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Assignee</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Priority</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/tasks/${task.id}`} className="font-medium text-sky-700 hover:underline">
                      {task.title}
                    </Link>
                    <div className="mt-1 text-xs text-slate-500">{task.level === 2 ? 'L2 subtask' : 'L1 task'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{task.parent_title ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{task.project}</td>
                  <td className="px-4 py-3 text-slate-600">{task.assignee}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{task.status}</td>
                  <td className="px-4 py-3 text-slate-600">{task.due_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Protected>
  );
}
