/** Parse `orderId` (and optional `restaurantId`) from Expo / dev-client URLs that include `payment-return`. */
export function parseOrderIdFromPaymentReturnUrl(url: string): string | null {
  const p = parsePaymentReturnParams(url);
  return p?.orderId ?? null;
}

export function parsePaymentReturnParams(url: string): { orderId: string; restaurantId?: string } | null {
  if (!url || !/payment-return/i.test(url)) return null;
  const om = url.match(/[?&]orderId=([^&?#]+)/i);
  if (!om?.[1]) return null;
  let orderId: string;
  try {
    orderId = decodeURIComponent(om[1]);
  } catch {
    orderId = om[1];
  }
  const rm = url.match(/[?&]restaurantId=([^&?#]+)/i);
  let restaurantId: string | undefined;
  if (rm?.[1]) {
    try {
      restaurantId = decodeURIComponent(rm[1]);
    } catch {
      restaurantId = rm[1];
    }
  }
  return { orderId, restaurantId };
}
