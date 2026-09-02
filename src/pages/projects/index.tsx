import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Protected from '../../components/Protected';
import { dashboardSeed, fetchProjects, type ProjectRecord } from '../../lib/taskData';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>(dashboardSeed.projects);
  const [form, setForm] = useState({ name: '', owner: 'Ayesha', status: 'Not Started', target: '' });

  const visibleProjects = useMemo(
    () => projects.filter((project) => !project.archived),
    [projects],
  );

  const archivedProjects = useMemo(
    () => projects.filter((project) => project.archived),
    [projects],
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      const data = await fetchProjects();
      if (!active) return;
      setProjects(data);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;

    const newProject: ProjectRecord = {
      id: `project-${Date.now()}`,
      name: form.name.trim(),
      description: '',
      owner: form.owner,
      status: form.status,
      target: form.target || 'TBD',
      archived: false,
    };

    setProjects((current) => [newProject, ...current]);
    setForm({ name: '', owner: 'Ayesha', status: 'Not Started', target: '' });
  }

  function archiveProject(projectId: string) {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId ? { ...project, archived: true, status: 'Archived' } : project,
      ),
    );
  }

  return (
    <Protected>
      <div className="page-shell">
        <header className="topbar">
          <div className="brand-block">
            <p className="kicker">TukTukRental</p>
            <h1 className="page-title">Projects</h1>
          </div>
          <nav className="topbar-nav" aria-label="Sub navigation">
            <Link href="/" className="nav-pill">Dashboard</Link>
            <Link href="/my-tasks" className="nav-pill">My Tasks</Link>
          </nav>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="surface-card" style={{ padding: '22px' }}>
            <div className="section-header">
              <h2 className="section-title">Active projects</h2>
              <span className="inline-meta">{visibleProjects.length} active</span>
            </div>

            <div className="project-list">
              {visibleProjects.map((project) => (
                <div key={project.id} className="list-card" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Link href={`/projects/${project.id}`} className="text-link" style={{ fontSize: '1.05rem' }}>
                      {project.name}
                    </Link>
                    <span className="badge badge-neutral">{project.status}</span>
                  </div>
                  <p className="task-meta">Owner: {project.owner}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span className="task-meta">Target: {project.target}</span>
                    <button type="button" onClick={() => archiveProject(project.id)} className="secondary-button">
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {archivedProjects.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 className="inline-meta" style={{ marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Archived</h3>
                <div className="stack-list">
                  {archivedProjects.map((project) => (
                    <div key={project.id} className="list-card" style={{ padding: '12px 14px' }}>
                      <span>{project.name}</span>
                      <span className="task-meta">{project.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="form-card">
            <h2 className="section-title" style={{ marginBottom: '18px' }}>Create project</h2>
            <form onSubmit={handleSubmit}>
              <label className="form-group">
                <span className="field-label">Project name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="text-field"
                  placeholder="e.g. Driver onboarding"
                />
              </label>

              <label className="form-group">
                <span className="field-label">Owner</span>
                <input
                  value={form.owner}
                  onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
                  className="text-field"
                />
              </label>

              <label className="form-group">
                <span className="field-label">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  className="select-field"
                >
                  <option>Not Started</option>
                  <option>Active</option>
                  <option>On Hold</option>
                  <option>Completed</option>
                </select>
              </label>

              <label className="form-group">
                <span className="field-label">Target completion date</span>
                <input
                  type="date"
                  value={form.target}
                  onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))}
                  className="text-field"
                />
              </label>

              <button type="submit" className="primary-button" style={{ width: '100%' }}>
                Save project
              </button>
            </form>
          </aside>
        </div>
      </div>
    </Protected>
  );
}
