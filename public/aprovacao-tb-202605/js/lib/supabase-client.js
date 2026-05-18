// supabase-client.js — singleton Supabase client com storage adapter condicional.
//
// O SDK é importado dinamicamente para evitar request ao CDN quando ainda não
// há credenciais (AUTH_ENABLED=false → fallback localStorage, sem rede).
//
// O "remember me" não muda credenciais; muda apenas ONDE a sessão fica guardada:
//   - 'local'   → localStorage (persiste entre separadores e reboots)
//   - 'session' → sessionStorage (morre quando o separador fecha) — default
//
// A preferência vive sempre em localStorage (não é credencial) sob a chave
// 'cm-auth-storage'. Quem alterna a preferência tem de fazê-lo ANTES do
// signInWithOtp para a sessão (escrita após o magic-link) cair no sítio certo.

import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_ENABLED, USE_SUPABASE } from "../config.js";

const STORAGE_PREF_KEY = "cm-auth-storage";

export function getStoragePref() {
  return localStorage.getItem(STORAGE_PREF_KEY) === "local" ? "local" : "session";
}

export function setStoragePref(pref) {
  if (pref !== "local" && pref !== "session") return;
  localStorage.setItem(STORAGE_PREF_KEY, pref);
}

function buildStorage() {
  const backing = getStoragePref() === "local" ? localStorage : sessionStorage;
  return {
    getItem: (k) => backing.getItem(k),
    setItem: (k, v) => backing.setItem(k, v),
    removeItem: (k) => backing.removeItem(k),
  };
}

// supabase é populado por initSupabase() — sem top-level await porque o
// Safari < 15 quebra com isso e o restante código deixa de carregar.
export let supabase = null;
let _initPromise = null;

const CDN_URLS = [
  "https://esm.sh/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
];

export function initSupabase() {
  if (!USE_SUPABASE && !AUTH_ENABLED) return Promise.resolve(null);
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    let lastErr;
    for (const url of CDN_URLS) {
      try {
        const mod = await import(/* @vite-ignore */ url);
        supabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            storage: buildStorage(),
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        return supabase;
      } catch (err) {
        lastErr = err;
        console.warn(`[supabase-client] CDN ${url} falhou, a tentar próximo…`, err?.message || err);
      }
    }
    console.error("[supabase-client] todos os CDNs falharam:", lastErr);
    return null;
  })();
  return _initPromise;
}

export { AUTH_ENABLED, USE_SUPABASE };
