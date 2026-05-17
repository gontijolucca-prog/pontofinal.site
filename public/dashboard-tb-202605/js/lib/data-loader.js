// data-loader.js — busca themes + items + approvals do Supabase, filtrado por
// BRANDS e NAMESPACE da página. Reactivo: aceita callbacks para realtime.

import { supabase } from "./supabase-client.js";
import { BRANDS, NAMESPACE } from "../config.js";

export async function loadThemes() {
  const { data, error } = await supabase
    .from("themes")
    .select("brand, theme_key, pilar, audience, description")
    .in("brand", BRANDS)
    .order("brand")
    .order("pilar");
  if (error) throw error;
  return data || [];
}

export async function loadItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, brand, kind, theme, pilar, scheduled_for, hour, payload")
    .in("brand", BRANDS)
    .order("scheduled_for");
  if (error) throw error;
  return data || [];
}

export async function loadApprovals() {
  const { data, error } = await supabase
    .from("approvals")
    .select("item_id, status, note, updated_at")
    .eq("namespace", NAMESPACE);
  if (error) throw error;
  // mapa { item_id → { status, note, updatedAt } }
  const map = {};
  for (const r of data || []) {
    map[r.item_id] = { status: r.status, note: r.note || "", updatedAt: r.updated_at };
  }
  return map;
}

export function subscribeApprovals(onChange) {
  return supabase
    .channel(`dashboard:${NAMESPACE}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "approvals", filter: `namespace=eq.${NAMESPACE}` },
      () => onChange()
    )
    .subscribe();
}
