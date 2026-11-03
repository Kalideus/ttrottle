'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPerformanceData, getMembersByProject, type Project, type ProjectMember } from '@/lib/supabase/queries';
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

  // the people in the projects this manager runs, for the Team tab
  const [members, setMembers] = useState<Map<string, ProjectMember[]>>(new Map());
  const managedIds = managed.map((p) => p.id).sort().join(',');
  useEffect(() => {
    if (!managedIds) return;
    let live = true;
    void getMembersByProject(supabase, managedIds.split(',')).then((m) => live && setMembers(m));
    return () => {
      live = false;
    };
  }, [supabase, managedIds]);

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
          />
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

function TeamView({ projects, members, tasks, extended, days }: { projects: Project[]; members: Map<string, ProjectMember[]>; tasks: KpiTask[]; extended: Set<string>; days: number }) {
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
          />
        ))
      )}
    </>
  );
}

type Col = { key: string; label: string; value: (s: Both) => number | null; format: Format; all?: boolean };

function TeamSection({ type, title, projects, people, tasks, extended, days }: { type: KpiType; title: string | null; projects: Project[]; people: Person[]; tasks: KpiTask[]; extended: Set<string>; days: number }) {
  const [metricKey, setMetricKey] = useState('achievement');
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: 'achievement', desc: true });
  const metrics = METRICS.filter((m) => !m.techOnly || type === 'turnaround');
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const { rows, team } = useMemo(() => {
    const ids = new Set(projects.map((p) => p.id));
    const ctx = { now: new Date(), days, extended, turnaround: new Set(projects.filter((p) => kpiType(p) === 'turnaround').map((p) => p.id)) };
    const scoped = tasks.filter((t) => ids.has(t.project_id));
    const who = new Set(people.map((p) => p.id));
    return {
      rows: people.map((person) => ({ person, s: computeKpi(scoped.filter((t) => t.assignee_id === person.id), ctx) })),
      team: computeKpi(scoped.filter((t) => t.assignee_id && who.has(t.assignee_id)), ctx),
    };
  }, [projects, people, tasks, extended, days]);

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

      <div className="perf-table-wrap">
        <table className="perf-table">
          <thead>
            <tr className="perf-table-groups">
              <th />
              <th colSpan={coreCount}>🎯 Core KPI</th>
              <th colSpan={cols.length - coreCount} className="perf-group-start">All work</th>
            </tr>
            <tr>
              <th>
                <button className="perf-sort" onClick={() => sortBy('name')}>Person{arrow('name')}</button>
              </th>
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
                {cols.map((c) => (
                  <td key={c.key} className={edge(c)}>{show(c.value(s), c.format)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Team</td>
              {cols.map((c) => (
                <td key={c.key} className={edge(c)}>{show(c.value(team), c.format)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
