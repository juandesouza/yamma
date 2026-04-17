/**
 * Yamma Design System – Spacing scale (4px base)
 */

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(0,0,0,0.25)',
  md: '0 4px 12px rgba(0,0,0,0.35)',
  lg: '0 8px 24px rgba(0,0,0,0.4)',
  glow: '0 0 24px rgba(255,85,0,0.2)',
  glass: '0 8px 32px rgba(0,0,0,0.3)',
} as const;
