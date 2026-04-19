import React, { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import type { NavigationContainerRef } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import type { BuyerStackParamList } from './types';
import { parsePaymentReturnParams } from './paymentReturnDeepLink';

type Props = {
  navigationRef: NavigationContainerRef<BuyerStackParamList>;
};

/**
 * When Lemon opens `exp://…/payment-return?orderId=…`, React Navigation does not map that path by
 * default — reset the buyer stack so the user lands on order status instead of Checkout.
 */
export function PaymentReturnDeepLink({ navigationRef }: Props) {
  const { user, ready } = useAuth();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !user || user.role === 'restaurant') return;

    function goToOrderTracking(url: string) {
      const parsed = parsePaymentReturnParams(url);
      if (!parsed?.orderId) return;
      if (lastUrl.current === url) return;
      lastUrl.current = url;

      if (!navigationRef.isReady()) return;

      try {
        navigationRef.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: 'Home', params: undefined },
              {
                name: 'OrderTracking',
                params: {
                  orderId: parsed.orderId,
                  ...(parsed.restaurantId ? { restaurantId: parsed.restaurantId } : {}),
                  clearCartOnEntry: true,
                },
              },
            ],
          }),
        );
      } catch {
        /* wrong navigator tree (e.g. auth screen) — ignore */
      }
    }

    const sub = Linking.addEventListener('url', ({ url }) => goToOrderTracking(url));
    void Linking.getInitialURL().then((url) => {
      if (url) goToOrderTracking(url);
    });
    return () => sub.remove();
  }, [ready, user, navigationRef]);

  return null;
}
