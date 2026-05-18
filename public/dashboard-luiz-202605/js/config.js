// dashboard-luiz-202605 — Luiz Santana
export const SUPABASE_URL      = "https://ojbigtskkhmnerrppdjq.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qYmlndHNra2htbmVycnBwZGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjk1MDksImV4cCI6MjA5NDYwNTUwOX0.gFcdOh19siLqTzTsmoYDs2ZjA4l3uykRs01sRebkdZQ";
export const NAMESPACE = "cm-approval-luiz-v1";
export const BRANDS = ["luiz_santana"];
export const BRAND_LABEL = "Luiz";
export const PERIOD_LABEL = "Maio 2026";
export const MONTH = "2026-05";
export const APPROVAL_URL = "../aprovacao-luiz-202605/";

export const AUTH_ENABLED =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_PROJECT") &&
  !SUPABASE_ANON_KEY.includes("REPLACE");
