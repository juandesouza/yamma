const GUEST_EMAILS = new Set(['guest-buyer@yamma.demo', 'guest-seller@yamma.demo']);

export function isGuestUserEmail(email: string | undefined | null): boolean {
  return GUEST_EMAILS.has((email ?? '').toLowerCase());
}
