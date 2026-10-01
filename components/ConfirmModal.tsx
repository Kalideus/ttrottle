'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useEscapeToClose } from '@/lib/useEscapeToClose';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// In-app replacement for window.confirm, styled like the other modals.
export function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmModalProps) {
  useEscapeToClose(onCancel);

  // portal to <body> so the table's layout and stacking can't clip or cover it (it's only mounted on click, never during SSR)
  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" role="alertdialog" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title" id="confirm-title">{title}</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="modal-btn ghost" onClick={onCancel}>Cancel</button>
          {/* focused so Enter confirms, like the browser dialog it replaces */}
          <button type="button" className="modal-btn primary" onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
