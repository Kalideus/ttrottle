'use client';

import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';

const SHORTCUTS: [string, string][] = [
  ['C', 'Create a task'],
  ['⌘ / Ctrl + K', 'Focus search'],
  ['⌘ / Ctrl + Enter', 'Send a comment, or save a description you’re editing'],
  ['Esc', 'Close the open panel or dialog'],
  ['?', 'Show this list'],
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEscapeToClose(onClose);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Keyboard shortcuts</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SHORTCUTS.map(([keys, label]) => (
              <tr key={keys}>
                <td style={{ padding: '8px 12px 8px 0', whiteSpace: 'nowrap' }}>
                  <kbd
                    style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--surface-alt)',
                      fontSize: '12px',
                      fontFamily: 'inherit',
                      color: 'var(--text)',
                    }}
                  >
                    {keys}
                  </kbd>
                </td>
                <td style={{ padding: '8px 0', fontSize: '13px', color: 'var(--text)' }}>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
