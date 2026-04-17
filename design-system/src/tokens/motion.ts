/**
 * Yamma Design System – Motion presets (smooth, gamified)
 */

export const duration = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
} as const;

export const easing = {
  linear: 'linear',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
} as const;

export const motionPresets = {
  pageTransition: { duration: duration.normal, ease: easing.smooth },
  cardHover: { duration: duration.fast, ease: easing.easeOut },
  buttonTap: { duration: duration.instant },
  drawer: { duration: duration.slow, ease: easing.easeOut },
  reward: { duration: duration.slower, ease: easing.bounce },
  pullRefresh: { duration: duration.normal, ease: easing.bounce },
} as const;

export type MotionPreset = keyof typeof motionPresets;
