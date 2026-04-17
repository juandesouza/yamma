/** Reserved demo accounts for one-click guest entry */
export const BUYER_GUEST_USER_EMAIL = 'guest-buyer@yamma.demo';
export const SELLER_GUEST_USER_EMAIL = 'guest-seller@yamma.demo';

export const BUYER_GUEST_USER_NAME = 'Guest Buyer';
export const SELLER_GUEST_USER_NAME = 'Guest Seller';

/** Used only server-side to create/login the shared guest row; not accepted from clients on /auth/register */
export const GUEST_INTERNAL_PASSWORD = 'GuestYammaDemo2026!';

export function isGuestUserEmail(email: string | undefined | null): boolean {
  const normalized = (email ?? '').toLowerCase();
  return normalized === BUYER_GUEST_USER_EMAIL || normalized === SELLER_GUEST_USER_EMAIL;
}
