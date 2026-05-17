// approval-store.js — store de aprovações com backend Supabase + realtime.
//
// API pública (idêntica à versão localStorage anterior):
//   get(id)            → { status, note, updatedAt }
//   set(id, status, n) → upsert assíncrono; cache update optimistic
//   all()              → mapa completo do cache
//   counts()           → { approved, rejected, pending }
//   export() / import(json) / reset()  → admin helpers
//
// Evento global emitido sempre que o cache muda: 'approval:changed'.
//
// Se AUTH_ENABLED for false (credenciais Supabase não configuradas), faz
// fallback automático para localStorage — útil em dev e enquanto o setup
// remoto ainda não está pronto. Schema do localStorage continua compatível.

import { supabase, AUTH_ENABLED } from "../lib/supabase-client.js";
import { NAMESPACE } from "../config.js";

// ─── Cache em memória ────────────────────────────────────────────────────
// { [item_id]: { status, note, updatedAt } }
let cache = {};

function emit() {
  window.dispatchEvent(new CustomEvent("approval:changed", { detail: cache }));
}

function defaultState() {
  return { status: "pending", note: "", updatedAt: null };
}

// ─── Fallback localStorage (quando AUTH_ENABLED=false) ───────────────────

const LS_KEY = `${NAMESPACE}`;
const LS_MIGRATED_KEY = `${NAMESPACE}-migrated`;

function lsRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function lsWrite(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ─── Modo Supabase ───────────────────────────────────────────────────────

async function loadFromSupabase() {
  const { data, error } = await supabase
    .from("approvals")
    .select("item_id, status, note, updated_at")
    .eq("namespace", NAMESPACE);
  if (error) {
    console.error("[approval-store] load error:", error);
    return;
  }
  cache = {};
  for (const row of data || []) {
    cache[row.item_id] = {
      status: row.status,
      note: row.note || "",
      updatedAt: row.updated_at,
    };
  }
  emit();
}

function subscribeRealtime() {
  return supabase
    .channel(`approvals:${NAMESPACE}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "approvals", filter: `namespace=eq.${NAMESPACE}` },
      (payload) => {
        const row = payload.new || payload.old;
        if (!row) return;
        if (payload.eventType === "DELETE") {
          delete cache[row.item_id];
        } else {
          cache[row.item_id] = {
            status: row.status,
            note: row.note || "",
            updatedAt: row.updated_at,
          };
        }
        emit();
      }
    )
    .subscribe();
}

async function migrateLocalStorageIfNeeded() {
  if (localStorage.getItem(LS_MIGRATED_KEY) === "true") return;
  const legacy = lsRead();
  const ids = Object.keys(legacy);
  if (ids.length === 0) {
    localStorage.setItem(LS_MIGRATED_KEY, "true");
    return;
  }
  const rows = ids.map(id => ({
    namespace: NAMESPACE,
    item_id: id,
    status: legacy[id].status,
    note: legacy[id].note || "",
    updated_at: legacy[id].updatedAt || new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("approvals")
    .upsert(rows, { onConflict: "namespace,item_id" });
  if (error) {
    console.warn("[approval-store] migration error (não bloqueia):", error);
    return;
  }
  localStorage.setItem(LS_MIGRATED_KEY, "true");
  console.info(`[approval-store] migrado ${rows.length} approvals do localStorage para Supabase.`);
}

// ─── Inicialização ───────────────────────────────────────────────────────
// init() é chamado por main.js DEPOIS de garantir sessão autenticada.
// Em modo localStorage, init() apenas hidrata o cache inicial.

let _initPromise = null;

export function init() {
  if (_initPromise) return _initPromise;
  if (AUTH_ENABLED && supabase) {
    _initPromise = (async () => {
      await migrateLocalStorageIfNeeded();
      await loadFromSupabase();
      subscribeRealtime();
    })();
  } else {
    cache = lsRead();
    _initPromise = Promise.resolve();
    queueMicrotask(emit);
  }
  return _initPromise;
}

// ─── Surface pública ─────────────────────────────────────────────────────

export const approvalStore = {
  get(id) {
    return cache[id] ? { ...cache[id] } : defaultState();
  },

  async set(id, status, note = "") {
    const updatedAt = new Date().toISOString();
    cache[id] = { status, note, updatedAt };
    emit();

    if (AUTH_ENABLED && supabase) {
      const { error } = await supabase
        .from("approvals")
        .upsert(
          { namespace: NAMESPACE, item_id: id, status, note, updated_at: updatedAt },
          { onConflict: "namespace,item_id" }
        );
      if (error) {
        console.error("[approval-store] set error:", error);
        // Não revertemos o cache — UX continua optimist.
      }
    } else {
      lsWrite(cache);
    }
  },

  all() {
    return { ...cache };
  },

  counts() {
    const out = { approved: 0, rejected: 0, pending: 0 };
    for (const id in cache) {
      out[cache[id].status] = (out[cache[id].status] || 0) + 1;
    }
    return out;
  },

  export() {
    return JSON.stringify(cache, null, 2);
  },

  async import(json) {
    const data = JSON.parse(json);
    if (typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid format");
    cache = data;
    emit();
    if (AUTH_ENABLED && supabase) {
      const rows = Object.keys(data).map(id => ({
        namespace: NAMESPACE,
        item_id: id,
        status: data[id].status,
        note: data[id].note || "",
        updated_at: data[id].updatedAt || new Date().toISOString(),
      }));
      const { error } = await supabase
        .from("approvals")
        .upsert(rows, { onConflict: "namespace,item_id" });
      if (error) console.error("[approval-store] import error:", error);
    } else {
      lsWrite(cache);
    }
  },

  async reset() {
    cache = {};
    emit();
    if (AUTH_ENABLED && supabase) {
      const { error } = await supabase.from("approvals").delete().eq("namespace", NAMESPACE);
      if (error) console.error("[approval-store] reset error:", error);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  },
};
