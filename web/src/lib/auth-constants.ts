/** Must match backend `guest.constants.ts` */
export const BUYER_GUEST_USER_EMAIL = 'guest-buyer@yamma.demo';
export const SELLER_GUEST_USER_EMAIL = 'guest-seller@yamma.demo';

export function isGuestUser(user: { email?: string | null } | null | undefined): boolean {
  const normalized = (user?.email ?? '').toLowerCase();
  return normalized === BUYER_GUEST_USER_EMAIL || normalized === SELLER_GUEST_USER_EMAIL;
}
