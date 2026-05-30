/**
 * After Lemon checkout, local dev often never gets webhooks / reliable sync.
 * In `next dev` only: try real sync, then optional fake confirm via backend dev endpoint.
 *
 * Set `NEXT_PUBLIC_DEV_FORCE_CONFIRM_PAYMENT_TOKEN` to match backend `DEV_FORCE_CONFIRM_PAYMENT_TOKEN`
 * when you require that header locally.
 */

function forceConfirmHeaders(): Record<string, string> {
  const t = process.env.NEXT_PUBLIC_DEV_FORCE_CONFIRM_PAYMENT_TOKEN?.trim();
  if (!t) return {};
  return { 'X-Yamma-Dev-Force-Confirm-Token': t };
}

export function shouldFakeConfirmPendingLemon(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** Ask the API to confirm a paid Lemon checkout (production-safe). */
export async function syncLemonOrderAfterReturn(orderId: string): Promise<boolean> {
  const syncRes = await fetch('/api/payments/lemon/sync-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ orderId }),
  });
  if (syncRes.ok) {
    const out = (await syncRes.json().catch(() => ({}))) as { status?: string };
    if (out.status === 'confirmed' || out.status === 'already_confirmed') return true;
  }
  const afterSync = await fetch(`/api/orders/${orderId}`, { credentials: 'include', cache: 'no-store' });
  if (afterSync.ok) {
    const row = (await afterSync.json()) as { status?: string };
    if (row?.status && row.status !== 'pending') return true;
  }
  return false;
}

/** Returns true if order is no longer pending (confirmed or beyond). */
export async function resolvePendingAfterLemonReturn(orderId: string): Promise<boolean> {
  if (await syncLemonOrderAfterReturn(orderId)) return true;

  if (!shouldFakeConfirmPendingLemon()) return false;

  const fc = await fetch('/api/payments/dev/force-confirm-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...forceConfirmHeaders() },
    credentials: 'include',
    body: JSON.stringify({ orderId }),
  });
  if (!fc.ok) return false;
  const out = (await fc.json().catch(() => ({}))) as { status?: string };
  if (out.status !== 'confirmed' && out.status !== 'already_confirmed') return false;

  const finalCheck = await fetch(`/api/orders/${orderId}`, { credentials: 'include', cache: 'no-store' });
  if (!finalCheck.ok) return false;
  const row = (await finalCheck.json()) as { status?: string };
  return Boolean(row?.status && row.status !== 'pending');
}
