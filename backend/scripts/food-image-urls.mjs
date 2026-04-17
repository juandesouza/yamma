/**
 * Unsplash CDN URLs that return 200 for anonymous GET (reliable hotlinking for dev demos).
 * Pexels direct /photos/{id}/pexels-photo-{id}.jpeg often 404s for wrong IDs or non-standard paths.
 */
const q = 'auto=format&fit=crop&w=480&q=82';

/** @param {string} slug e.g. "1513104890138-7c749659a591" */
export function foodImageUrl(slug) {
  return `https://images.unsplash.com/photo-${slug}?${q}`;
}

function triple(slug) {
  const url = foodImageUrl(slug);
  return [url, url, url];
}

/** @type {Record<string, string[]>} */
export const IMAGE_BY_CUISINE = {
  Pizza: triple('1513104890138-7c749659a591'),
  Burger: triple('1568901346375-23c9450c58cd'),
  Sushi: triple('1579584425555-c3ce17fd4351'),
  Seafood: triple('1559339352-11d035aa65de'),
  BBQ: triple('1544025162-d76694265947'),
  Steakhouse: triple('1544025162-d76694265947'),
  Meat: triple('1600891964092-4316c288032e'),
  Mexican: triple('1565299585323-38174c58b7e1'),
  Italian: triple('1473093295043-cdd812d0e601'),
  Thai: triple('1559314809-0d155014e29e'),
  Indian: triple('1585937421612-70a008356fbe'),
  Chinese: triple('1598515214211-89d3c73ae83b'),
  Korean: triple('1604908176997-125f25cc6f3d'),
  Ramen: triple('1569718212165-3a8278d5f624'),
  Chicken: triple('1608039829572-78524f79c4c7'),
  Breakfast: triple('1504754524776-8f4f37790ca0'),
  Mediterranean: triple('1547592180-85f173990554'),
  Vegan: triple('1512621776951-a57141f2eefd'),
  Bakery: triple('1509440159596-0249088772ff'),
  Desserts: triple('1565958011703-44f9829ba187'),
};

export const DEFAULT_FOOD_IMAGES = IMAGE_BY_CUISINE.Pizza;
