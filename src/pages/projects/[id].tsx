import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import Protected from '../../components/Protected';
import { fetchProjectById, fetchTasksByProject, type ProjectRecord, type TaskRecord } from '../../lib/taskData';

export default function ProjectDetailPage() {
  const router = useRouter();
  const projectId = typeof router.query.id === 'string' ? router.query.id : '';
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);

  useEffect(() => {
    if (!projectId) return;

    let active = true;

    const load = async () => {
      const [projectData, taskData] = await Promise.all([
        fetchProjectById(projectId),
        fetchTasksByProject(projectId),
      ]);

      if (!active) return;
      setProject(projectData ?? null);
      setTasks(taskData);
    };

    void load();
    return () => {
      active = false;
    };
  }, [projectId]);

  const topLevel = useMemo(() => tasks.filter((task) => !task.parent_task_id), [tasks]);
  const children = useMemo(() => tasks.filter((task) => task.parent_task_id), [tasks]);

  return (
    <Protected>
      <div className="page-shell">
        <header className="topbar">
          <div className="brand-block">
            <p className="kicker">TukTukRental</p>
            <h1 className="page-title">{project?.name ?? (projectId ? 'Project not found' : 'Loading project...')}</h1>
          </div>
          <nav className="topbar-nav" aria-label="Sub navigation">
            <Link href="/" className="nav-pill">Dashboard</Link>
            <Link href="/my-tasks" className="nav-pill">My Tasks</Link>
          </nav>
        </header>

        {project ? (
          <div className="space-y-6" style={{ display: 'grid', gap: '24px' }}>
            <section className="surface-card" style={{ padding: '22px' }}>
              <p className="task-meta">Owner: {project.owner} • Status: {project.status}</p>
              <p className="task-meta" style={{ marginTop: '14px', color: '#374151' }}>{project.description || 'No description available yet.'}</p>
            </section>

            <section className="surface-card" style={{ padding: '22px' }}>
              <h2 className="section-title" style={{ marginBottom: '16px' }}>Tasks</h2>

              {topLevel.length === 0 ? (
                <p className="task-meta">No tasks in this project.</p>
              ) : (
                <ul className="space-y-4" style={{ display: 'grid', gap: '16px' }}>
                  {topLevel.map((task) => (
                    <li key={task.id} className="ghost-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <Link href={`/tasks/${task.id}`} className="text-link">{task.title}</Link>
                        <span className="badge badge-neutral">{task.status}</span>
                      </div>
                      <p className="task-meta" style={{ marginTop: '10px' }}>
                        {task.level === 2 ? 'L2 subtask' : 'L1 task'} • Due {task.due_date}
                      </p>

                      {children.filter((child) => child.parent_task_id === task.id).length > 0 && (
                        <ul style={{ marginTop: '14px', display: 'grid', gap: '10px', paddingLeft: '16px', borderLeft: '2px solid var(--line)' }}>
                          {children.filter((child) => child.parent_task_id === task.id).map((child) => (
                            <li key={child.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '0.92rem' }}>
                              <Link href={`/tasks/${child.id}`} className="text-link" style={{ color: '#374151' }}>
                                {child.title}
                              </Link>
                              <span className="task-meta">{child.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <p className="surface-card" style={{ padding: '22px' }}>Project not found.</p>
        )}
      </div>
    </Protected>
  );
}
