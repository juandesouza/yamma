export type StoredCartLine = {
  menuItemId: string;
  name: string;
  /** Two-decimal string for order API, e.g. "12.99" */
  unitPrice: string;
  quantity: number;
};

export function cartStorageKey(restaurantId: string): string {
  return `yamma-cart:${restaurantId}`;
}

export function loadCart(restaurantId: string): StoredCartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(cartStorageKey(restaurantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is StoredCartLine =>
        row &&
        typeof row === 'object' &&
        typeof (row as StoredCartLine).menuItemId === 'string' &&
        typeof (row as StoredCartLine).name === 'string' &&
        typeof (row as StoredCartLine).unitPrice === 'string' &&
        typeof (row as StoredCartLine).quantity === 'number'
    );
  } catch {
    return [];
  }
}

export function saveCart(restaurantId: string, items: StoredCartLine[]): void {
  localStorage.setItem(cartStorageKey(restaurantId), JSON.stringify(items));
}

export function addCartLine(
  restaurantId: string,
  line: { menuItemId: string; name: string; unitPrice: string }
): void {
  const cart = loadCart(restaurantId);
  const idx = cart.findIndex((x) => x.menuItemId === line.menuItemId);
  if (idx >= 0) {
    cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + 1 };
  } else {
    cart.push({ ...line, quantity: 1 });
  }
  saveCart(restaurantId, cart);
}

export function clearCart(restaurantId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(cartStorageKey(restaurantId));
}

/** Set when the buyer creates an order and reaches the payment step; used to clear the cart only after that order is paid. */
const AWAITING_PAYMENT_CART_KEY = 'yamma:awaiting-payment-cart';

export function setAwaitingPaymentCartClear(orderId: string, restaurantId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AWAITING_PAYMENT_CART_KEY, JSON.stringify({ orderId, restaurantId }));
  } catch {
    /* ignore quota / private mode */
  }
}

/** If session matches this order, clear that restaurant cart and drop the marker. Call when payment is confirmed for `orderId`. */
export function clearCartIfAwaitingOrderPaid(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(AWAITING_PAYMENT_CART_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { orderId?: string; restaurantId?: string };
    if (parsed.orderId !== orderId || typeof parsed.restaurantId !== 'string') return;
    clearCart(parsed.restaurantId);
    sessionStorage.removeItem(AWAITING_PAYMENT_CART_KEY);
  } catch {
    /* ignore */
  }
}

export function cartLineCount(restaurantId: string): number {
  return loadCart(restaurantId).reduce((sum, row) => sum + row.quantity, 0);
}

export function cartSubtotal(restaurantId: string): number {
  return loadCart(restaurantId).reduce(
    (sum, row) => sum + row.quantity * parseFloat(row.unitPrice || '0'),
    0
  );
}
