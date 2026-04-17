/**
 * Yamma Design System – Theme (dark-first)
 */

import { colors } from './tokens/colors';
import { fontFamily, fontSize, fontWeight, lineHeight } from './tokens/typography';
import { spacing, radius, shadow } from './tokens/spacing';
import { motionPresets } from './tokens/motion';

export const theme = {
  colors: {
    ...colors,
    background: colors.neutral[900],
    surface: colors.neutral[800],
    surfaceElevated: colors.neutral[700],
    text: colors.neutral[0],
    textMuted: colors.neutral[400],
    border: colors.neutral[600],
  },
  typography: { fontFamily, fontSize, fontWeight, lineHeight },
  spacing,
  radius,
  shadow,
  motion: motionPresets,
} as const;

export type Theme = typeof theme;
