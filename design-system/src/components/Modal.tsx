'use client';

import React, { useEffect } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  closeOnOverlayClick?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  full: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="presentation"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={title ? 'modal-title' : undefined}
        className={[
          'relative w-full rounded-2xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] shadow-[0_8px_32px_var(--yamma-shadow-soft)]',
          'animate-in zoom-in-95 fade-in duration-200',
          sizeClasses[size],
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--yamma-border)] p-4">
            <h2 id="modal-title" className="text-lg font-semibold text-[var(--yamma-text)]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--yamma-text-muted)] hover:bg-[var(--yamma-button-secondary-bg)] hover:text-[var(--yamma-text)]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
