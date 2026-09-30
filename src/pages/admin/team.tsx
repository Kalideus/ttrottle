import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // "Add to projects" panel: which person it's open for, and the ticked projects
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickedRole, setPickedRole] = useState<(typeof ROLES)[number]>('member');
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    setStatus('saving');
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
      setStatus('idle');
      setError(result.error ?? resp.statusText);
      throw new Error(result.error);
    }
    await load();
    setStatus('saved');
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus('idle'), 2500);
  };

  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);

  if (loading) return <Protected><div className="mx-auto max-w-5xl px-6 py-8 text-sm text-slate-600">Loading…</div></Protected>;

  if (!me?.is_super_admin) {
    return (
      <Protected>
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Link href="/app" className="mb-4 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Back to app
          </Link>
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
        <Link href="/app" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to app
        </Link>

        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Admin</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Team &amp; permissions</h1>
              <p className="mt-1 text-sm text-slate-600">
                Site-wide flags, project roles, invites and archived projects. Changes save as soon as you make them.
              </p>
            </div>
            <span role="status" aria-live="polite" className="text-sm font-medium">
              {status === 'saving' && <span className="text-slate-500">Saving…</span>}
              {status === 'saved' && <span className="text-emerald-600">✓ Saved</span>}
            </span>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">People</h2>
          <p className="mt-1 text-sm text-slate-600">
            Super admin sees and restores deleted tasks (/admin/deleted-tasks) across every project. Can create
            projects lets someone use the &ldquo;+ new project&rdquo; button. &ldquo;Add to projects&rdquo; puts someone
            who already has an account into several projects at once, with no invite email or link. Click a name
            to edit it; initials update to match.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Can create projects</th>
                  <th className="py-2 pr-4">Super admin</th>
                  <th className="py-2 pr-4">Projects</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const inIds = new Set(members.filter((m) => m.profile_id === p.id).map((m) => m.project_id));
                  const shared = activeProjects.filter((pr) => !pr.is_private);
                  const inProjects = shared.filter((pr) => inIds.has(pr.id));
                  const notIn = shared.filter((pr) => !inIds.has(pr.id));
                  const open = addingFor === p.id;
                  return (
                  <Fragment key={p.id}>
                  <tr className={open ? 'bg-slate-50' : 'border-b border-slate-100'}>
                    <td className="py-2 pr-4">
                      <input
                        key={p.name /* reset the draft after a save reloads the row */}
                        defaultValue={p.name}
                        aria-label={`Name for ${p.email}`}
                        placeholder="First Last"
                        className="w-44 rounded border border-transparent px-2 py-1 hover:border-slate-300 focus:border-sky-500 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            e.currentTarget.value = p.name;
                            e.currentTarget.blur();
                          }
                        }}
                        onBlur={(e) => {
                          const name = e.currentTarget.value.trim();
                          if (!name) e.currentTarget.value = p.name;
                          else if (name !== p.name) void callAdmin('set-name', { userId: p.id, name }).catch(() => {});
                        }}
                      />
                    </td>
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
                    <td className="py-2 pr-4">
                      <span className="text-slate-500" title={inProjects.map((pr) => pr.name).join(', ')}>
                        {inProjects.length} of {shared.length}
                      </span>
                      {notIn.length > 0 && (
                        <button
                          onClick={() => {
                            setAddingFor(open ? null : p.id);
                            setPicked(new Set());
                            setPickedRole('member');
                          }}
                          aria-expanded={open}
                          className="ml-3 rounded-lg border border-sky-300 px-2 py-0.5 text-xs text-sky-700 hover:bg-sky-50"
                        >
                          {open ? 'Cancel' : 'Add to projects'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <td colSpan={5} className="px-3 pb-4 pt-1">
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          {notIn.map((pr) => (
                            <label key={pr.id} className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={picked.has(pr.id)}
                                onChange={() =>
                                  setPicked((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(pr.id)) next.delete(pr.id);
                                    else next.add(pr.id);
                                    return next;
                                  })
                                }
                              />
                              <span>{pr.icon} {pr.name}</span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => setPicked(picked.size === notIn.length ? new Set() : new Set(notIn.map((pr) => pr.id)))}
                            className="text-xs text-slate-600 hover:underline"
                          >
                            {picked.size === notIn.length ? 'Select none' : 'Select all'}
                          </button>
                          <label className="inline-flex items-center gap-2 text-slate-600">
                            As
                            <select
                              value={pickedRole}
                              onChange={(e) => setPickedRole(e.target.value as (typeof ROLES)[number])}
                              className="rounded border border-slate-300 px-2 py-1"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </label>
                          <button
                            disabled={picked.size === 0 || status === 'saving'}
                            onClick={async () => {
                              await callAdmin('add-members', { userId: p.id, projectIds: [...picked], role: pickedRole });
                              setAddingFor(null);
                            }}
                            className="rounded-lg bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                          >
                            Add to {picked.size || ''} project{picked.size === 1 ? '' : 's'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
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
