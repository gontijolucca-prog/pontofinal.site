// data-loader.js — items e themes vêm do mesmo items.json que a página de
// aprovação consome (fonte única). Approvals continuam no Supabase (RLS +
// realtime). Mantemos a assinatura subscribeApprovals para o dashboard reagir
// a aprovações novas em tempo real.

import { supabase } from "./supabase-client.js";
import { BRANDS, NAMESPACE, ITEMS_URL } from "../config.js";

// items.json usa "format" (carrossel/story/reel); o resto do dashboard usa "kind"
// (carousel/story/reel). Normalizamos no loader.
const KIND_MAP = { carrossel: "carousel", carousel: "carousel", story: "story", reel: "reel" };

function normalizeItem(raw) {
  return {
    id: raw.id,
    brand: raw.brand,
    kind: KIND_MAP[raw.format] || raw.format || raw.kind || "carousel",
    theme: raw.theme,
    pilar: raw.pilar,
    audience: raw.audience || "b2c",
    title: raw.title,
    month: raw.month || (raw.scheduled_for || "").slice(0, 7) || null,
    scheduled_for: raw.scheduled_for || null,
    hour: raw.hour || null,
    payload: raw,
  };
}

export async function loadItems() {
  const res = await fetch(ITEMS_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`items.json: HTTP ${res.status}`);
  const raw = await res.json();
  return raw
    .filter(it => BRANDS.includes(it.brand))
    .map(normalizeItem);
}

// Deriva o catálogo de temas a partir dos próprios items:
//   chave = brand + theme_key + audience  →  pilar + descrição (1ª title)
export async function loadThemes() {
  const items = await loadItems();
  const map = new Map();
  for (const it of items) {
    const key = `${it.brand}::${it.theme}::${it.audience}`;
    if (map.has(key)) continue;
    map.set(key, {
      brand: it.brand,
      theme_key: it.theme,
      pilar: it.pilar,
      audience: it.audience,
      description: it.title || "",
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    return (a.pilar || "").localeCompare(b.pilar || "");
  });
}

export async function loadApprovals() {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("approvals")
    .select("item_id, status, note, updated_at")
    .eq("namespace", NAMESPACE);
  if (error) {
    console.warn("[data-loader] approvals:", error.message);
    return {};
  }
  const map = {};
  for (const r of data || []) {
    map[r.item_id] = { status: r.status, note: r.note || "", updatedAt: r.updated_at };
  }
  return map;
}

export function subscribeApprovals(onChange) {
  if (!supabase) return null;
  return supabase
    .channel(`dashboard:${NAMESPACE}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "approvals", filter: `namespace=eq.${NAMESPACE}` },
      () => onChange()
    )
    .subscribe();
}
