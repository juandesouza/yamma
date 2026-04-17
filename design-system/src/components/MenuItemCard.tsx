'use client';

import React from 'react';

export interface MenuItemCardProps {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  currency?: string;
  onAdd?: () => void;
  className?: string;
}

export function MenuItemCard({
  name,
  description,
  price,
  imageUrl,
  currency = 'USD',
  onAdd,
  className = '',
}: MenuItemCardProps) {
  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(price);

  return (
    <article
      className={[
        'flex gap-4 rounded-xl border border-[var(--yamma-border)] bg-[var(--yamma-surface)] p-4',
        'transition-all duration-200 hover:border-[var(--yamma-border-muted)]',
        className,
      ].join(' ')}
    >
      <div className="flex-1 min-w-0">
        <h4 className="truncate font-medium text-[var(--yamma-text)]">{name}</h4>
        {description && (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--yamma-text-muted)]">{description}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="font-semibold text-[var(--yamma-primary)]">{formattedPrice}</span>
          {onAdd && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="rounded-lg bg-[var(--yamma-primary)] px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-[var(--yamma-primary-hover)] active:scale-95"
            >
              Add
            </button>
          )}
        </div>
      </div>
      {imageUrl && (
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--yamma-button-secondary-bg)]">
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        </div>
      )}
    </article>
  );
}
