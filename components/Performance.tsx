'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPerformanceData, type Project, type ProjectMember } from '@/lib/supabase/queries';
import { computeKpi, rate, type KpiStats, type KpiTask } from '@/lib/kpi';

interface PerformanceProps {
  supabase: SupabaseClient;
  currentUserId: string | null;
  projects: Project[];
  myRoles: Map<string, ProjectMember['role']>;
  isSuperAdmin: boolean;
}

type KpiType = 'deadline' | 'turnaround';
const kpiType = (p: Project): KpiType => p.kpi_type ?? 'deadline';
const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);
const daysText = (d: number | null) => (d === null ? '—' : `${d.toFixed(1)} days`);
// 90-day window, plus room for the 12-week trend
const HISTORY_DAYS = 180;

// Performance dashboard: everyone sees their own numbers against their team's; managers also get a Team tab
// comparing the people in the projects they manage (a super admin: every project).
export function Performance({ supabase, currentUserId, projects, myRoles, isSuperAdmin }: PerformanceProps) {
  const managed = projects.filter((p) => isSuperAdmin || ['owner', 'admin'].includes(myRoles.get(p.id) ?? ''));
  const isManager = managed.length > 0;
  // roles can still be loading on first render: until someone picks a tab, a manager lands on Team
  const [picked, setTab] = useState<'me' | 'team' | null>(null);
  const tab = picked ?? (isManager ? 'team' : 'me');
  const [days, setDays] = useState<30 | 90>(30);
  const [projectId, setProjectId] = useState('');

  const showTeam = isManager && tab === 'team';
  const mine = projects.filter((p) => myRoles.has(p.id));
  const choices = showTeam ? managed : mine;

  const [data, setData] = useState<{ tasks: KpiTask[]; extended: Set<string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadIds = [...new Set([...mine, ...managed].map((p) => p.id))].sort().join(',');
  useEffect(() => {
    if (!loadIds) return;
    let live = true;
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
    void getPerformanceData(supabase, loadIds.split(','), since).then((r) => {
      if (!live) return;
      if (r.error) setError(r.error.message);
      else setData({ tasks: r.tasks, extended: r.extended });
    });
    return () => {
      live = false;
    };
  }, [supabase, loadIds]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Performance</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
            {showTeam ? 'How the people in your projects are doing.' : 'Your numbers, next to your team’s.'}
          </p>
        </div>
        {isManager && (
          <div className="perf-segment" role="tablist" aria-label="Whose performance">
            <button role="tab" aria-selected={tab === 'me'} className={tab === 'me' ? 'active' : ''} onClick={() => { setTab('me'); setProjectId(''); }}>
              Me
            </button>
            <button role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'active' : ''} onClick={() => { setTab('team'); setProjectId(''); }}>
              Team
            </button>
          </div>
        )}
      </div>

      <div className="contacts-tools">
        <select className="modal-input contacts-filter" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
          <option value="">{showTeam ? 'All my projects' : 'All projects'}</option>
          {choices.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="perf-segment" role="group" aria-label="Period">
          {([30, 90] as const).map((d) => (
            <button key={d} aria-pressed={days === d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="contacts-scroll perf-body">
        {error ? (
          <p className="perf-empty">Couldn’t load the numbers: {error}</p>
        ) : !data ? (
          <p className="perf-empty">{loadIds ? 'Loading…' : 'You’re not in any projects yet.'}</p>
        ) : showTeam ? (
          // ponytail: placeholder until the team view (step 6) lands
          <p className="perf-empty">Team comparison coming next.</p>
        ) : (
          <MemberView
            userId={currentUserId}
            projects={projectId ? mine.filter((p) => p.id === projectId) : mine}
            tasks={data.tasks}
            extended={data.extended}
            days={days}
          />
        )}
      </div>
    </div>
  );
}

function MemberView({ userId, projects, tasks, extended, days }: { userId: string | null; projects: Project[]; tasks: KpiTask[]; extended: Set<string>; days: number }) {
  const ctx = useMemo(
    () => ({ now: new Date(), days, extended, turnaround: new Set(projects.filter((p) => kpiType(p) === 'turnaround').map((p) => p.id)) }),
    [days, extended, projects]
  );
  const inScope = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    return tasks.filter((t) => ids.has(t.project_id));
  }, [tasks, projects]);
  const isMine = (t: KpiTask) => t.assignee_id === userId;

  // deadline work and Tech work are measured differently, so each gets its own section; only the kinds this
  // person has work in, unless they have none yet
  const kinds = (['deadline', 'turnaround'] as const)
    .map((type) => ({ type, projects: projects.filter((p) => kpiType(p) === type) }))
    .filter((k) => k.projects.length);
  const withWork = kinds.filter((k) => inScope.some((t) => isMine(t) && k.projects.some((p) => p.id === t.project_id)));
  const shown = withWork.length ? withWork : kinds.slice(0, 1);

  if (!shown.length) return <p className="perf-empty">No projects to show.</p>;

  return (
    <>
      {shown.map(({ type, projects: ps }) => {
        const ids = new Set(ps.map((p) => p.id));
        const team = inScope.filter((t) => ids.has(t.project_id));
        const me = computeKpi(team.filter(isMine), ctx);
        const all = computeKpi(team, ctx);
        const rows = ps
          .map((p) => {
            const pt = team.filter((t) => t.project_id === p.id);
            return { project: p, me: computeKpi(pt.filter(isMine), ctx), team: computeKpi(pt, ctx) };
          })
          .filter((r) => r.me.all.assigned || r.me.all.pending || r.me.all.overdue || r.me.all.onTime.of);
        return (
          <section key={type} className="perf-section">
            {shown.length > 1 && <h3 className="perf-section-title">{type === 'turnaround' ? 'Tech' : 'Deadline work'}</h3>}

            <div className="perf-headline" title="Of your 🎯 tasks whose deadline fell in this period, how many were done by it">
              <span className="perf-headline-label">🎯 KPI achievement</span>
              <span className="perf-headline-value">{pct(rate(me.core.achievement.hit, me.core.achievement.of))}</span>
              <span className="perf-muted">
                {me.core.achievement.of ? `${me.core.achievement.hit} of ${me.core.achievement.of}` : 'nothing due yet'}
              </span>
              <span className="perf-headline-team">Team {pct(rate(all.core.achievement.hit, all.core.achievement.of))}</span>
            </div>

            <StatBlock title="🎯 Core KPI" s={me.core} type={type} />
            <StatBlock title="All work" s={me.all} type={type} extra />

            {rows.length > 1 && (
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Achievement</th>
                    <th>Completion</th>
                    <th>{type === 'turnaround' ? 'Within target' : 'On time'}</th>
                    <th>Overdue</th>
                    <th>Team</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.project.id}>
                      <td>{r.project.name}</td>
                      <td>{pct(rate(r.me.core.achievement.hit, r.me.core.achievement.of))}</td>
                      <td>{pct(r.me.all.completionRate)}</td>
                      <td>{pct(rate(r.me.all.onTime.hit, r.me.all.onTime.of))}</td>
                      <td>{r.me.all.overdue}</td>
                      <td>{pct(rate(r.team.core.achievement.hit, r.team.core.achievement.of))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </>
  );
}

function StatBlock({ title, s, type, extra = false }: { title: string; s: KpiStats; type: KpiType; extra?: boolean }) {
  const onTime = rate(s.onTime.hit, s.onTime.of);
  return (
    <div className="perf-block">
      <h4 className="perf-block-title">{title}</h4>
      <div className="perf-tiles">
        <Tile label="Assigned" value={s.assigned} hint="Given to you in this period" />
        <Tile label="Completed" value={s.completed} hint="Of those, how many are done" />
        <Tile label="Pending" value={s.pending} hint="Open now, not yet past the deadline" />
        <Tile label="Overdue" value={s.overdue} hint="Open now and past the deadline" warn={s.overdue > 0} />
        <Tile label="Completion" value={pct(s.completionRate)} hint="Completed ÷ assigned" />
        <Tile
          label={type === 'turnaround' ? 'Within target' : 'On time'}
          value={pct(onTime)}
          hint={type === 'turnaround' ? 'Closed within the target for its priority (High 1, Medium 3, Low 5 working days)' : 'Finished by the final due date, extensions included'}
          sub={s.onTime.extended ? `⏱ ${s.onTime.extended} extended` : undefined}
        />
        {type === 'turnaround' && <Tile label="Median time" value={daysText(s.medianDays)} hint="Working days from being handed the ticket to closing it" />}
        {extra && <Tile label="Self-created" value={s.selfCreated} hint="Tasks you made for yourself" />}
        {extra && <Tile label="Tickets" value={s.tickets} hint="Tickets you were given" />}
      </div>
    </div>
  );
}

function Tile({ label, value, hint, sub, warn = false }: { label: string; value: string | number; hint: string; sub?: string; warn?: boolean }) {
  return (
    <div className="perf-tile" title={hint}>
      <span className="perf-tile-label">{label}</span>
      <span className={`perf-tile-value${warn ? ' is-warn' : ''}`}>{value}</span>
      {sub && <span className="perf-muted">{sub}</span>}
    </div>
  );
}
