import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Protected from '../components/Protected';
import { dashboardSeed, fetchTasks, type TaskRecord } from '../lib/taskData';

function parseDateValue(dateValue: string | undefined): number {
  if (!dateValue || dateValue === 'TBD') return Number.MAX_SAFE_INTEGER;
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getTime();
}

export default function MyTasksPage() {
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

  const sortedTasks = useMemo(
    () => [...tasks].sort((left, right) => parseDateValue(left.due_date) - parseDateValue(right.due_date)),
    [tasks],
  );

  return (
    <Protected>
      <main className="page-shell">
        <aside className="aside-shell">
          <div className="app-logo-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="logo-mark">+</div>
              <div className="logo-stack">Asana</div>
            </div>
            <button className="create-pill" type="button">+</button>
          </div>

          <nav className="sidebar-nav" aria-label="Sidebar navigation">
            <div className="nav-item"><span className="dot" />Home</div>
            <div className="nav-item active"><span className="dot" />My tasks</div>
            <div className="nav-item"><span className="dot" />Inbox</div>
            <div className="nav-item"><span className="dot" />Projects</div>
            <div className="nav-item"><span className="dot" />Reporting</div>
          </nav>
        </aside>

        <div className="workspace-shell">
          <header className="workspace-header">
            <div className="header-actions" style={{ flex: 1 }}>
              <button type="button" className="icon-button">‹</button>
              <button type="button" className="icon-button">›</button>
              <div className="search-box">
                <span>⌕</span>
                <input aria-label="Search" placeholder="Search" />
              </div>
            </div>

            <div className="top-bar-right">
              <button type="button" className="primary-mini-btn">Share</button>
            </div>
          </header>

          <div className="content-wrap">
            <div className="portfolio-head">
              <div className="project-title">
                <span className="title-badge" />
                <span>My Tasks</span>
              </div>
              <Link href="/" className="filter-chip filter-light">Back to portfolio</Link>
            </div>

            <div className="toolbar-row">
              <div className="filter-group">
                <button type="button" className="filter-chip">＋ Add task</button>
                <button type="button" className="filter-chip filter-light">Filter: Due soon</button>
                <button type="button" className="filter-chip filter-light">Sort: Due date</button>
              </div>
            </div>

            <div className="table-card">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th style={{ width: '32%' }}>Task</th>
                    <th>Project</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <Link href={`/tasks/${task.id}`} style={{ color: '#e5e7eb', fontWeight: 700 }}>
                          {task.title}
                        </Link>
                        <div className="subtext" style={{ marginTop: '4px' }}>
                          {task.level === 2 ? `L2 • parent: ${task.parent_title ?? 'Task'}` : 'L1 • top-level task'}
                        </div>
                      </td>
                      <td className="subtext">{task.project}</td>
                      <td>
                        <span className="task-status on-hold">{task.priority}</span>
                      </td>
                      <td className="subtext">{task.status}</td>
                      <td className="subtext">{task.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </Protected>
  );
}
