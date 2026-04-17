# Yamma Design System – Gamified UX

## Gestures and motion

- **Swipe:** Browse restaurants (swipe right = like / add to shortlist, left = skip). Implement on web with pointer/touch and on mobile with `react-native-gesture-handler`.
- **Pull-to-refresh:** Animated feedback using `motionPresets.pullRefresh` (bounce easing).
- **Cart:** Animated drawer open/close; add-to-cart uses a small scale/bounce animation.
- **Page transitions:** Use `motionPresets.pageTransition` (smooth, 250ms).

## Micro-interactions

- Buttons: `active:scale-[0.98]` on tap.
- Cards: hover border and shadow; focus ring for accessibility.
- Reward: After order confirmation, trigger a short success animation (e.g. checkmark + confetti-style motion) using `motionPresets.reward`.

## Gamification elements

- **Progress:** Delivery status steps (pending → confirmed → … → delivered) with a clear progress indicator.
- **Reward animation:** On “Order confirmed”, play a success state (e.g. success toast + optional XP-style badge).
- **XP-style feedback:** Optional non-intrusive “+10 points” or similar; keep it subtle so it doesn’t clutter the UI.

## Implementation notes

- **Web:** Use CSS transitions and Tailwind; for swipe, use touch/pointer events or a small library (e.g. Framer Motion or a swipe hook).
- **Mobile:** Use `react-native-reanimated` and `react-native-gesture-handler` for gestures and haptic feedback where available.
- **Haptics:** On mobile, trigger light haptic on add-to-cart and on order confirm (e.g. `expo-haptics` or platform haptics).

All timing and easing come from `tokens/motion.ts` so web and mobile stay consistent.
