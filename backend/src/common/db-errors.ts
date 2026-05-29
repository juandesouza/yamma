/** Detect Postgres / DNS connection failures (paused nHost, wrong DATABASE_URL, etc.). */
export function isDatabaseConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const code = e.code ?? '';
  const msg = typeof e.message === 'string' ? e.message : '';
  return (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('getaddrinfo')
  );
}

export const DATABASE_UNAVAILABLE_MESSAGE =
  'Database is unreachable. In Render (yamma-api), set DATABASE_URL to the current connection string from your nHost dashboard (paused projects may get a new hostname after wake).';
