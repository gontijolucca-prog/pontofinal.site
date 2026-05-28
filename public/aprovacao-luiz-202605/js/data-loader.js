// data-loader.js — carrega items.json + captions.json, deriva universo de
// filtros, e faz polling silencioso para apanhar mudanças do servidor
// enquanto a página está aberta (sem precisar de F5).
//
// Fluxo:
//   • loadItems()                — fetch inicial; popula snapshot em memória.
//   • startContentPolling()      — setInterval que re-fetcha a cada N segundos,
//                                  diffa por id e dispara CustomEvent
//                                  'content:changed' no `window` quando há
//                                  diferenças. Skip se tab oculto ou se o
//                                  utilizador está a editar texto.
//   • currentContentSig()        — assinatura curta do snapshot actual; usada
//                                  pelos componentes como cache-bust dos
//                                  iframes/PNGs (`?v=APP_VERSION&c=<sig>`)
//                                  para forçar reload quando o conteúdo muda
//                                  sem ter havido bump de APP_VERSION.

import { BRANDS_FILTER } from "./config.js";

const POLL_MS = 15000;
const ITEMS_URL = "data/items.json";
const CAPTIONS_URL = "data/captions.json";

let _itemsSnapshot = null;    // Map(id -> JSON.stringify(item))
let _captionsSnapshot = null; // Map(id -> JSON.stringify(captionEntry))
let _contentSig = "init";
let _pollHandle = null;

export function currentContentSig() {
  return _contentSig;
}

// Hash compacto e determinístico (curto para caber em cache-bust de URL).
// Não é segurança — é só para invalidar caches do browser quando o conteúdo
// muda. djb2 truncado a base36 chega; rápido e sem dependências.
function shortSig(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function computeSig(items, captions) {
  // Serializar de forma estável: ordenar items por id antes do stringify.
  const idsSorted = items.map((it) => it.id).sort();
  const itemsStr = idsSorted.map((id) => _itemsSnapshot?.get(id) || "").join("|");
  const capsStr = Object.keys(captions).sort().map((k) => JSON.stringify(captions[k])).join("|");
  return shortSig(itemsStr + "##" + capsStr);
}

async function fetchRaw() {
  const ts = Date.now();
  const [itemsRes, capsRes] = await Promise.all([
    fetch(`${ITEMS_URL}?_=${ts}`, { cache: "no-store" }),
    fetch(`${CAPTIONS_URL}?_=${ts}`, { cache: "no-store" }),
  ]);
  let items = [];
  let captions = {};
  if (itemsRes.ok) {
    const raw = await itemsRes.json();
    if (Array.isArray(raw)) {
      items = (BRANDS_FILTER && BRANDS_FILTER.length > 0)
        ? raw.filter((it) => BRANDS_FILTER.includes(it.brand))
        : raw;
    }
  }
  if (capsRes.ok) {
    const raw = await capsRes.json();
    if (raw && typeof raw === "object") captions = raw;
  }
  return { items, captions };
}

function mergeCaptions(items, captions) {
  for (const it of items) {
    const c = captions[it.id];
    if (c && typeof c === "object") {
      it.caption = c.caption || "";
      it.hashtags = c.hashtags || "";
    } else if (typeof c === "string") {
      // formato antigo: caption directa como string
      it.caption = c;
      it.hashtags = "";
    } else {
      it.caption = "";
      it.hashtags = "";
    }
  }
  return items;
}

function snapshotItems(items) {
  const m = new Map();
  for (const it of items) m.set(it.id, JSON.stringify(it));
  return m;
}

function snapshotCaptions(captions) {
  const m = new Map();
  for (const k of Object.keys(captions)) m.set(k, JSON.stringify(captions[k]));
  return m;
}

export async function loadItems() {
  try {
    const { items, captions } = await fetchRaw();
    mergeCaptions(items, captions);
    _itemsSnapshot = snapshotItems(items);
    _captionsSnapshot = snapshotCaptions(captions);
    _contentSig = computeSig(items, captions);
    return items;
  } catch (err) {
    console.warn("[data-loader] items.json not found or invalid:", err.message);
    return [];
  }
}

async function pollOnce() {
  if (document.hidden) return null;
  try {
    const { items, captions } = await fetchRaw();
    mergeCaptions(items, captions);
    const newSnap = snapshotItems(items);

    // Detectar IDs alterados (item OU caption mudou) — anexar deletions também.
    const changedIds = [];
    for (const it of items) {
      const oldItem = _itemsSnapshot?.get(it.id);
      const newItem = newSnap.get(it.id);
      const oldCap = _captionsSnapshot?.get(it.id);
      const newCap = JSON.stringify(captions[it.id] ?? "");
      if (oldItem !== newItem || oldCap !== newCap) changedIds.push(it.id);
    }
    if (_itemsSnapshot) {
      for (const oldId of _itemsSnapshot.keys()) {
        if (!newSnap.has(oldId)) changedIds.push(oldId);
      }
    }

    if (changedIds.length === 0) return null;

    _itemsSnapshot = newSnap;
    _captionsSnapshot = snapshotCaptions(captions);
    _contentSig = computeSig(items, captions);

    const detail = { changedIds, contentSig: _contentSig, items, captions };
    window.dispatchEvent(new CustomEvent("content:changed", { detail }));
    return detail;
  } catch (err) {
    // Falha pontual de rede — silenciosa. Volta a tentar no próximo tick.
    return null;
  }
}

export function startContentPolling(intervalMs = POLL_MS) {
  if (_pollHandle) return;
  _pollHandle = setInterval(pollOnce, intervalMs);
  // Apanhar mudanças imediatamente quando o user voltar à tab.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) pollOnce();
  });
  // Também quando recuperar de offline.
  window.addEventListener("online", () => { pollOnce(); });
}

export function stopContentPolling() {
  if (_pollHandle) { clearInterval(_pollHandle); _pollHandle = null; }
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
    if (filters.brand && filters.brand !== "all" && it.brand !== filters.brand) return false;
    if (filters.format && filters.format !== "all" && it.format !== filters.format) return false;
    if (filters.month && filters.month !== "all" && it.month !== filters.month) return false;
    if (filters.status && filters.status !== "all" && it._status !== filters.status) return false;
    return true;
  });
}
