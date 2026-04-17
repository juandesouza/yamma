'use client';

import React, { useState } from 'react';

export interface RestaurantCardProps {
  id: string;
  name: string;
  imageUrl?: string;
  cuisine?: string;
  /** Short blurb under the cuisine line */
  description?: string;
  rating?: number;
  deliveryTime?: string;
  distance?: string;
  isOpen?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onClick?: () => void;
  className?: string;
}

export function RestaurantCard({
  name,
  imageUrl,
  cuisine,
  description,
  rating = 0,
  deliveryTime,
  distance,
  isOpen = true,
  onClick,
  className = '',
}: RestaurantCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={[
        'flex flex-row items-stretch overflow-hidden rounded-xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)]',
        'min-h-[5.25rem] max-h-[6.25rem] sm:min-h-[5.75rem] sm:max-h-[6.75rem]',
        'hover:border-[var(--yamma-border-muted)] hover:shadow-[0_6px_20px_var(--yamma-shadow-soft)]',
        'transition-all duration-250 cursor-pointer',
        'focus:outline-none focus:ring-2 focus:ring-[var(--yamma-primary)] focus:ring-offset-2 focus:ring-offset-[var(--yamma-bg)]',
        className,
      ].join(' ')}
    >
      {/* ~30% width, full card height */}
      <div className="relative w-[30%] min-w-[4.5rem] shrink-0 basis-[30%] self-stretch bg-[var(--yamma-button-secondary-bg)]">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl text-[var(--yamma-placeholder)]">
            🍽
          </div>
        )}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white sm:text-xs">
          <span aria-hidden>⭐</span>
          <span>{rating.toFixed(1)}</span>
        </div>
        {!isOpen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <span className="rounded-full bg-[var(--yamma-surface)] px-2 py-0.5 text-[10px] text-[var(--yamma-text)] sm:text-xs">
              Closed
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 sm:px-3.5">
        <h3 className="truncate text-sm font-semibold leading-tight text-[var(--yamma-text)] sm:text-base">{name}</h3>
        {cuisine ? (
          <p className="truncate text-xs text-[var(--yamma-text-muted)] sm:text-sm">{cuisine}</p>
        ) : null}
        {description ? (
          <p className="line-clamp-1 text-xs leading-snug text-[var(--yamma-text-subtle)] sm:line-clamp-2">
            {description}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--yamma-text-muted)] sm:text-xs">
          {deliveryTime ? <span className="truncate">🕐 {deliveryTime}</span> : null}
          {distance ? (
            <span className="truncate font-medium text-[var(--yamma-text-secondary)]">📍 {distance}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
