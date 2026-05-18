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

import { supabase, AUTH_ENABLED, USE_SUPABASE, initSupabase } from "../lib/supabase-client.js";
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
  if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
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

// Insere uma entry em approval_history. Falha em silêncio (warn) se a tabela
// não existir ou se RLS bloquear — o fluxo principal já guardou em `approvals`.
async function insertHistory({ item_id, status, note, changed_at }) {
  if (!((USE_SUPABASE || AUTH_ENABLED) && supabase)) return;
  const row = { namespace: NAMESPACE, item_id, status, note: note || "", changed_at };
  try {
    const userEmail = (await supabase.auth.getUser())?.data?.user?.email || null;
    if (userEmail) row.changed_by_email = userEmail;
  } catch { /* anon — sem email */ }
  const { error } = await supabase.from("approval_history").insert(row);
  if (error) console.warn("[approval-store] history insert error:", error.message);
}

export const approvalStore = {
  get(id) {
    return cache[id] ? { ...cache[id] } : defaultState();
  },

  async set(id, status, note = "") {
    const updatedAt = new Date().toISOString();
    cache[id] = { status, note, updatedAt };
    emit();

    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const userId = (await supabase.auth.getUser())?.data?.user?.id || null;
      const row = { namespace: NAMESPACE, item_id: id, status, note, updated_at: updatedAt };
      if (userId) row.updated_by = userId;
      const { error } = await supabase
        .from("approvals")
        .upsert(row, { onConflict: "namespace,item_id" });
      if (error) {
        console.error("[approval-store] set error:", error);
      } else {
        await insertHistory({ item_id: id, status, note, changed_at: updatedAt });
      }
    } else {
      lsWrite(cache);
    }
  },

  // Guardar SÓ a nota, sem alterar o status. Útil quando o user quer apenas
  // registar uma observação enquanto decide.
  async saveNote(id, note) {
    const current = cache[id] || defaultState();
    const updatedAt = new Date().toISOString();
    cache[id] = { status: current.status, note, updatedAt };
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const userId = (await supabase.auth.getUser())?.data?.user?.id || null;
      const row = { namespace: NAMESPACE, item_id: id, status: current.status, note, updated_at: updatedAt };
      if (userId) row.updated_by = userId;
      const { error } = await supabase
        .from("approvals")
        .upsert(row, { onConflict: "namespace,item_id" });
      if (error) {
        console.error("[approval-store] saveNote error:", error);
      } else {
        await insertHistory({ item_id: id, status: current.status, note, changed_at: updatedAt });
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
      if (id.endsWith(":caption")) continue;
      if (id.includes("#slide")) continue;
      out[cache[id].status] = (out[cache[id].status] || 0) + 1;
    }
    return out;
  },

  captionCounts() {
    const out = { approved: 0, rejected: 0, pending: 0 };
    for (const id in cache) {
      if (!id.endsWith(":caption")) continue;
      out[cache[id].status] = (out[cache[id].status] || 0) + 1;
    }
    return out;
  },

  getCaption(itemId) {
    const key = `${itemId}:caption`;
    return cache[key] ? { ...cache[key] } : defaultState();
  },

  // Anotações por slide (carrosseis). Cada slide tem o seu próprio note.
  // Key no store: `${itemId}#slide${n}` (n = 1-based).
  getSlideNote(itemId, slideN) {
    const key = `${itemId}#slide${slideN}`;
    return cache[key] ? { ...cache[key] } : defaultState();
  },

  async saveSlideNote(itemId, slideN, note) {
    const key = `${itemId}#slide${slideN}`;
    const updatedAt = new Date().toISOString();
    cache[key] = { status: "pending", note, updatedAt };
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const userId = (await supabase.auth.getUser())?.data?.user?.id || null;
      const row = { namespace: NAMESPACE, item_id: key, status: "pending", note, updated_at: updatedAt };
      if (userId) row.updated_by = userId;
      const { error } = await supabase
        .from("approvals")
        .upsert(row, { onConflict: "namespace,item_id" });
      if (error) {
        console.error("[approval-store] saveSlideNote error:", error);
      } else {
        await insertHistory({ item_id: key, status: "pending", note, changed_at: updatedAt });
      }
    } else {
      lsWrite(cache);
    }
  },

  getAllSlideNotes(itemId) {
    const prefix = `${itemId}#slide`;
    const out = {};
    for (const k in cache) {
      if (k.startsWith(prefix)) {
        const m = k.match(/#slide(\d+)$/);
        if (m) out[parseInt(m[1], 10)] = { ...cache[k] };
      }
    }
    return out;
  },

  async setCaption(itemId, status, note = "") {
    const key = `${itemId}:caption`;
    const updatedAt = new Date().toISOString();
    cache[key] = { status, note, updatedAt };
    emit();

    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const userId = (await supabase.auth.getUser())?.data?.user?.id || null;
      const row = { namespace: NAMESPACE, item_id: key, status, note, updated_at: updatedAt };
      if (userId) row.updated_by = userId;
      const { error } = await supabase
        .from("approvals")
        .upsert(row, { onConflict: "namespace,item_id" });
      if (error) {
        console.error("[approval-store] setCaption error:", error);
      } else {
        await insertHistory({ item_id: key, status, note, changed_at: updatedAt });
      }
    } else {
      lsWrite(cache);
    }
  },

  export() {
    return JSON.stringify(cache, null, 2);
  },

  async import(json) {
    const data = JSON.parse(json);
    if (typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid format");
    cache = data;
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
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
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const { error } = await supabase.from("approvals").delete().eq("namespace", NAMESPACE);
      if (error) console.error("[approval-store] reset error:", error);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  },

  // Histórico de mudanças de estado para um item. Retorna [] se Supabase não
  // estiver activo, ou se ainda não houver registos (ou se a tabela history
  // não existir, o que dá graceful empty array).
  async history(itemId) {
    if (!(USE_SUPABASE || AUTH_ENABLED) || !supabase) return [];
    const { data, error } = await supabase
      .from("approval_history")
      .select("status, note, changed_at, changed_by_email")
      .eq("namespace", NAMESPACE)
      .eq("item_id", itemId)
      .order("changed_at", { ascending: false })
      .limit(50);
    if (error) {
      console.warn("[approval-store] history not available:", error.message);
      return [];
    }
    return data || [];
  },
};
