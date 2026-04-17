'use client';

import React, { useId } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-base rounded-xl',
  lg: 'px-4 py-3 text-lg rounded-xl',
};

export function Input({
  label,
  error,
  hint,
  size = 'md',
  fullWidth,
  className = '',
  id,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-[var(--yamma-text-secondary)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full border bg-[var(--yamma-button-secondary-bg)] text-[var(--yamma-text)] placeholder-[var(--yamma-placeholder)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--yamma-primary)] focus:border-transparent',
          error ? 'border-[#ef4444]' : 'border-[var(--yamma-border-muted)]',
          sizeClasses[size],
          className,
        ].join(' ')}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-[#ef4444]" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1 text-sm text-[var(--yamma-text-muted)]">
          {hint}
        </p>
      )}
    </div>
  );
}
