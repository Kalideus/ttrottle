'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEscapeToClose } from '@/lib/useEscapeToClose';
import { getPerformanceData, getMembersByProject, type Project, type ProjectMember } from '@/lib/supabase/queries';
import { computeKpi, rate, weeklyTrend, type KpiBucket, type KpiStats, type KpiTask } from '@/lib/kpi';

interface PerformanceProps {
  supabase: SupabaseClient;
  currentUserId: string | null;
  projects: Project[];
  myRoles: Map<string, ProjectMember['role']>;
  isSuperAdmin: boolean;
  onOpenTask: (projectId: string, taskId: string) => void;
}

type KpiType = 'deadline' | 'turnaround';
const kpiType = (p: Project): KpiType => p.kpi_type ?? 'deadline';
const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);
const daysText = (d: number | null) => (d === null ? '—' : `${d.toFixed(1)} days`);
// 90-day window, plus room for the 12-week trend
const HISTORY_DAYS = 180;

// Performance dashboard: everyone sees their own numbers against their team's; managers also get a Team tab
// comparing the people in the projects they manage (a super admin: every project).
export function Performance({ supabase, currentUserId, projects, myRoles, isSuperAdmin, onOpenTask }: PerformanceProps) {
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

  const [data, setData] = useState<{ tasks: KpiTask[]; extended: Extensions } | null>(null);
  // the tasks behind a number someone clicked
  const [drill, setDrill] = useState<DrillRequest | null>(null);
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

  // the people in these projects: the Team tab's list, and names in the task list
  const [members, setMembers] = useState<Map<string, ProjectMember[]>>(new Map());

  useEffect(() => {
    if (!loadIds) return;
    let live = true;
    void getMembersByProject(supabase, loadIds.split(',')).then((m) => live && setMembers(m));
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
          <TeamView
            projects={projectId ? managed.filter((p) => p.id === projectId) : managed}
            members={members}
            tasks={data.tasks}
            extended={data.extended}
            days={days}
            onDrill={setDrill}
          />
        ) : (
          <MemberView
            userId={currentUserId}
            projects={projectId ? mine.filter((p) => p.id === projectId) : mine}
            tasks={data.tasks}
            extended={data.extended}
            days={days}
            onDrill={setDrill}
          />
        )}
      </div>
      {drill && data && (
        <DrillList
          request={drill}
          tasks={data.tasks}
          extended={data.extended}
          projects={projects}
          members={members}
          onOpen={(t) => {
            setDrill(null);
            onOpenTask(t.project_id, t.id);
          }}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}

// task id -> the dates its approved extensions moved it to
type Extensions = Map<string, string[]>;
type DrillRequest = { title: string; ids: string[]; s: KpiStats };
type Drill = (r: DrillRequest) => void;

const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00` : iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// The tasks behind a number: what each one was measured on, and clicking one opens it in its project.
function DrillList({ request, tasks, extended, projects, members, onOpen, onClose }: { request: DrillRequest; tasks: KpiTask[]; extended: Extensions; projects: Project[]; members: Map<string, ProjectMember[]>; onOpen: (t: KpiTask) => void; onClose: () => void }) {
  useEscapeToClose(onClose);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const names = new Map([...members.values()].flat().filter((m) => m.profile_id).map((m) => [m.profile_id as string, m.profile?.name ?? m.email]));
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const { s } = request;
  const status = (id: string) =>
    s.ids.overdue.includes(id) ? ['Overdue', 'is-bad']
      : s.ids.late.includes(id) ? ['Late', 'is-bad']
      : s.ids.missed.includes(id) ? ['Missed', 'is-bad']
      : s.ids.onTime.includes(id) || s.ids.achieved.includes(id) ? ['On time', 'is-good']
      : s.ids.pending.includes(id) ? ['Open', '']
      : s.ids.completed.includes(id) ? ['Done', ''] : ['', ''];
  // soonest due first; no due date last
  const rows = request.ids
    .map((id) => byId.get(id))
    .filter((t): t is KpiTask => !!t)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card perf-drill" role="dialog" aria-labelledby="perf-drill-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title" id="perf-drill-title">{request.title} ({rows.length})</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {!rows.length ? (
          <p className="modal-message">No tasks here.</p>
        ) : (
          <ul className="perf-drill-list">
            {rows.map((t) => {
              const [label, tone] = status(t.id);
              const ext = extended.get(t.id);
              return (
                <li key={t.id}>
                  <button className="perf-drill-task" onClick={() => onOpen(t)}>
                    <span className="perf-drill-name">{t.name}</span>
                    {label && <span className={`perf-drill-status ${tone}`}>{label}</span>}
                  </button>
                  <span className="perf-drill-meta">
                    {[
                      projectName.get(t.project_id),
                      t.assignee_id && names.get(t.assignee_id),
                      t.due_date && `due ${shortDate(t.due_date)}`,
                      t.completed_at && `done ${shortDate(t.completed_at)}`,
                      ext && `⏱ extended to ${ext.map(shortDate).join(', then ')}`,
                      t.kpi && t.kpi_by && t.kpi_by !== t.assignee_id
                        ? `🎯 by ${names.get(t.kpi_by) ?? 'a manager'}${t.kpi_at ? `, ${shortDate(t.kpi_at)}` : ''}`
                        : t.created_by === t.assignee_id ? 'self-made' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}

function MemberView({ userId, projects, tasks, extended, days, onDrill }: { userId: string | null; projects: Project[]; tasks: KpiTask[]; extended: Extensions; days: number; onDrill: Drill }) {
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
        const achieved = (s: Both) => rate(s.core.achievement.hit, s.core.achievement.of);
        const myTrend = weeklyTrend(team.filter(isMine), ctx, achieved, WEEKS);
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
              <button
                className="perf-headline-value perf-link"
                onClick={() => onDrill({ title: '🎯 Due in this period', ids: [...me.core.ids.missed, ...me.core.ids.achieved], s: me.core })}
              >
                {pct(rate(me.core.achievement.hit, me.core.achievement.of))}
              </button>
              <span className="perf-muted">
                {me.core.achievement.of ? `${me.core.achievement.hit} of ${me.core.achievement.of}` : 'nothing due yet'}
              </span>
              <Sparkline values={myTrend} format="pct" label="Your KPI achievement, week by week" />
              <span className="perf-headline-team">Team {pct(achieved(all))}</span>
            </div>

            <StatBlock title="🎯 Core KPI" s={me.core} type={type} onDrill={onDrill} />
            <StatBlock title="All work" s={me.all} type={type} extra onDrill={onDrill} />

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

function StatBlock({ title, s, type, extra = false, onDrill }: { title: string; s: KpiStats; type: KpiType; extra?: boolean; onDrill: Drill }) {
  const onTime = rate(s.onTime.hit, s.onTime.of);
  const onTimeLabel = type === 'turnaround' ? 'Within target' : 'On time';
  const open = (label: string, ids: string[]) => () => onDrill({ title: `${title}: ${label}`, ids, s });
  return (
    <div className="perf-block">
      <h4 className="perf-block-title">{title}</h4>
      <div className="perf-tiles">
        <Tile label="Assigned" value={s.assigned} hint="Given to you in this period" onClick={open('assigned', s.ids.assigned)} />
        <Tile label="Completed" value={s.completed} hint="Of those, how many are done" onClick={open('completed', s.ids.completed)} />
        <Tile label="Pending" value={s.pending} hint="Open now, not yet past the deadline" onClick={open('pending', s.ids.pending)} />
        <Tile label="Overdue" value={s.overdue} hint="Open now and past the deadline" warn={s.overdue > 0} onClick={open('overdue', s.ids.overdue)} />
        <Tile label="Completion" value={pct(s.completionRate)} hint="Completed ÷ assigned" onClick={open('assigned', s.ids.assigned)} />
        <Tile
          label={onTimeLabel}
          value={pct(onTime)}
          hint={type === 'turnaround' ? 'Closed within the target for its priority (High 1, Medium 3, Low 5 working days)' : 'Finished by the final due date, extensions included'}
          sub={s.onTime.extended ? `⏱ ${s.onTime.extended} extended` : undefined}
          onClick={open(onTimeLabel.toLowerCase(), [...s.ids.late, ...s.ids.onTime])}
        />
        {type === 'turnaround' && <Tile label="Median time" value={daysText(s.medianDays)} hint="Working days from being handed the ticket to closing it" />}
        {extra && <Tile label="Self-created" value={s.selfCreated} hint="Tasks you made for yourself" onClick={open('self-created', s.ids.selfCreated)} />}
        {extra && <Tile label="Tickets" value={s.tickets} hint="Tickets you were given" onClick={open('tickets', s.ids.tickets)} />}
      </div>
    </div>
  );
}

function Tile({ label, value, hint, sub, warn = false, onClick }: { label: string; value: string | number; hint: string; sub?: string; warn?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <span className="perf-tile-label">{label}</span>
      <span className={`perf-tile-value${warn ? ' is-warn' : ''}`}>{value}</span>
      {sub && <span className="perf-muted">{sub}</span>}
    </>
  );
  return onClick ? (
    <button className="perf-tile is-link" title={`${hint}. Click to see the tasks`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="perf-tile" title={hint}>
      {body}
    </div>
  );
}

type Person = { id: string; name: string };
type Both = { core: KpiStats; all: KpiStats };
type Format = 'pct' | 'count' | 'days';
type Metric = { key: string; label: string; format: Format; value: (s: Both) => number | null; techOnly?: boolean; lowIsGood?: boolean };

// what the bar chart can rank by; the table shows all of them
const METRICS: Metric[] = [
  { key: 'achievement', label: '🎯 KPI achievement', format: 'pct', value: (s) => rate(s.core.achievement.hit, s.core.achievement.of) },
  { key: 'onTime', label: '🎯 On time', format: 'pct', value: (s) => rate(s.core.onTime.hit, s.core.onTime.of) },
  { key: 'completion', label: '🎯 Completion', format: 'pct', value: (s) => s.core.completionRate },
  { key: 'overdue', label: '🎯 Overdue now', format: 'count', value: (s) => s.core.overdue, lowIsGood: true },
  { key: 'median', label: '🎯 Median time', format: 'days', value: (s) => s.core.medianDays, techOnly: true, lowIsGood: true },
  { key: 'allOnTime', label: 'All work: on time', format: 'pct', value: (s) => rate(s.all.onTime.hit, s.all.onTime.of) },
  { key: 'allCompletion', label: 'All work: completion', format: 'pct', value: (s) => s.all.completionRate },
];
const show = (v: number | null, f: Format) => (f === 'pct' ? pct(v) : f === 'days' ? daysText(v) : v === null ? '—' : String(v));
const techLabel = (label: string, type: KpiType) => (type === 'turnaround' ? label.replace('On time', 'Within target').replace('on time', 'within target') : label);

function TeamView({ projects, members, tasks, extended, days, onDrill }: { projects: Project[]; members: Map<string, ProjectMember[]>; tasks: KpiTask[]; extended: Extensions; days: number; onDrill: Drill }) {
  const people = useMemo(() => {
    const byId = new Map<string, Person>();
    for (const p of projects)
      for (const m of members.get(p.id) ?? [])
        if (m.profile_id && !byId.has(m.profile_id)) byId.set(m.profile_id, { id: m.profile_id, name: m.profile?.name ?? m.email });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, members]);
  // who's switched off; someone new to the team shows up ticked
  const [off, setOff] = useState<Set<string>>(new Set());
  const chosen = people.filter((p) => !off.has(p.id));
  const toggle = (id: string) =>
    setOff((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const kinds = (['deadline', 'turnaround'] as const)
    .map((type) => ({ type, projects: projects.filter((p) => kpiType(p) === type) }))
    .filter((k) => k.projects.length);
  const withWork = kinds.filter((k) => tasks.some((t) => t.assignee_id && k.projects.some((p) => p.id === t.project_id)));
  const shown = withWork.length ? withWork : kinds.slice(0, 1);

  if (!people.length) return <p className="perf-empty">{members.size ? 'Nobody in these projects yet.' : 'Loading…'}</p>;

  return (
    <>
      <div className="perf-chips" role="group" aria-label="Team members">
        <button className="perf-chip" onClick={() => setOff(off.size ? new Set() : new Set(people.map((p) => p.id)))}>
          {off.size ? 'Select all' : 'Clear all'}
        </button>
        {people.map((p) => (
          <button key={p.id} className={`perf-chip${off.has(p.id) ? '' : ' is-on'}`} aria-pressed={!off.has(p.id)} onClick={() => toggle(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      {!chosen.length ? (
        <p className="perf-empty" style={{ marginTop: 16 }}>Pick someone to compare.</p>
      ) : (
        shown.map((k) => (
          <TeamSection
            key={k.type}
            type={k.type}
            title={shown.length > 1 ? (k.type === 'turnaround' ? 'Tech' : 'Deadline work') : null}
            projects={k.projects}
            people={chosen}
            tasks={tasks}
            extended={extended}
            days={days}
            onDrill={onDrill}
          />
        ))
      )}
    </>
  );
}

type Col = { key: string; label: string; value: (s: Both) => number | null; format: Format; all?: boolean };

function TeamSection({ type, title, projects, people, tasks, extended, days, onDrill }: { type: KpiType; title: string | null; projects: Project[]; people: Person[]; tasks: KpiTask[]; extended: Extensions; days: number; onDrill: Drill }) {
  const [metricKey, setMetricKey] = useState('achievement');
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: 'achievement', desc: true });
  const metrics = METRICS.filter((m) => !m.techOnly || type === 'turnaround');
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const { rows, team, ctx, mineOf, teamTasks } = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const ctx = { now: new Date(), days, extended, turnaround: new Set(projects.filter((p) => kpiType(p) === 'turnaround').map((p) => p.id)) };
    const scoped = tasks.filter((t) => ids.has(t.project_id));
    const who = new Set(people.map((p) => p.id));
    const mineOf = (id: string) => scoped.filter((t) => t.assignee_id === id);
    const teamTasks = scoped.filter((t) => t.assignee_id && who.has(t.assignee_id));
    return {
      rows: people.map((person) => ({ person, s: computeKpi(mineOf(person.id), ctx) })),
      team: computeKpi(teamTasks, ctx),
      ctx,
      mineOf,
      teamTasks,
    };
  }, [projects, people, tasks, extended, days]);

  // the chosen metric week by week, per person and for the team (overdue: the average per person)
  const trends = useMemo(() => {
    const byPerson = new Map(people.map((p) => [p.id, weeklyTrend(mineOf(p.id), ctx, metric.value, WEEKS)]));
    const perHead = (s: Both) => (metric.key === 'overdue' ? s.core.overdue / Math.max(1, people.length) : metric.value(s));
    return { byPerson, team: weeklyTrend(teamTasks, ctx, perHead, WEEKS) };
  }, [people, mineOf, teamTasks, ctx, metric]);

  // people on the overlay chart, each keeping their colour until taken off (max 5)
  const [overlay, setOverlay] = useState<{ id: string; slot: number }[]>([]);
  const onOverlay = overlay.filter((o) => people.some((p) => p.id === o.id));
  const toggleOverlay = (id: string) =>
    setOverlay((o) => {
      if (o.some((x) => x.id === id)) return o.filter((x) => x.id !== id);
      const slot = SERIES.findIndex((_, i) => !o.some((x) => x.slot === i));
      return slot < 0 ? o : [...o, { id, slot }];
    });

  // bars: best first (fewest for overdue and time), people with nothing to measure at the bottom
  const ranked = [...rows].sort((a, b) => {
    const x = metric.value(a.s);
    const y = metric.value(b.s);
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1;
    return metric.lowIsGood ? x - y : y - x;
  });
  const max = metric.format === 'pct' ? 1 : Math.max(1e-9, ...rows.map((r) => metric.value(r.s) ?? 0));
  // the team's figure; for overdue, the average per person
  const teamValue = metric.key === 'overdue' ? team.core.overdue / rows.length : metric.value(team);

  const cols: Col[] = [
    { key: 'assigned', label: 'Assigned', value: (s) => s.core.assigned, format: 'count' },
    { key: 'completed', label: 'Done', value: (s) => s.core.completed, format: 'count' },
    { key: 'pending', label: 'Pending', value: (s) => s.core.pending, format: 'count' },
    { key: 'overdue', label: 'Overdue', value: (s) => s.core.overdue, format: 'count' },
    { key: 'completion', label: 'Completion', value: (s) => s.core.completionRate, format: 'pct' },
    { key: 'onTime', label: techLabel('On time', type), value: (s) => rate(s.core.onTime.hit, s.core.onTime.of), format: 'pct' },
    { key: 'extended', label: '⏱ Ext.', value: (s) => s.core.onTime.extended, format: 'count' },
    { key: 'achievement', label: 'Achievement', value: (s) => rate(s.core.achievement.hit, s.core.achievement.of), format: 'pct' },
    ...(type === 'turnaround' ? [{ key: 'median', label: 'Median', value: (s: Both) => s.core.medianDays, format: 'days' as const }] : []),
    { key: 'allCompleted', label: 'Done', value: (s) => s.all.completed, format: 'count', all: true },
    { key: 'allOnTime', label: techLabel('On time', type), value: (s) => rate(s.all.onTime.hit, s.all.onTime.of), format: 'pct', all: true },
    { key: 'selfCreated', label: 'Self-made', value: (s) => s.all.selfCreated, format: 'count', all: true },
  ];
  const coreCount = cols.filter((c) => !c.all).length;
  const sortCol = cols.find((c) => c.key === sort.key);
  const tableRows = [...rows].sort((a, b) => {
    const byName = a.person.name.localeCompare(b.person.name);
    if (!sortCol) return sort.desc ? -byName : byName;
    const x = sortCol.value(a.s) ?? -Infinity;
    const y = sortCol.value(b.s) ?? -Infinity;
    return (sort.desc ? y - x : x - y) || byName;
  });
  const sortBy = (key: string) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'name' }));
  const arrow = (key: string) => (sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : '');
  const edge = (c: Col) => (c.key === 'allCompleted' ? 'perf-group-start' : undefined);
  // the tasks behind a cell
  const cellIds = (c: Col, both: Both): string[] => {
    const { ids } = c.all ? both.all : both.core;
    if (c.key === 'onTime' || c.key === 'allOnTime') return [...ids.late, ...ids.onTime];
    if (c.key === 'achievement') return [...ids.missed, ...ids.achieved];
    if (c.key === 'completion' || c.key === 'assigned') return ids.assigned;
    if (c.key === 'median' || c.key === 'allCompleted') return ids.completed;
    return ids[c.key as KpiBucket] ?? [];
  };
  const cell = (c: Col, both: Both, who: string) => (
    <td key={c.key} className={edge(c)}>
      <button
        className="perf-link"
        title="See the tasks"
        onClick={() => onDrill({ title: `${who} · ${c.all ? 'All work' : '🎯'} ${c.label}`, ids: cellIds(c, both), s: c.all ? both.all : both.core })}
      >
        {show(c.value(both), c.format)}
      </button>
    </td>
  );

  return (
    <section className="perf-section perf-team-section">
      {title && <h3 className="perf-section-title">{title}</h3>}

      <div className="perf-compare-head">
        <label className="perf-muted" htmlFor={`perf-metric-${type}`}>Compare by</label>
        <select id={`perf-metric-${type}`} className="modal-input contacts-filter" value={metric.key} onChange={(e) => setMetricKey(e.target.value)}>
          {metrics.map((m) => (
            <option key={m.key} value={m.key}>{techLabel(m.label, type)}</option>
          ))}
        </select>
        {teamValue !== null && (
          <span className="perf-muted">┊ Team {metric.key === 'overdue' ? `${teamValue.toFixed(1)} each` : show(teamValue, metric.format)}</span>
        )}
      </div>

      <div className="perf-bars" role="list">
        {ranked.map(({ person, s }) => {
          const v = metric.value(s);
          return (
            <div key={person.id} className="perf-bar-row" role="listitem" title={`${person.name}: ${show(v, metric.format)}`}>
              <span className="perf-bar-name">{person.name}</span>
              <span className="perf-bar-track">
                {v !== null && <span className="perf-bar" style={{ width: `${Math.max(0.5, (v / max) * 100)}%` }} />}
                {teamValue !== null && <span className="perf-bar-team" style={{ left: `${Math.min(100, (teamValue / max) * 100)}%` }} aria-hidden />}
              </span>
              <span className="perf-bar-value">{show(v, metric.format)}</span>
            </div>
          );
        })}
      </div>

      <h4 className="perf-block-title" style={{ marginTop: 24 }}>Over {WEEKS} weeks: {techLabel(metric.label, type)}</h4>
      {onOverlay.length ? (
        <TrendChart
          format={metric.format}
          team={trends.team}
          lines={onOverlay.map((o) => ({
            id: o.id,
            name: people.find((p) => p.id === o.id)?.name ?? '',
            color: SERIES[o.slot],
            values: trends.byPerson.get(o.id) ?? [],
          }))}
        />
      ) : (
        <p className="perf-muted" style={{ margin: 0 }}>Click someone’s trend in the table to compare them over time (up to {SERIES.length}).</p>
      )}

      <div className="perf-table-wrap">
        <table className="perf-table">
          <thead>
            <tr className="perf-table-groups">
              <th colSpan={2} />
              <th colSpan={coreCount}>🎯 Core KPI</th>
              <th colSpan={cols.length - coreCount} className="perf-group-start">All work</th>
            </tr>
            <tr>
              <th>
                <button className="perf-sort" onClick={() => sortBy('name')}>Person{arrow('name')}</button>
              </th>
              <th>Trend</th>
              {cols.map((c) => (
                <th key={c.key} className={edge(c)} aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
                  <button className="perf-sort" onClick={() => sortBy(c.key)}>{c.label}{arrow(c.key)}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ person, s }) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td>
                  {(() => {
                    const o = onOverlay.find((x) => x.id === person.id);
                    const full = !o && onOverlay.length >= SERIES.length;
                    return (
                      <button
                        className={`perf-spark-btn${o ? ' is-on' : ''}`}
                        style={o ? { borderColor: SERIES[o.slot] } : undefined}
                        aria-pressed={!!o}
                        disabled={full}
                        title={full ? `Up to ${SERIES.length} people at once` : o ? 'Take off the chart' : 'Add to the chart above'}
                        onClick={() => toggleOverlay(person.id)}
                      >
                        <Sparkline values={trends.byPerson.get(person.id) ?? []} format={metric.format} label={`${person.name}, ${metric.label}`} />
                      </button>
                    );
                  })()}
                </td>
                {cols.map((c) => (
                  cell(c, s, person.name)
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Team</td>
              <td>
                <Sparkline values={trends.team} format={metric.format} label={`Team, ${metric.label}`} />
              </td>
              {cols.map((c) => (
                cell(c, team, 'Team')
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

// line colours for the trend overlay, in a fixed order; checked for colour-blind separation on the white surface.
// Three are pale on white, so each line is always named in the legend and the hover readout.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const WEEKS = 12;
const weekLabel = (i: number) => (i === WEEKS - 1 ? 'This week' : `${WEEKS - 1 - i} wk ago`);

// segments of a line, broken where a week has nothing to measure
function linePath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) return void (pen = false);
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

function Sparkline({ values, format, label }: { values: (number | null)[]; format: Format; label: string }) {
  const known = values.filter((v): v is number => v !== null);
  const W = 84;
  const H = 22;
  if (known.length < 2) return <span className="perf-muted" title={`${label}: not enough weeks yet`}>—</span>;
  const top = format === 'pct' ? 1 : Math.max(1e-9, ...known);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (W - 4);
  const y = (v: number) => H - 2 - (v / top) * (H - 4);
  const last = values.length - 1;
  return (
    <svg className="perf-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${show(known[0], format)} to ${show(known[known.length - 1], format)} over ${WEEKS} weeks`}>
      <title>{values.map((v, i) => `${weekLabel(i)}: ${show(v, format)}`).join('\n')}</title>
      <path d={linePath(values, x, y)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {values[last] !== null && <circle cx={x(last)} cy={y(values[last] as number)} r="2.5" fill="var(--accent)" />}
    </svg>
  );
}

