import type { ReactNode } from 'react';

type AdminModalProps = { children: ReactNode; label: string; onClose: () => void };

export function AdminModal({ children, label, onClose }: AdminModalProps) {
  return <div className="admin-modal__backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section aria-label={label} aria-modal="true" className="admin-modal" role="dialog">{children}</section></div>;
}
