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
import { NAMESPACE, SUPABASE_URL, SUPABASE_ANON_KEY, APP_VERSION } from "../config.js";

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
const DATE_SUFFIX = ":date";
const HOUR_SUFFIX = ":hour";

function isAnnotationKey(key) { return NOTE_RE.test(key); }
function isCaptionKey(key)    { return key.endsWith(CAPTION_SUFFIX); }
function isDateKey(key)       { return key.endsWith(DATE_SUFFIX); }
function isHourKey(key)       { return key.endsWith(HOUR_SUFFIX); }
function isBaseItemKey(key)   { return !isAnnotationKey(key) && !isCaptionKey(key) && !isDateKey(key) && !isHourKey(key); }

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

// ─── Autor (assinatura) ──────────────────────────────────────────────────
// Cada utilizador identifica-se com um nome na primeira ação. O nome fica
// guardado em localStorage e é incorporado em cada escrita ao Supabase via
// note encoding JSON ({a: author, t: text}). Reads decodificam de volta;
// entradas plain (legacy) são tratadas como sem autor.

const AUTHOR_KEY = "cm-approval-author";

export function getAuthor() {
  try { return (localStorage.getItem(AUTHOR_KEY) || "").trim() || null; }
  catch { return null; }
}

export function setAuthor(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  try { localStorage.setItem(AUTHOR_KEY, trimmed); } catch {}
}

let _authorPromise = null;
export function ensureAuthor() {
  const existing = getAuthor();
  if (existing) return Promise.resolve(existing);
  if (_authorPromise) return _authorPromise;
  _authorPromise = openAuthorModal().then((name) => {
    _authorPromise = null;
    if (name) setAuthor(name);
    return name || null;
  });
  return _authorPromise;
}

function openAuthorModal() {
  return new Promise((resolve) => {
    let backdrop = document.getElementById("authorModalBackdrop");
    if (backdrop) backdrop.remove();
    backdrop = document.createElement("div");
    backdrop.id = "authorModalBackdrop";
    backdrop.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.55);display:grid;place-items:center;padding:16px;";
    backdrop.innerHTML = `
      <form style="background:#FFFFFF;color:#050505;width:min(420px,100%);border:4px solid #050505;box-shadow:10px 10px 0 0 #050505;padding:24px 22px;font-family:'JetBrains Mono',ui-monospace,monospace;">
        <h2 style="font:800 22px/1.1 'Arial Black',Impact,sans-serif;letter-spacing:-0.02em;margin:0 0 8px;">Assina</h2>
        <p style="font-size:12.5px;line-height:1.45;color:rgba(5,5,5,0.7);margin:0 0 18px;">
          Só para sabermos quem está a fazer esta alteração. Pedimos-te o nome
          uma única vez.
        </p>
        <input id="authorModalInput" type="text" autocomplete="name" placeholder="O teu nome"
          required minlength="2" maxlength="80"
          style="width:100%;padding:12px 14px;font:600 14px/1.2 'JetBrains Mono',ui-monospace,monospace;border:3px solid #050505;background:#F4F4F2;color:#050505;outline:none;" />
        <button type="submit" style="margin-top:14px;width:100%;padding:12px;background:#050505;color:#FFFFFF;font:800 12px/1 'Arial Black',Impact,sans-serif;letter-spacing:0.08em;text-transform:uppercase;border:3px solid #050505;cursor:pointer;">
          Continuar
        </button>
      </form>
    `;
    document.body.appendChild(backdrop);
    const form = backdrop.querySelector("form");
    const input = backdrop.querySelector("input");
    setTimeout(() => input.focus(), 50);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (v.length < 2) { input.focus(); return; }
      backdrop.remove();
      resolve(v);
    });
  });
}

