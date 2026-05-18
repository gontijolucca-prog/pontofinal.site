// data-loader.js — loads items.json and derives filter universe.

import { BRANDS_FILTER } from "./config.js";

async function loadCaptions() {
  try {
    const res = await fetch('data/captions.json', { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return (data && typeof data === 'object') ? data : {};
  } catch {
    return {};
  }
}

export async function loadItems() {
  try {
    const res = await fetch('data/items.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let items = await res.json();
    if (!Array.isArray(items)) throw new Error('items.json must be an array');
    if (BRANDS_FILTER && BRANDS_FILTER.length > 0) {
      items = items.filter(it => BRANDS_FILTER.includes(it.brand));
    }
    const captions = await loadCaptions();
    for (const it of items) {
      const c = captions[it.id];
      if (c) {
        it.caption = c.caption || "";
        it.hashtags = c.hashtags || "";
      } else {
        it.caption = "";
        it.hashtags = "";
      }
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
