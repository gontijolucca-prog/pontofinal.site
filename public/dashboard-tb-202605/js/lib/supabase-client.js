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

import { SUPABASE_URL, SUPABASE_ANON_KEY, AUTH_ENABLED } from "../config.js";

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

// Lazy: só importa o SDK quando há credenciais reais. Em modo fallback (sem
// Supabase configurado), 'supabase' fica null e o resto do sistema usa
// localStorage.
export let supabase = null;

if (AUTH_ENABLED) {
  try {
    const mod = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: buildStorage(),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.error("[supabase-client] falhou a carregar SDK do CDN, fallback localStorage:", err);
    supabase = null;
  }
}

export { AUTH_ENABLED };
