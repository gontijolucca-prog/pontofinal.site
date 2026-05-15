// data-loader.js — loads items.json and derives filter universe.

export async function loadItems() {
  try {
    const res = await fetch('data/items.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    if (!Array.isArray(items)) throw new Error('items.json must be an array');
    return items;
  } catch (err) {
    console.warn('[data-loader] items.json not found or invalid:', err.message);
    return [];
  }
}

export function uniqueValues(items, key) {
  const set = new Set();
  items.forEach((it) => {
    if (it[key]) set.add(it[key]);
  });
  return Array.from(set).sort();
}

export function applyFilters(items, filters) {
  return items.filter((it) => {
    if (filters.brand && filters.brand !== 'all' && it.brand !== filters.brand) return false;
    if (filters.format && filters.format !== 'all' && it.format !== filters.format) return false;
    if (filters.month && filters.month !== 'all' && it.month !== filters.month) return false;
    if (filters.status && filters.status !== 'all' && it._status !== filters.status) return false;
    return true;
  });
}
