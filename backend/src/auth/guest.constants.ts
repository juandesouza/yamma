/** Reserved demo accounts for one-click guest entry */
export const BUYER_GUEST_USER_EMAIL = 'guest-buyer@yamma.demo';
export const SELLER_GUEST_USER_EMAIL = 'guest-seller@yamma.demo';

export const BUYER_GUEST_USER_NAME = 'Guest Buyer';
export const SELLER_GUEST_USER_NAME = 'Guest Seller';

/** Used only server-side to create/login the shared guest row; not accepted from clients on /auth/register */
export const GUEST_INTERNAL_PASSWORD = 'GuestYammaDemo2026!';

/**
 * bcrypt cost-10 hash of {@link GUEST_INTERNAL_PASSWORD}.
 * Keeps guest insert fast — runtime `bcrypt.hash` can cost hundreds of ms per cold login.
 */
export const GUEST_PASSWORD_BCRYPT_HASH =
  '$2b$10$wsXvSnEaFNXnScZxCgNqhOK/yy0AVxh2enzZifTANbizSxvhCmsi6';

export function isGuestUserEmail(email: string | undefined | null): boolean {
  const normalized = (email ?? '').toLowerCase();
  return normalized === BUYER_GUEST_USER_EMAIL || normalized === SELLER_GUEST_USER_EMAIL;
}
