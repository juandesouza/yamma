import { notFound } from 'next/navigation';
import { RestaurantMenuWithCart } from './restaurant-menu-with-cart';
import { RestaurantHeroImage } from './restaurant-hero-image';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getRestaurant(id: string) {
  try {
    const res = await fetch(`${API}/restaurants/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getMenus(id: string) {
  try {
    const res = await fetch(`${API}/restaurants/${id}/menus`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [restaurant, menus] = await Promise.all([getRestaurant(id), getMenus(id)]);
  if (!restaurant) notFound();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold text-[var(--yamma-text)]">{restaurant.name}</h1>
        <div className="mb-6 rounded-2xl bg-[var(--yamma-surface)] p-4">
          {restaurant.imageUrl ? (
            <RestaurantHeroImage
              src={restaurant.imageUrl}
              alt={restaurant.name}
              className="mb-3 h-40 w-full rounded-xl object-cover"
            />
          ) : (
            <div className="mb-3 flex h-40 items-center justify-center rounded-xl bg-[var(--yamma-button-secondary-bg)] text-5xl">🍽</div>
          )}
          <p className="text-[var(--yamma-text-muted)]">{restaurant.description ?? restaurant.cuisine ?? 'Restaurant'}</p>
        </div>
        <h2 className="mb-4 text-xl font-semibold text-[var(--yamma-text)]">Menu</h2>
        <RestaurantMenuWithCart restaurantId={id} menus={menus} />
      </main>
    </div>
  );
}
