'use client';

import { useState } from 'react';

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function RestaurantHeroImage({ src, alt, className }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-[var(--yamma-button-secondary-bg)] text-5xl ${className ?? ''}`}
        role="img"
        aria-label={alt}
      >
        🍽
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
