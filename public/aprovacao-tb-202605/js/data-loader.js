// data-loader.js — loads items.json and derives filter universe.

import { BRANDS_FILTER } from "./config.js";

export async function loadItems() {
  try {
    const res = await fetch('data/items.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let items = await res.json();
    if (!Array.isArray(items)) throw new Error('items.json must be an array');
    // Per-deploy brand filter: items.json é partilhado entre deploys mas cada
    // deploy só mostra as suas marcas (definidas em config.js BRANDS_FILTER).
    if (BRANDS_FILTER && BRANDS_FILTER.length > 0) {
      items = items.filter(it => BRANDS_FILTER.includes(it.brand));
    }
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
