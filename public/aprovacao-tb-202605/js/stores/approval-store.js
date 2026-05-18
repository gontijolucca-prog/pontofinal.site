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
import { NAMESPACE, SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

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

// Espelha o cache em localStorage. Funciona como write-through:
// cada set() / saveNote() chama isto além do upsert ao Supabase.
// No load, lsRead() é usado como ground truth para entradas mais
// recentes que o server (ex.: Safari ETP atrasou o write).
function lsMergeWrite(id, entry) {
  try {
    const ls = lsRead();
    const existing = ls[id];
    if (existing && existing.updatedAt && entry.updatedAt &&
        new Date(existing.updatedAt) > new Date(entry.updatedAt)) {
      return; // existing local é mais recente, manter
    }
    ls[id] = entry;
    lsWrite(ls);
  } catch (e) {
    console.warn("[approval-store] lsMergeWrite failed:", e);
  }
}

// Aplica entries da queue (writes ainda não confirmados pelo Supabase) ao
// cache. Garante optimistic UI enquanto o flushQueue trata do retry.
function applyQueueToCache() {
  const q = qRead();
  for (const row of q) {
    cache[row.item_id] = {
      status: row.status,
      note: row.note || "",
      updatedAt: row.updated_at,
    };
  }
}

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
  // Aplica writes ainda pendentes na queue (caso o flush ainda não tenha
  // entregue ao server) por cima do snapshot do server.
  applyQueueToCache();
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
        if (!row || !row.item_id) return;
        if (payload.eventType === "DELETE") {
          delete cache[row.item_id];
          emit();
          return;
        }
        // Defesa: ignorar payloads incompletos (algum brokerage de Realtime
        // pode entregar a row sem status — não queremos zerar o cache).
        if (!row.status) {
          console.warn("[realtime] payload sem status, a ignorar:", row);
          return;
        }
        // Defesa contra updates fora de ordem: se o cache tem uma versão
        // mais recente, ignoramos o payload do server.
        const existing = cache[row.item_id];
        if (existing && existing.updatedAt && row.updated_at &&
            new Date(existing.updatedAt) > new Date(row.updated_at)) {
          console.debug("[realtime] skipping older payload for", row.item_id);
          return;
        }
        const entry = {
          status: row.status,
          note: row.note || "",
          updatedAt: row.updated_at,
        };
        cache[row.item_id] = entry;
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
    // CHECK constraint só permite approved/rejected/pending.
    // Anotações (legacy com status="note") são re-mapeadas para pending.
    status: legacy[id].status === "note" ? "pending" : legacy[id].status,
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
      // Mostra indicador se há writes pendentes da sessão anterior, e
      // tenta sincronizar.
      const pendingCount = qRead().length;
      updatePendingIndicator(pendingCount);
      if (pendingCount > 0) flushQueue();
    })();
  } else {
    cache = lsRead();
    _initPromise = Promise.resolve();
    queueMicrotask(emit);
  }
  return _initPromise;
}

// ─── Write queue + retry ─────────────────────────────────────────────────
// Sintoma: aprovações feitas no telemóvel não aparecem no desktop. Causa
// provável: Safari ETP/iCloud Private Relay/extensão bloqueia o request
// para supabase.co silenciosamente. Para sobreviver, cada write entra
// numa fila persistente em localStorage e é re-tentado periodicamente.

const QUEUE_KEY = `${NAMESPACE}-pending-writes`;

function qRead() {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
    // Migração defensiva: a tabela `approvals` tem CHECK status IN
    // ('approved','rejected','pending'). Rows antigas da fila com
    // status='note' têm de ser convertidas senão ficam presas para
    // sempre a dar HTTP 400.
    return raw.map(r => (r.status === "note" ? { ...r, status: "pending" } : r));
  } catch { return []; }
}
function qWrite(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
}
function qPush(row) {
  const q = qRead();
  // Dedupe por item_id — fica só o mais recente.
  const filtered = q.filter(r => r.item_id !== row.item_id);
  filtered.push(row);
  qWrite(filtered);
  updatePendingIndicator(filtered.length);
}
function qRemove(item_id, updated_at) {
  const q = qRead();
  const filtered = q.filter(r =>
    !(r.item_id === item_id && r.updated_at === updated_at)
  );
  qWrite(filtered);
  updatePendingIndicator(filtered.length);
}

let _lastSyncError = null;