// Encoding do campo `note` para incluir autor + flag de apagada
// (sem coluna nova no DB). Formato JSON:
//   {"a": "Nome", "t": "texto"}              — anotação activa
//   {"a": "Quem-apagou", "t": "texto", "d": true} — apagada mas com texto preservado
//   ""                                        — apagada legacy (texto perdido)
// Reads aceitam plain strings (legacy) também.
function encodeNote(text, author, opts) {
  const obj = {};
  if (author) obj.a = author;
  if (text) obj.t = text;
  if (opts && opts.deleted) obj.d = true;
  if (!obj.a && !obj.t && !obj.d) return "";
  return JSON.stringify(obj);
}
function decodeNote(raw) {
  if (!raw) return { author: null, text: "", deleted: false };
  if (typeof raw !== "string") return { author: null, text: String(raw), deleted: false };
  const s = raw.trim();
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === "object") {
        return { author: obj.a || null, text: obj.t || "", deleted: !!obj.d };
      }
    } catch {}
  }
  // Legacy plain string — sem autor.
  return { author: null, text: raw, deleted: false };
}

// ─── Fallback localStorage ───────────────────────────────────────────────

const LS_KEY = `${NAMESPACE}`;
const LS_MIGRATED_KEY = `${NAMESPACE}-migrated`;

function lsRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function lsWrite(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch (e) { console.warn("[approval-store] lsWrite failed:", e); }
}
// Snapshot do cache em localStorage. Chamado após cada mutação para que
// a próxima abertura — mesmo com Supabase a falhar/lento — mostre o
// último estado conhecido em vez de UI vazia.
function lsSnapshot() {
  lsWrite(cache);
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
    const decoded = decodeNote(row.note || "");
    cache[row.item_id] = {
      status: row.status,
      note: decoded.text,
      author: decoded.author,
      deleted: decoded.deleted,
      updatedAt: row.updated_at,
    };
  }
}

// Faz merge de um snapshot de rows do server com o cache local, preservando
// writes locais mais recentes. Chamado pelo SDK load e pelo fetch polling.
function mergeServerSnapshot(rows) {
  const next = {};
  for (const row of rows || []) {
    const decoded = decodeNote(row.note || "");
    next[row.item_id] = {
      status: row.status,
      note: decoded.text,
      author: decoded.author,
      deleted: decoded.deleted,
      updatedAt: row.updated_at,
    };
  }
  // Preserva writes locais mais recentes que o server (writes feitos antes
  // do load resolver, ou que ainda não fizeram flush para o server).
  const ls = lsRead();
  for (const id in ls) {
    const srv = next[id];
    const loc = ls[id];
    if (!loc) continue;
    if (!srv || (loc.updatedAt && (!srv.updatedAt || new Date(loc.updatedAt) > new Date(srv.updatedAt)))) {
      next[id] = loc;
    }
  }
  cache = next;
  applyQueueToCache();
  lsSnapshot();
  emit();
}

// Endpoints possíveis para a tabela approvals. O proxy same-origin é
// preferido — first-party requests passam por Brave Shields, Safari
// content blockers e extensões que bloqueiam o domínio supabase.co
// directo. Caímos para o supabase.co directo só se o proxy falhar.
const APPROVALS_ENDPOINTS = [
  `/api/approvals`,
  `${SUPABASE_URL}/rest/v1/approvals`,
];

let _lastFetchError = null;
let _lastFetchEndpoint = null;

async function fetchApprovals(query) {
  for (const base of APPROVALS_ENDPOINTS) {
    const isProxy = base.startsWith("/api/");
    try {
      const headers = { "Content-Type": "application/json" };
      // O proxy injecta as credenciais server-side. Em fallback directo
      // precisamos das enviar.
      if (!isProxy) {
        headers.apikey = SUPABASE_ANON_KEY;
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }
      const res = await fetch(`${base}?${query}`, {
        headers,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });
      if (!res.ok) {
        _lastFetchError = `HTTP ${res.status} via ${base}`;
        continue;
      }
      // O proxy pode devolver HTML (SPA fallback) com status 200 se _routes.json
      // não estiver configurado. Detectamos pelo content-type.
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) {
        _lastFetchError = `Resposta não-JSON (${ct.slice(0,40)}) via ${base}`;
        continue;
      }
      _lastFetchEndpoint = base;
      _lastFetchError = null;
      return await res.json();
    } catch (e) {
      _lastFetchError = `${base}: ${e?.message || e}`;
      console.warn(`[approval-store] fetch via ${base} falhou:`, e?.message || e);
    }
  }
  return null;
}

