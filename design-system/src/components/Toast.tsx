'use client';

import React, { useEffect } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-[#166534] border-[#22c55e] text-white',
  error: 'bg-[#991b1b] border-[#ef4444] text-white',
  info: 'bg-[#1e40af] border-[#3b82f6] text-white',
  warning: 'bg-[#854d0e] border-[#eab308] text-white',
};

export function Toast({
  message,
  variant = 'info',
  duration = 4000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return (
    <div
      role="alert"
      className={[
        'px-4 py-3 rounded-xl border shadow-lg flex items-center gap-2',
        variantStyles[variant],
      ].join(' ')}
    >
      <span>{message}</span>
    </div>
  );
}
