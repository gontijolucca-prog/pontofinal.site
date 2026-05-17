// main.js — dashboard bootstrap. Auth gate → load themes + items + approvals.

import { supabase, AUTH_ENABLED } from "./lib/supabase-client.js";
import { loadThemes, loadItems, loadApprovals, subscribeApprovals } from "./lib/data-loader.js";
import { BRAND_LABEL, PERIOD_LABEL } from "./config.js";

const state = {
  items: [],
  approvals: {},
  themes: [],
};

const els = {
  brandLogo:     () => document.getElementById("brandLogo"),
  periodLabel:   () => document.getElementById("periodLabel"),
  approvalStats: () => document.getElementById("approvalStats"),
  themesCatalog: () => document.getElementById("themesCatalog"),
  footerSummary: () => document.getElementById("footerSummary"),
  authModal:     () => document.getElementById("authModal"),
  userMenu:      () => document.getElementById("userMenu"),
};

function applyConfig() {
  els.brandLogo().textContent = `${BRAND_LABEL}_`;
  els.periodLabel().textContent = `Aprovação · ${PERIOD_LABEL}`;
}

async function ensureAuthenticated() {
  if (!AUTH_ENABLED) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    els.userMenu().setSession(session);
    return session;
  }
  els.authModal().open();
  return new Promise((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "SIGNED_IN" && sess) {
        sub?.subscription?.unsubscribe?.();
        els.authModal().close();
        els.userMenu().setSession(sess);
        resolve(sess);
      }
    });
  });
}

function renderAll() {
  els.approvalStats().setData(state.items, state.approvals);
  els.themesCatalog().setData(state.themes);
  updateFooter();
}

function updateFooter() {
  const total = state.items.length;
  let a = 0, r = 0;
  for (const it of state.items) {
    const s = state.approvals[it.id]?.status;
    if (s === "approved") a++;
    else if (s === "rejected") r++;
  }
  const pending = total - a - r;
  els.footerSummary().innerHTML =
    `Aprovados <strong>${a}</strong> · Rejeitados <strong>${r}</strong> · Pendentes <strong>${pending}</strong>`;
}

async function reloadApprovals() {
  state.approvals = await loadApprovals();
  renderAll();
}

async function init() {
  applyConfig();
  await ensureAuthenticated();

  const [themes, items, approvals] = await Promise.all([
    loadThemes(),
    loadItems(),
    loadApprovals(),
  ]);
  state.themes = themes;
  state.items = items;
  state.approvals = approvals;
  renderAll();

  // Realtime: alterações às aprovações refletem-se de imediato no dashboard.
  if (AUTH_ENABLED) subscribeApprovals(reloadApprovals);
}

init().catch(err => {
  console.error("[dashboard] init falhou:", err);
});
