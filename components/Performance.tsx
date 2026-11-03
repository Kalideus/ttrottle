'use client';

import { useState } from 'react';
import type { Project, ProjectMember } from '@/lib/supabase/queries';

interface PerformanceProps {
  projects: Project[];
  myRoles: Map<string, ProjectMember['role']>;
  isSuperAdmin: boolean;
}

// Performance dashboard: everyone sees their own numbers against their team's; managers also get a Team tab
// comparing the people in the projects they manage (a super admin: every project).
export function Performance({ projects, myRoles, isSuperAdmin }: PerformanceProps) {
  const managed = projects.filter((p) => isSuperAdmin || ['owner', 'admin'].includes(myRoles.get(p.id) ?? ''));
  const isManager = managed.length > 0;
  // roles can still be loading on first render: until someone picks a tab, a manager lands on Team
  const [picked, setTab] = useState<'me' | 'team' | null>(null);
  const tab = picked ?? (isManager ? 'team' : 'me');
  const [days, setDays] = useState<30 | 90>(30);
  const [projectId, setProjectId] = useState('');

  const showTeam = isManager && tab === 'team';
  const choices = showTeam ? managed : projects.filter((p) => myRoles.has(p.id));

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

      <div className="contacts-scroll" style={{ padding: '24px', color: 'var(--text-muted)', fontSize: 14 }}>
        {/* ponytail: placeholder until the member view (step 5) and team view (step 6) land */}
        {showTeam ? 'Team comparison coming next.' : 'Your numbers coming next.'}
      </div>
    </div>
  );
}