function updatePendingIndicator(count) {
  if (typeof window === "undefined") return;
  let el = document.getElementById("sync-indicator");
  if (!el && count > 0) {
    el = document.createElement("button");
    el.id = "sync-indicator";
    el.type = "button";
    el.title = "Tocar para forçar sincronização";
    el.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:9999;background:#FFB81F;color:#050505;font:800 11px/1 'JetBrains Mono',monospace;padding:10px 14px;border:2px solid #050505;box-shadow:3px 3px 0 0 #050505;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;gap:8px;";
    el.addEventListener("click", async () => {
      el.textContent = "A sincronizar…";
      el.disabled = true;
      await flushQueue(true);
      el.disabled = false;
      const remaining = qRead().length;
      if (remaining === 0) {
        el.style.background = "#2BB05F";
        el.style.color = "#FFFFFF";
        el.textContent = "✓ Sincronizado";
        setTimeout(() => updatePendingIndicator(0), 1500);
      } else {
        updatePendingIndicator(remaining);
        if (_lastSyncError) {
          alert(`Não foi possível sincronizar ${remaining}. Erro: ${_lastSyncError}`);
        }
      }
    });
    document.body.appendChild(el);
  }
  if (el) {
    if (count > 0) {
      el.textContent = `↻ ${count} por sincronizar`;
      el.style.background = "#FFB81F";
      el.style.color = "#050505";
      el.style.display = "flex";
    } else {
      el.style.display = "none";
    }
  }
}

// Direct fetch fallback — used when the supabase-js SDK request is
// silently dropped (Safari ETP, iCloud Private Relay, ad-blockers can do
// this without surfacing an error to the SDK).
async function fetchUpsert(row) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/approvals?on_conflict=namespace,item_id`,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify(row),
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }
    );
    if (!res.ok) {
      _lastSyncError = `HTTP ${res.status} ${(await res.text()).slice(0, 80)}`;
      return false;
    }
    _lastSyncError = null;
    return true;
  } catch (e) {
    _lastSyncError = e?.message || String(e);
    return false;
  }
}

async function tryUpsertRaw(row) {
  // 1ª tentativa: SDK supabase-js (com auth context)
  if (supabase) {
    try {
      const { error } = await supabase
        .from("approvals")
        .upsert(row, { onConflict: "namespace,item_id" });
      if (!error) { _lastSyncError = null; return true; }
      _lastSyncError = `SDK: ${error.message}`;
    } catch (e) {
      _lastSyncError = `SDK throw: ${e?.message || e}`;
    }
  }
  // 2ª tentativa: fetch directo à REST API com keepalive
  return await fetchUpsert(row);
}

let _flushing = false;
async function flushQueue(force = false) {
  if (_flushing) return;
  _flushing = true;
  try {
    const q = qRead();
    for (const row of q) {
      const ok = await tryUpsertRaw(row);
      if (ok) {
        qRemove(row.item_id, row.updated_at);
        console.debug("[approval-store] queue flush ✓", row.item_id, row.status);
      } else {
        console.warn("[approval-store] queue flush retry later:", row.item_id, "—", _lastSyncError);
        if (!force) break; // se um falha, parar (rede provavelmente em baixo)
      }
    }
  } finally {
    _flushing = false;
  }
}

// Periodically retry pending writes (every 5s) + on visibility change.
if (typeof window !== "undefined") {
  setInterval(() => { flushQueue(); }, 5000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) flushQueue();
  });
  window.addEventListener("online", flushQueue);
}

// ─── Helper de upsert na tabela `approvals` ──────────────────────────────

async function upsertRow(item_id, status, note, updated_at) {
  const userId = supabase ? (await supabase.auth.getUser())?.data?.user?.id || null : null;
  const row = { namespace: NAMESPACE, item_id, status, note, updated_at };
  if (userId) row.updated_by = userId;
  console.debug("[approval-store] upsert →", { item_id, status });
  // Coloca já na fila (write-ahead) — se falhar, o retry encarrega-se.
  qPush(row);
  if (!((USE_SUPABASE || AUTH_ENABLED) && supabase)) {
    console.warn("[approval-store] upsert deferred — supabase not ready, queued");
    return row;
  }
  const ok = await tryUpsertRaw(row);
  if (ok) {
    qRemove(item_id, updated_at);
    console.debug("[approval-store] upsert ✓", item_id);
  } else {
    console.warn("[approval-store] upsert falhou, ficou na fila para retry:", item_id);
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
    const entry = { status, note, updatedAt };
    cache[id] = entry;
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(id, status, note, updatedAt);
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
    const entry = { status: "pending", note: trimmed, updatedAt };
    cache[key] = entry;
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(key, "pending", trimmed, updatedAt);
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
    cache[key] = { status: "pending", note: "", updatedAt };
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const r = await upsertRow(key, "pending", "", updatedAt);
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
    const entry = { status, note, updatedAt };
    cache[key] = entry;
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(key, status, note, updatedAt);
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
