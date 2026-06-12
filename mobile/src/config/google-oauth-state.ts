function toBase64Url(json: string): string {
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('Could not encode Google OAuth state');
  }
  const b64 = globalThis.btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    ),
  );
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Pack Expo return URL into Google OAuth `state` so the API bridge can open the right deep link. */
export function packGoogleMobileOAuthState(csrfState: string, appReturnUrl: string): string {
  return toBase64Url(JSON.stringify({ c: csrfState, r: appReturnUrl }));
}

export function withGoogleMobileOAuthState(authUrl: string, appReturnUrl: string): string {
  const u = new URL(authUrl);
  const csrf = u.searchParams.get('state') ?? '';
  u.searchParams.set('state', packGoogleMobileOAuthState(csrf, appReturnUrl));
  return u.toString();
}
