/**
 * Yamma Design System – Dynamic color system (2030 modern, dark-first)
 */

export const colors = {
  // Primary – warm accent (food/delivery)
  primary: {
    50: '#fff5eb',
    100: '#ffe4cc',
    200: '#ffc499',
    300: '#ff9d66',
    400: '#ff7733',
    500: '#ff5500',
    600: '#e64d00',
    700: '#cc4400',
    800: '#993300',
    900: '#662200',
  },
  // Neutrals – dark-first
  neutral: {
    0: '#ffffff',
    50: '#f7f7f8',
    100: '#e8e8ec',
    200: '#d0d1d8',
    300: '#a8aab5',
    400: '#7c7e8c',
    500: '#5c5e6b',
    600: '#40424d',
    700: '#2c2d35',
    800: '#1c1d23',
    900: '#0f1014',
  },
  // Semantic
  success: { main: '#22c55e', muted: '#166534' },
  warning: { main: '#eab308', muted: '#854d0e' },
  error: { main: '#ef4444', muted: '#991b1b' },
  info: { main: '#3b82f6', muted: '#1e40af' },
} as const;

export type ColorToken = keyof typeof colors;
