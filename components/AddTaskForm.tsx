'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface AddTaskFormProps {
  projectId: string;
  headingId?: string;
  parentTaskId?: string;
  onTaskAdd: (name: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
}

export function AddTaskForm({
  projectId,
  headingId,
  parentTaskId,
  onTaskAdd,
  onCancel,
  placeholder = 'Add a task…',
}: AddTaskFormProps) {
  const [taskName, setTaskName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onTaskAdd(taskName);
      setTaskName('');
      onCancel();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
      <input
        type="text"
        value={taskName}
        onChange={(e) => setTaskName(e.target.value)}
        placeholder={placeholder}
        autoFocus
        onBlur={() => {
          if (!taskName.trim()) onCancel();
        }}
        style={{
          flex: 1,
          padding: '8px 12px',
          border: '1px solid var(--accent)',
          borderRadius: '4px',
          fontSize: '14px',
          color: 'var(--text)',
          backgroundColor: 'var(--accent-soft)',
        }}
      />
      <button
        type="submit"
        disabled={!taskName.trim() || isSubmitting}
        style={{
          padding: '8px 12px',
          borderRadius: '4px',
          background: taskName.trim() ? 'var(--accent)' : 'var(--chrome-hover)',
          color: 'white',
          border: 'none',
          cursor: taskName.trim() ? 'pointer' : 'not-allowed',
          fontSize: '13px',
          fontWeight: 500,
          opacity: taskName.trim() ? 1 : 0.5,
        }}
      >
        {isSubmitting ? 'Adding…' : 'Add'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: '8px 12px',
          borderRadius: '4px',
          background: 'rgba(214, 69, 69, 0.1)',
          color: '#D64545',
          border: '1px solid rgba(214, 69, 69, 0.3)',
          cursor: 'pointer',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <Trash2 size={14} />
        Cancel
      </button>
    </form>
  );
}
