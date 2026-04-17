/**
 * Parse hostname from a Postgres connection string for safe error messages (no password).
 * @param {string | undefined} connectionString
 * @returns {string | null}
 */
/**
 * @param {string | undefined} connectionString
 * @returns {object | undefined} pg `ssl` option, or undefined when SSL should be off (local dev)
 */
export function pgSslForUrl(connectionString) {
  const host = dbHostnameFromUrl(connectionString);
  if (!host) return { rejectUnauthorized: false };
  const local =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1';
  if (local) return undefined;
  return { rejectUnauthorized: false };
}

export function dbHostnameFromUrl(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') return null;
  try {
    const trimmed = connectionString.trim();
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `postgresql://${trimmed}`;
    const u = new URL(withProto);
    return u.hostname || null;
  } catch {
    return null;
  }
}

/**
 * Print actionable hints for common pg connection failures.
 * @param {unknown} err
 * @param {string | undefined} databaseUrl
 * @returns {boolean} true if hints were printed (caller may still log err.message)
 */
export function printDbConnectionHints(err, databaseUrl) {
  const code = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
  const host = dbHostnameFromUrl(databaseUrl);

  if (code === 'ENOTFOUND') {
    console.error('\n── Database: host not found (ENOTFOUND) ──');
    if (host) console.error(`  Hostname from DATABASE_URL: ${host}`);
    console.error('  Your machine could not resolve that name. Typical fixes:');
    console.error('  1. Open nHost Dashboard → your project → Database (PostgreSQL).');
    console.error('     Copy the **current** connection string and replace DATABASE_URL in backend/.env.');
    console.error('     (Hosts sometimes change after project moves or provider updates.)');
    console.error('  2. Check internet / VPN / DNS (try another network or `ping` the host).');
    console.error('  3. Use local Postgres for dev: postgresql://USER:PASS@localhost:5432/yamma\n');
    return true;
  }

  if (code === 'ECONNREFUSED') {
    console.error('\n── Database: connection refused ──');
    if (host) console.error(`  Host: ${host}`);
    console.error('  Postgres is not accepting connections on that host/port, or a firewall blocks it.\n');
    return true;
  }

  return false;
}
