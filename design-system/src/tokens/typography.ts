/**
 * Yamma Design System – Futuristic typography scale
 */

export const fontFamily = {
  sans: '"DM Sans", "Inter", system-ui, sans-serif',
  display: '"Space Grotesk", "DM Sans", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", monospace',
} as const;

export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
  '4xl': '2.25rem',
  '5xl': '3rem',
  '6xl': '3.75rem',
} as const;

export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

export type TypographyScale = typeof fontSize;
