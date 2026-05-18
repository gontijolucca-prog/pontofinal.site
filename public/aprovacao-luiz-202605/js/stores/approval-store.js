// approval-store.js — store de aprovações + anotações com backend Supabase.
//
// Esquema de chaves na tabela `approvals` (PK = namespace + item_id):
//   • `${itemId}`                                — aprovação do item (status + nota primária)
//   • `${itemId}:caption`                        — aprovação da descrição IG
//   • `${itemId}#note_${nonce}`                  — anotação geral do item
//   • `${itemId}#slide${N}#note_${nonce}`        — anotação ligada ao slide N
//
// API:
//   get(id) / set(id, status, note)
//   getCaption(id) / setCaption(id, status, note)
//   saveNote(itemId, note, opts={slideN}) → cria nova anotação
//   listNotes(itemId) → lista de anotações deste item (ordenada cronologicamente)
//   deleteNote(key)   → soft-delete (UPDATE note="") — RLS não permite DELETE
//   counts() / captionCounts() / all() / export() / import() / reset()
//
// Evento global emitido sempre que o cache muda: 'approval:changed'.

import { supabase, AUTH_ENABLED, USE_SUPABASE, initSupabase } from "../lib/supabase-client.js";
import { NAMESPACE } from "../config.js";

let cache = {};

function emit() {
  window.dispatchEvent(new CustomEvent("approval:changed", { detail: cache }));
}

function defaultState() {
  return { status: "pending", note: "", updatedAt: null };
}

const NOTE_RE = /#note_/;
const SLIDE_RE = /#slide(\d+)/;
const CAPTION_SUFFIX = ":caption";

function isAnnotationKey(key) { return NOTE_RE.test(key); }
function isCaptionKey(key)    { return key.endsWith(CAPTION_SUFFIX); }
function isBaseItemKey(key)   { return !isAnnotationKey(key) && !isCaptionKey(key); }

function parseAnnotationKey(key) {
  const m = key.match(/^(.+?)(?:#slide(\d+))?#note_(.+)$/);
  if (!m) return null;
  return { itemId: m[1], slide: m[2] ? parseInt(m[2], 10) : null, nonce: m[3] };
}

function makeNonce() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}_${r}`;
}

function buildAnnotationKey(itemId, slideN, nonce) {
  const slidePart = slideN ? `#slide${slideN}` : "";
  return `${itemId}${slidePart}#note_${nonce}`;
}

// ─── Fallback localStorage ───────────────────────────────────────────────

const LS_KEY = `${NAMESPACE}`;
const LS_MIGRATED_KEY = `${NAMESPACE}-migrated`;

function lsRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function lsWrite(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ─── Supabase load + realtime ─────────────────────────────────────────────

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
    console.warn("[approval-store] migration error:", error);
    return;
  }
  localStorage.setItem(LS_MIGRATED_KEY, "true");
}

// ─── Init ────────────────────────────────────────────────────────────────

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

// ─── Helper de upsert na tabela `approvals` ──────────────────────────────

async function upsertRow(item_id, status, note, updated_at) {
  if (!((USE_SUPABASE || AUTH_ENABLED) && supabase)) return null;
  const userId = (await supabase.auth.getUser())?.data?.user?.id || null;
  const row = { namespace: NAMESPACE, item_id, status, note, updated_at };
  if (userId) row.updated_by = userId;
  const { error } = await supabase
    .from("approvals")
    .upsert(row, { onConflict: "namespace,item_id" });
  if (error) {
    console.error("[approval-store] upsert error:", error);
    return null;
  }
  return row;
}

// ─── API pública ─────────────────────────────────────────────────────────

export const approvalStore = {
  get(id) {
    return cache[id] ? { ...cache[id] } : defaultState();
  },

  async set(id, status, note = "") {
    const updatedAt = new Date().toISOString();
    cache[id] = { status, note, updatedAt };
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(id, status, note, updatedAt);
    } else {
      lsWrite(cache);
    }
  },

  // Cria uma nova anotação. Cada chamada com texto cria uma nova entrada
  // (nonce único). opts.slideN para anotações por slide.
  async saveNote(itemId, note, opts = {}) {
    const trimmed = (note || "").trim();
    if (!trimmed) return null;
    const slideN = opts.slideN || null;
    const nonce = makeNonce();
    const key = buildAnnotationKey(itemId, slideN, nonce);
    const updatedAt = new Date().toISOString();
    cache[key] = { status: "note", note: trimmed, updatedAt };
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(key, "note", trimmed, updatedAt);
    } else {
      lsWrite(cache);
    }
    return { key, slide: slideN, note: trimmed, changed_at: updatedAt };
  },

  // Lista de anotações deste item (incluindo anotações ligadas a slides).
  // Ordem cronológica: mais recente primeiro.
  listNotes(itemId) {
    const prefix = `${itemId}#`;
    const out = [];
    for (const key in cache) {
      if (!key.startsWith(prefix)) continue;
      if (!isAnnotationKey(key)) continue;
      const note = cache[key].note;
      if (!note || !note.trim()) continue;  // soft-deleted
      const parsed = parseAnnotationKey(key);
      out.push({
        key,
        id: key,                       // back-compat com callers antigos
        slide: parsed?.slide || null,
        note,
        status: cache[key].status,
        changed_at: cache[key].updatedAt,
        changed_by_email: null,
      });
    }
    out.sort((a, b) => (b.changed_at || "").localeCompare(a.changed_at || ""));
    return out;
  },

  // Soft-delete: RLS não permite DELETE como anon. Marcamos como vazio.
  async deleteNote(key) {
    if (!key || !isAnnotationKey(key)) return false;
    const updatedAt = new Date().toISOString();
    if (cache[key]) cache[key].note = "";
    cache[key] = { status: "note", note: "", updatedAt };
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const r = await upsertRow(key, "note", "", updatedAt);
      return !!r;
    }
    lsWrite(cache);
    return true;
  },

  // Alias para retrocompatibilidade.
  async history(itemId) { return this.listNotes(itemId); },

  all() {
    return { ...cache };
  },

  counts() {
    const out = { approved: 0, rejected: 0, pending: 0 };
    for (const id in cache) {
      if (!isBaseItemKey(id)) continue;
      out[cache[id].status] = (out[cache[id].status] || 0) + 1;
    }
    return out;
  },

  captionCounts() {
    const out = { approved: 0, rejected: 0, pending: 0 };
    for (const id in cache) {
      if (!isCaptionKey(id)) continue;
      out[cache[id].status] = (out[cache[id].status] || 0) + 1;
    }
    return out;
  },

  getCaption(itemId) {
    const key = `${itemId}:caption`;
    return cache[key] ? { ...cache[key] } : defaultState();
  },

  async setCaption(itemId, status, note = "") {
    const key = `${itemId}:caption`;
    const updatedAt = new Date().toISOString();
    cache[key] = { status, note, updatedAt };
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(key, status, note, updatedAt);
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
};
