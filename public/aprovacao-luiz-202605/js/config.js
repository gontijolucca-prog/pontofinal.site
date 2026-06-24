// config.js — per-deployment configuration.
//
// Substitui SUPABASE_URL e SUPABASE_ANON_KEY pelos valores reais do projecto
// Supabase. NAMESPACE distingue cada deploy (TB, Luiz, etc.) e tem de bater
// com o que está no localStorage actual desta deploy:
//   - source (~/content-machine/feedback/)     →  'cm-approval-v1'
//   - aprovacao-tb-202605/                     →  'cm-approval-tb-v1'
//   - aprovacao-luiz-202605/                   →  'cm-approval-luiz-v1'

export const SUPABASE_URL      = "https://ojbigtskkhmnerrppdjq.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qYmlndHNra2htbmVycnBwZGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjk1MDksImV4cCI6MjA5NDYwNTUwOX0.gFcdOh19siLqTzTsmoYDs2ZjA4l3uykRs01sRebkdZQ";

// Nome mostrado no header — única coisa visual que difere entre gémeas
export const CLIENT_NAME = "Luiz Santana_";
export const NAMESPACE = "cm-approval-luiz-v1";

// URL da página de Dashboard correspondente. Vazio = sem link no header.
// Cada deploy sobrescreve com a sua URL (ex: "../dashboard-tb-202605/").
export const DASHBOARD_URL = "../dashboard-luiz-202605/";

// Marcas que esta deploy mostra. Vazio = mostra tudo (default dev).
// Em produção cada deploy filtra para as suas marcas:
//   - aprovacao-tb-202605:   ["techbody", "techbody_u"]
//   - aprovacao-luiz-202605: ["luiz_santana"]
export const BRANDS_FILTER = ["luiz_santana"];

// Persistência no Supabase SEM login — usa anon key directo. RLS está aberta
// para anon (politicas anon_read/anon_insert/anon_update). Aprovações e notas
// persistem cross-device e sobrevivem a refreshes.
export const USE_SUPABASE = true;
// Login por email continua removido (magic-link bloqueava admins). Mantido false
// para retro-compatibilidade de código que ainda lê AUTH_ENABLED.
export const AUTH_ENABLED = false;

// Versão do app. Comparada periodicamente contra /version.txt no servidor.
// Se divergir, o badge muda para "🔄 Nova versão" e o user sabe que está
// numa sessão desactualizada. Bump em cada deploy importante.
export const APP_VERSION = "20260624-0610";