async function upsertApprovals(row) {
  for (const base of APPROVALS_ENDPOINTS) {
    const isProxy = base.startsWith("/api/");
    try {
      const headers = {
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      };
      if (!isProxy) {
        headers.apikey = SUPABASE_ANON_KEY;
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }
      const res = await fetch(`${base}?on_conflict=namespace,item_id`, {
        method: "POST",
        headers,
        body: JSON.stringify(row),
        mode: "cors",
        credentials: "omit",
        keepalive: true,
      });
      if (res.ok) return true;
      _lastSyncError = `HTTP ${res.status} via ${base}`;
    } catch (e) {
      _lastSyncError = `${base}: ${e?.message || e}`;
    }
  }
  return false;
}

// Carrega do Supabase via REST (proxy same-origin com fallback directo).
// Funciona mesmo quando o domínio supabase.co é bloqueado pelo browser.
async function loadFromSupabaseFetch() {
  const data = await fetchApprovals(`namespace=eq.${encodeURIComponent(NAMESPACE)}&select=item_id,status,note,updated_at`);
  if (data === null) {
    updateSyncIndicator("offline");
    return false;
  }
  mergeServerSnapshot(data);
  updateSyncIndicator("ok");
  return true;
}

async function loadFromSupabase() {
  if (!supabase) return loadFromSupabaseFetch();
  const { data, error } = await supabase
    .from("approvals")
    .select("item_id, status, note, updated_at")
    .eq("namespace", NAMESPACE);
  if (error) {
    console.error("[approval-store] SDK load error, a tentar REST fallback:", error);
    return loadFromSupabaseFetch();
  }
  mergeServerSnapshot(data);
  updateSyncIndicator("ok");
}

// ─── Detecção de versão antiga ────────────────────────────────────────────
// Periodicamente fetcha /version.txt. Se a versão do servidor não bater com
// a APP_VERSION compilada no JS deste cliente, é sinal que houve deploy.
// O badge muda para "🔄 Versão antiga — recarrega" para o user saber.
let _versionMismatch = false;
async function checkAppVersion() {
  try {
    const res = await fetch("version.txt", { cache: "no-store" });
    if (!res.ok) return;
    const serverVersion = (await res.text()).trim();
    if (serverVersion && serverVersion !== APP_VERSION) {
      _versionMismatch = true;
      updateSyncIndicator("ok"); // re-render badge com novo estado
    }
  } catch { /* sem rede — irrelevante para a verificação */ }
}

// Polling: pull do server a cada 7s para garantir convergência em browsers
// onde realtime WebSocket está bloqueado. Visualmente é o que faz "ao vivo"
// para o utilizador — convergência típica ~7s entre devices.
let _pollTimer = null;
function startServerPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return; // poupar quando hidden
    loadFromSupabaseFetch();
  }, 5000);
  // Verificação de versão a cada 30s — menos frequente que sync de dados.
  checkAppVersion();
  setInterval(() => { if (!document.hidden) checkAppVersion(); }, 30000);
  // Pull imediato quando o user volta ao tab.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { loadFromSupabaseFetch(); checkAppVersion(); }
  });
}

