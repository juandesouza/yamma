'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@yamma/design-system';

export function SellerSetupRefresh() {
  const router = useRouter();
  return (
    <Button variant="secondary" className="mt-2" onClick={() => router.refresh()}>
      Reload page (apply demo restaurant)
    </Button>
  );
}
