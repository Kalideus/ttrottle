import { useEffect, useMemo, useState } from 'react';
import Protected from '../../components/Protected';
import { createClient } from '@/lib/supabase/client';
import { InviteModal } from '@/components/InviteModal';
import {
  getCurrentProfile,
  getAllProfilesAdmin,
  getAllProjectsAdmin,
  getAllProjectMembersAdmin,
  type Profile,
  type Project,
  type ProjectMember,
} from '@/lib/supabase/queries';

const ROLES = ['owner', 'admin', 'member'] as const;

export default function TeamAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const p = await getCurrentProfile(supabase);
    setMe(p);
    if (p?.is_super_admin) {
      const [{ data: profileRows }, { data: projectRows }, { data: memberRows }] = await Promise.all([
        getAllProfilesAdmin(supabase),
        getAllProjectsAdmin(supabase),
        getAllProjectMembersAdmin(supabase),
      ]);
      setProfiles(profileRows ?? []);
      setProjects(projectRows ?? []);
      setMembers(memberRows ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [supabase]);

  const callAdmin = async (path: string, body: object) => {
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const resp = await fetch(`/api/admin/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    });
    const result = await resp.json();
    if (!resp.ok) {
      setError(result.error ?? resp.statusText);
      throw new Error(result.error);
    }
    await load();
  };

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);

  if (loading) return <Protected><div className="mx-auto max-w-5xl px-6 py-8 text-sm text-slate-600">Loading…</div></Protected>;

  if (!me?.is_super_admin) {
    return (
      <Protected>
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            You don&rsquo;t have access to this page.
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Team &amp; permissions</h1>
          <p className="mt-1 text-sm text-slate-600">Site-wide flags, project roles, invites and archived projects.</p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">People</h2>
          <p className="mt-1 text-sm text-slate-600">
            Super admin sees and restores deleted tasks (/admin/deleted-tasks) across every project. Can create
            projects lets someone use the &ldquo;+ new project&rdquo; button.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Can create projects</th>
                  <th className="py-2 pr-4">Super admin</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{p.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{p.email}</td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={!!p.can_create_projects}
                        onChange={(e) => callAdmin('set-flags', { userId: p.id, can_create_projects: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={!!p.is_super_admin}
                        onChange={(e) => callAdmin('set-flags', { userId: p.id, is_super_admin: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
          <div className="mt-4 space-y-6">
            {activeProjects.map((project) => (
              <div key={project.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{project.icon}</span>
                    <span className="font-medium text-slate-900">{project.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInviteProjectId(project.id)}
                      className="rounded-lg border border-sky-300 px-3 py-1 text-sm text-sky-700 hover:bg-sky-50"
                    >
                      Invite
                    </button>
                    <button
                      onClick={() => window.confirm(`Archive "${project.name}"?`) && callAdmin('project-action', { projectId: project.id, action: 'archive' })}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Archive
                    </button>
                    <button
                      onClick={() =>
                        window.prompt(`Type "${project.name}" to permanently delete it and everything in it:`) === project.name &&
                        callAdmin('project-action', { projectId: project.id, action: 'delete' })
                      }
                      className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <table className="mt-3 w-full text-sm">
                  <tbody>
                    {members
                      .filter((m) => m.project_id === project.id)
                      .map((m) => (
                        <tr key={m.email} className="border-t border-slate-100">
                          <td className="py-2 pr-4">{m.profile?.name ?? m.email}</td>
                          <td className="py-2 pr-4 text-slate-500">{m.email}</td>
                          <td className="py-2 pr-4">
                            <select
                              value={m.role}
                              onChange={(e) => callAdmin('set-role', { projectId: project.id, email: m.email, role: e.target.value })}
                              className="rounded border border-slate-300 px-2 py-1"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() => window.confirm(`Remove ${m.email} from ${project.name}?`) && callAdmin('remove-member', { projectId: project.id, email: m.email })}
                              className="text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    {members.filter((m) => m.project_id === project.id).length === 0 && (
                      <tr><td className="py-2 text-slate-500">No members.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

        {archivedProjects.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Archived projects</h2>
            <table className="mt-4 w-full text-sm">
              <tbody>
                {archivedProjects.map((project) => (
                  <tr key={project.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{project.icon} {project.name}</td>
                    <td className="py-2">
                      <button
                        onClick={() => callAdmin('project-action', { projectId: project.id, action: 'unarchive' })}
                        className="rounded-lg border border-sky-300 px-3 py-1 text-sky-700 hover:bg-sky-50"
                      >
                        Unarchive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {inviteProjectId && (
        <InviteModal
          onClose={() => setInviteProjectId(null)}
          onInvite={async (email, sendEmail) => {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const resp = await fetch('/api/invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
              body: JSON.stringify({ email, projectId: inviteProjectId, sendEmail }),
            });
            const result = await resp.json();
            if (!resp.ok) return { ok: false, message: result.error ?? resp.statusText };
            await load();
            if (result.link) return { ok: true, message: `Link ready for ${email}.`, link: result.link as string };
            return {
              ok: true,
              message: result.emailSent ? `Invite email sent to ${email}.` : `${email} already has an account and was added.`,
            };
          }}
        />
      )}
    </Protected>
  );
}
