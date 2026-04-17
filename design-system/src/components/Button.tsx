'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--yamma-primary)] text-white hover:bg-[var(--yamma-primary-hover)] active:scale-[0.98] shadow-md hover:shadow-[0_0_24px_rgba(255,85,0,0.3)]',
  secondary:
    'bg-[var(--yamma-button-secondary-bg)] text-[var(--yamma-text)] border border-[var(--yamma-border-muted)] hover:bg-[var(--yamma-button-secondary-hover)] active:scale-[0.98]',
  ghost:
    'bg-transparent text-[var(--yamma-text-secondary)] hover:bg-[var(--yamma-button-secondary-bg)] active:scale-[0.98]',
  danger: 'bg-[#ef4444] text-white hover:bg-[#dc2626] active:scale-[0.98]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-base rounded-xl',
  lg: 'px-6 py-3 text-lg rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}