function TrendChart({ lines, team, format }: { lines: { id: string; name: string; color: string; values: (number | null)[] }[]; team: (number | null)[]; format: Format }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { l: 44, r: 12, t: 10, b: 24 };
  const all = [...team, ...lines.flatMap((l) => l.values)].filter((v): v is number => v !== null);
  const top = format === 'pct' ? 1 : Math.max(1e-9, ...all) * 1.1;
  const x = (i: number) => pad.l + (i / (WEEKS - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const ticks = [0, 0.5, 1].map((f) => f * top);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    setHover(Math.max(0, Math.min(WEEKS - 1, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (WEEKS - 1)))));
  };

  return (
    <div className="perf-trend">
      <svg viewBox={`0 0 ${W} ${H}`} className="perf-trend-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Weekly trend for the selected people">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="perf-axis">{show(t, format)}</text>
          </g>
        ))}
        <text x={x(0)} y={H - 6} className="perf-axis">{weekLabel(0)}</text>
        <text x={x(WEEKS - 1)} y={H - 6} textAnchor="end" className="perf-axis">{weekLabel(WEEKS - 1)}</text>
        <path d={linePath(team, x, y)} fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="5 4" />
        {lines.map((l) => (
          <path key={l.id} d={linePath(l.values, x, y)} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--text-muted)" strokeWidth="1" />
            {lines.map((l) =>
              l.values[hover] === null ? null : <circle key={l.id} cx={x(hover)} cy={y(l.values[hover] as number)} r="4" fill={l.color} stroke="var(--surface)" strokeWidth="2" />
            )}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="perf-trend-tip" style={{ left: `${Math.min(82, Math.max(18, (x(hover) / W) * 100))}%` }}>
          <strong>{weekLabel(hover)}</strong>
          {lines.map((l) => (
            <span key={l.id}>
              <i style={{ background: l.color }} /> {l.name} {show(l.values[hover], format)}
            </span>
          ))}
          <span>
            <i className="is-team" /> Team {show(team[hover], format)}
          </span>
        </div>
      )}
      <div className="perf-legend">
        {lines.map((l) => (
          <span key={l.id}>
            <i style={{ background: l.color }} /> {l.name} <b>{show(l.values[WEEKS - 1], format)}</b>
          </span>
        ))}
        <span>
          <i className="is-team" /> Team <b>{show(team[WEEKS - 1], format)}</b>
        </span>
      </div>
    </div>
  );
}
