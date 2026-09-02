'use client';

import { CheckCircle2, AlertCircle, Zap } from 'lucide-react';

interface TaskStatsProps {
  total: number;
  completed: number;
  incomplete: number;
  overdue: number;
  highPriority: number;
}

export function TaskStats({ total, completed, incomplete, overdue, highPriority }: TaskStatsProps) {
  const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          padding: '12px',
          borderRadius: '8px',
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent)',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Total Tasks
        </div>
        <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text)' }}>
          {total}
        </div>
      </div>

      <div
        style={{
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(76, 175, 80, 0.1)',
          border: '1px solid rgba(76, 175, 80, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
          <CheckCircle2 size={14} style={{ color: '#4CAF50' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Completed</span>
        </div>
        <div style={{ fontSize: '24px', fontWeight: 600, color: '#4CAF50' }}>
          {completed}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {completionPercent}% complete
        </div>
      </div>

      {overdue > 0 && (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(255, 143, 143, 0.1)',
            border: '1px solid rgba(255, 143, 143, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
            <AlertCircle size={14} style={{ color: '#FF8F8F' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Overdue</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#FF8F8F' }}>
            {overdue}
          </div>
        </div>
      )}

      {highPriority > 0 && (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(255, 167, 102, 0.1)',
            border: '1px solid rgba(255, 167, 102, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
            <Zap size={14} style={{ color: '#FFA766' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>High Priority</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#FFA766' }}>
            {highPriority}
          </div>
        </div>
      )}
    </div>
  );
}
