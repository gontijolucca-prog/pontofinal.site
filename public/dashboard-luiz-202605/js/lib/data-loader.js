// data-loader.js — items e themes vêm do mesmo items.json que a página de
// aprovação consome (fonte única). Approvals continuam no Supabase (RLS +
// realtime). Mantemos a assinatura subscribeApprovals para o dashboard reagir
// a aprovações novas em tempo real.

import { supabase } from "./supabase-client.js";
import { BRANDS, NAMESPACE, ITEMS_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

// Endpoints para approvals — proxy same-origin preferido (resolve Brave
// Shields / Safari content-blockers que bloqueiam supabase.co). Fallback
// para Supabase REST directo se o proxy não responder.
const APPROVALS_ENDPOINTS = [
  "/api/approvals",
  `${SUPABASE_URL}/rest/v1/approvals`,
];

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

// Decode JSON-encoded notes ({"a":"Nome","t":"texto"}) — formato usado pela
// página de aprovação para guardar autor sem coluna nova. Entradas plain
// (legacy) ficam sem autor.
function decodeNote(raw) {
  if (!raw) return { author: null, text: "" };
  if (typeof raw !== "string") return { author: null, text: String(raw) };
  const s = raw.trim();
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === "object") return { author: obj.a || null, text: obj.t || "" };
    } catch {}
  }
  return { author: null, text: raw };
}

export async function loadApprovals() {
  // Tenta proxy same-origin primeiro, depois Supabase directo. Garante
  // funcionamento em browsers com Brave Shields / Safari ITP que bloqueiam
  // fetches para subdomínios randomized de supabase.co.
  const query = `namespace=eq.${encodeURIComponent(NAMESPACE)}&select=item_id,status,note,updated_at`;
  for (const base of APPROVALS_ENDPOINTS) {
    const isProxy = base.startsWith("/api/");
    try {
      const headers = { "Content-Type": "application/json" };
      if (!isProxy) {
        headers.apikey = SUPABASE_ANON_KEY;
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }
      const res = await fetch(`${base}?${query}`, {
        headers,
        cache: "no-store",
        mode: "cors",
        credentials: "omit",
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) continue; // proxy a devolver HTML (SPA fallback)
      const data = await res.json();
      const map = {};
      for (const r of data || []) {
        const decoded = decodeNote(r.note);
        map[r.item_id] = {
          status: r.status,
          note: decoded.text,
          author: decoded.author,
          updatedAt: r.updated_at,
        };
      }
      return map;
    } catch (e) {
      console.warn(`[data-loader] approvals via ${base} falhou:`, e?.message || e);
    }
  }
  return {};
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