// Indicador visual de sync no canto superior direito. Estados:
//   "ok"      → "✓ sincronizado · HH:MM:SS"
//   "offline" → "⚠ Offline — escritas guardadas localmente"
let _syncIndicatorEl = null;
function updateSyncIndicator(state) {
  if (typeof document === "undefined") return;
  if (!_syncIndicatorEl) {
    _syncIndicatorEl = document.createElement("div");
    _syncIndicatorEl.id = "live-sync-indicator";
    _syncIndicatorEl.style.cssText = "position:fixed;top:8px;right:8px;z-index:9998;font:600 10px/1 'JetBrains Mono',ui-monospace,monospace;padding:6px 10px;border:2px solid #050505;letter-spacing:0.05em;text-transform:uppercase;pointer-events:none;";
    document.body.appendChild(_syncIndicatorEl);
  }
  const now = new Date();
  const t = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  // Estado tem 3 níveis de prioridade visual:
  //   1. Versão antiga (vermelho)   → tem de recarregar para ter os fixes
  //   2. Offline (amarelo)          → sync falhou, mostra erro literal
  //   3. OK (verde)                 → tudo sincronizado, mostra hora + endpoint
  if (_versionMismatch) {
    _syncIndicatorEl.textContent = "🔄 versão antiga — fecha e abre nova aba";
    _syncIndicatorEl.style.background = "#F8D7DA";
    _syncIndicatorEl.style.color = "#721C24";
    _syncIndicatorEl.style.cursor = "pointer";
    _syncIndicatorEl.style.pointerEvents = "auto";
    _syncIndicatorEl.title = `Versão local: ${APP_VERSION} — Servidor tem versão mais recente. Fecha esta aba e abre nova para apanhar.`;
    _syncIndicatorEl.onclick = () => {
      // Helper: redirect com timestamp limpa para forçar fetch fresco do HTML
      // e de todos os subresources sem o user ter de fechar manualmente.
      try { sessionStorage.removeItem("pf-session-bust"); } catch {}
      window.location.replace(window.location.pathname + "?_=" + Date.now());
    };
  } else if (state === "ok") {
    const via = _lastFetchEndpoint ? (_lastFetchEndpoint.startsWith("/api/") ? "(proxy)" : "(direct)") : "";
    _syncIndicatorEl.textContent = `✓ ao vivo ${via} · ${t}`;
    _syncIndicatorEl.style.background = "#E8F5E9";
    _syncIndicatorEl.style.color = "#1B5E20";
    _syncIndicatorEl.style.cursor = "default";
    _syncIndicatorEl.style.pointerEvents = "none";
    _syncIndicatorEl.title = `Tudo sincronizado. Versão ${APP_VERSION}.`;
    _syncIndicatorEl.onclick = null;
  } else {
    _syncIndicatorEl.textContent = `⚠ Offline · ${(_lastFetchError || "?").slice(0,80)}`;
    _syncIndicatorEl.style.background = "#FFF3CD";
    _syncIndicatorEl.style.color = "#856404";
    _syncIndicatorEl.style.cursor = "default";
    _syncIndicatorEl.style.pointerEvents = "none";
    _syncIndicatorEl.title = _lastFetchError || "Sem ligação";
    _syncIndicatorEl.onclick = null;
  }
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
        const decoded = decodeNote(row.note || "");
        const entry = {
          status: row.status,
          note: decoded.text,
          author: decoded.author,
          deleted: decoded.deleted,
          updatedAt: row.updated_at,
        };
        cache[row.item_id] = entry;
        lsSnapshot();
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
  // Hidrata cache do LS PRIMEIRO (síncrono). Garante render imediato com
  // o último estado conhecido mesmo que o Supabase demore ou seja bloqueado
  // por ETP/extensão/timeout. O loadFromSupabase corre por cima e faz merge.
  try { cache = lsRead() || {}; } catch { cache = {}; }
  applyQueueToCache();
  queueMicrotask(emit);

  _initPromise = (async () => {
    // Caminho FIABLE: REST directo, sem dependência do CDN do SDK.
    // Carrega sempre por aqui — funciona em Safari/Brave/Chrome igualmente.
    await loadFromSupabaseFetch();
    // Inicia polling de 7s para sync ao vivo entre browsers e devices,
    // independente de WebSockets (Safari ETP/extensões podem bloquear).
    startServerPolling();
    // Em paralelo, tenta upgrade para SDK + realtime WebSocket (mais
    // rápido que polling quando funciona). Se o CDN estiver bloqueado,
    // o polling continua a garantir convergência.
    if (USE_SUPABASE || AUTH_ENABLED) {
      try {
        await migrateLocalStorageIfNeeded();
        if (supabase) subscribeRealtime();
      } catch (e) {
        console.warn("[approval-store] realtime upgrade falhou:", e?.message || e);
      }
    }
    // Mostra indicador de writes pendentes da sessão anterior e tenta sync.
    const pendingCount = qRead().length;
    updatePendingIndicator(pendingCount);
    if (pendingCount > 0) flushQueue();
  })();
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

// Direct fetch fallback — usa o proxy same-origin primeiro, supabase.co
// directo como segundo. Resolve writes que o SDK não consegue entregar
// por causa de extensões/shields que bloqueiam o domínio externo.
async function fetchUpsert(row) {
  const ok = await upsertApprovals(row);
  if (ok) _lastSyncError = null;
  return ok;
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
    const author = await ensureAuthor();
    const updatedAt = new Date().toISOString();
    const entry = { status, note, author, updatedAt };
    cache[id] = entry;
    lsSnapshot();
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(id, status, encodeNote(note, author), updatedAt);
    }
  },

  // Cria uma nova anotação. Cada chamada com texto cria uma nova entrada
  // (nonce único). opts.slideN para anotações por slide.
  async saveNote(itemId, note, opts = {}) {
    const trimmed = (note || "").trim();
    if (!trimmed) return null;
    const author = await ensureAuthor();
    const slideN = opts.slideN || null;
    const nonce = makeNonce();
    const key = buildAnnotationKey(itemId, slideN, nonce);
    const updatedAt = new Date().toISOString();
    const entry = { status: "pending", note: trimmed, author, updatedAt };
    cache[key] = entry;
    lsSnapshot();
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(key, "pending", encodeNote(trimmed, author), updatedAt);
    }
    return { key, slide: slideN, note: trimmed, author, changed_at: updatedAt };
  },

  // Lista de anotações deste item (incluindo anotações ligadas a slides).
  // Ordem cronológica: mais recente primeiro.
  // Devolve TODAS as anotações deste item, incluindo as apagadas.
  // Cada entry inclui flag `deleted` baseada no JSON do note ({d: true})
  // OU em note vazio (legacy soft-delete que zerava o texto). A UI usa
  // esta flag para mostrar tag "apagada" e estilo atenuado.
  listNotes(itemId) {
    const prefix = `${itemId}#`;
    const out = [];
    for (const key in cache) {
      if (!key.startsWith(prefix)) continue;
      if (!isAnnotationKey(key)) continue;
      const entry = cache[key];
      const note = entry.note || "";
      // Apagada se flag explícita OU se texto vazio (legacy).
      const isDeleted = !!entry.deleted || !note.trim();
      const parsed = parseAnnotationKey(key);
      out.push({
        key,
        id: key,                       // back-compat com callers antigos
        slide: parsed?.slide || null,
        note,
        deleted: isDeleted,
        author: entry.author || null,
        status: entry.status,
        changed_at: entry.updatedAt,
        changed_by_email: entry.author || null,
      });
    }
    out.sort((a, b) => (b.changed_at || "").localeCompare(a.changed_at || ""));
    return out;
  },

  // Soft-delete COM preservação de texto. RLS não permite DELETE como anon,
  // pelo que actualizamos a row com flag {d: true} no JSON encoded. O texto
  // original fica preservado para o user poder auditar/recuperar mais tarde.
  // (Substitui o comportamento antigo que zerava o texto.)
  async deleteNote(key) {
    if (!key || !isAnnotationKey(key)) return false;
    const author = await ensureAuthor();
    const updatedAt = new Date().toISOString();
    // Preserva o texto original — se existir.
    const existingText = (cache[key]?.note || "").trim();
    const entry = { status: "pending", note: existingText, author, deleted: true, updatedAt };
    cache[key] = entry;
    lsSnapshot();
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const r = await upsertRow(
        key,
        "pending",
        encodeNote(existingText, author, { deleted: true }),
        updatedAt
      );
      return !!r;
    }
    return true;
  },

  // Reactivar uma anotação previamente apagada — remove a flag d e mantém
  // o texto. Útil quando o user apagou por engano.
  async restoreNote(key) {
    if (!key || !isAnnotationKey(key)) return false;
    const author = await ensureAuthor();
    const updatedAt = new Date().toISOString();
    const existingText = (cache[key]?.note || "").trim();
    if (!existingText) return false; // sem texto preservado, não há nada a restaurar
    const entry = { status: "pending", note: existingText, author, deleted: false, updatedAt };
    cache[key] = entry;
    lsSnapshot();
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const r = await upsertRow(
        key,
        "pending",
        encodeNote(existingText, author, { deleted: false }),
        updatedAt
      );
      return !!r;
    }
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
    const author = await ensureAuthor();
    const key = `${itemId}:caption`;
    const updatedAt = new Date().toISOString();
    const entry = { status, note, author, updatedAt };
    cache[key] = entry;
    lsSnapshot();
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(key, status, encodeNote(note, author), updatedAt);
    }
  },

  // Reagendamento manual de um item. dateStr em YYYY-MM-DD (ou "" para limpar).
  // Guardado em `${itemId}:date` com status=pending, data no campo note.
  async setDate(itemId, dateStr) {
    const author = await ensureAuthor();
    const key = `${itemId}${DATE_SUFFIX}`;
    const updatedAt = new Date().toISOString();
    const value = (dateStr || "").trim();
    const entry = { status: "pending", note: value, author, updatedAt };
    cache[key] = entry;
    lsSnapshot();
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(key, "pending", encodeNote(value, author), updatedAt);
    }
  },

  getDate(itemId) {
    const key = `${itemId}${DATE_SUFFIX}`;
    if (!cache[key] || !cache[key].note) return null;
    return { date: cache[key].note, author: cache[key].author || null };
  },

  getAllDateOverrides() {
    const out = {};
    for (const k in cache) {
      if (!isDateKey(k)) continue;
      if (!cache[k] || !cache[k].note) continue;
      const itemId = k.slice(0, -DATE_SUFFIX.length);
      out[itemId] = { date: cache[k].note, author: cache[k].author || null };
    }
    return out;
  },

  // Reagendamento da hora. hourStr em HH:MM (ou "" para limpar).
  async setHour(itemId, hourStr) {
    const author = await ensureAuthor();
    const key = `${itemId}${HOUR_SUFFIX}`;
    const updatedAt = new Date().toISOString();
    const value = (hourStr || "").trim();
    const entry = { status: "pending", note: value, author, updatedAt };
    cache[key] = entry;
    lsSnapshot();
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      await upsertRow(key, "pending", encodeNote(value, author), updatedAt);
    }
  },

  getHour(itemId) {
    const key = `${itemId}${HOUR_SUFFIX}`;
    if (!cache[key] || !cache[key].note) return null;
    return { hour: cache[key].note, author: cache[key].author || null };
  },

  getAllHourOverrides() {
    const out = {};
    for (const k in cache) {
      if (!isHourKey(k)) continue;
      if (!cache[k] || !cache[k].note) continue;
      const itemId = k.slice(0, -HOUR_SUFFIX.length);
      out[itemId] = { hour: cache[k].note, author: cache[k].author || null };
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
    lsSnapshot();
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
    }
  },

  async reset() {
    cache = {};
    lsSnapshot();
    emit();
    if ((USE_SUPABASE || AUTH_ENABLED) && supabase) {
      const { error } = await supabase.from("approvals").delete().eq("namespace", NAMESPACE);
      if (error) console.error("[approval-store] reset error:", error);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  },
};
