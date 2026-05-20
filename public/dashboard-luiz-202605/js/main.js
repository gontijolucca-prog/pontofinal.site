// main.js — dashboard bootstrap. Auth gate → load themes + items + approvals.

import { supabase, AUTH_ENABLED } from "./lib/supabase-client.js?v=20260520a";
import { loadThemes, loadItems, loadApprovals, subscribeApprovals } from "./lib/data-loader.js?v=20260520a";
import { BRAND_LABEL, APPROVAL_URL } from "./config.js?v=20260520a";
import { monthShortLabel } from "./components/month-switcher.js?v=20260520a";

const state = {
  items: [],
  approvals: {},
  themes: [],
  currentMonth: "all",
};

const els = {
  brandLogo:     () => document.getElementById("brandLogo"),
  periodLabel:   () => document.getElementById("periodLabel"),
  monthSwitcher: () => document.getElementById("monthSwitcher"),
  approvalStats: () => document.getElementById("approvalStats"),
  themesCatalog: () => document.getElementById("themesCatalog"),
  footerSummary: () => document.getElementById("footerSummary"),
  authModal:     () => document.getElementById("authModal"),
  userMenu:      () => document.getElementById("userMenu"),
};

function applyConfig() {
  els.brandLogo().textContent = `${BRAND_LABEL}_`;
  els.periodLabel().textContent = `Dashboard · ${BRAND_LABEL}`;
  const back = document.getElementById("approvalLink");
  if (back && APPROVAL_URL) {
    back.href = APPROVAL_URL;
    back.hidden = false;
  }
}

function inferMonth(item) {
  if (item.month) return item.month;
  if (typeof item.scheduled_for === "string" && item.scheduled_for.length >= 7) {
    return item.scheduled_for.slice(0, 7);
  }
  return null;
}

function availableMonths() {
  const map = new Map();
  for (const it of state.items) {
    const m = inferMonth(it);
    if (!m) continue;
    map.set(m, (map.get(m) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, count }));
}

function pickDefaultMonth(months) {
  if (months.length === 0) return "all";
  if (months.length === 1) return months[0].value;
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (months.some(m => m.value === ym)) return ym;
  return months[months.length - 1].value;
}

function visibleItems() {
  if (state.currentMonth === "all") return state.items;
  return state.items.filter(it => inferMonth(it) === state.currentMonth);
}

function updatePeriodLabel() {
  const label = state.currentMonth === "all"
    ? `Dashboard · ${BRAND_LABEL} · Todos os meses`
    : `Dashboard · ${BRAND_LABEL} · ${monthShortLabel(state.currentMonth)}`;
  els.periodLabel().textContent = label;
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
  const items = visibleItems();
  els.approvalStats().setData(items, state.approvals);
  els.themesCatalog().setData(state.themes);  // temas são atemporais, não filtram
  updatePeriodLabel();
  updateFooter();
}

function updateFooter() {
  const items = visibleItems();
  const total = items.length;
  let a = 0, r = 0;
  for (const it of items) {
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

  const [themes, items, approvals] = await Promise.all([
    loadThemes(),
    loadItems(),
    loadApprovals(),
  ]);
  state.themes = themes;
  state.items = items;
  state.approvals = approvals;

  // Wire month switcher.
  const months = availableMonths();
  state.currentMonth = pickDefaultMonth(months);
  const switcher = els.monthSwitcher();
  if (switcher) {
    switcher.setMonths(months, state.currentMonth);
    switcher.addEventListener("month:change", e => {
      state.currentMonth = e.detail.month;
      renderAll();
    });
  }

  renderAll();

  // Realtime: alterações às aprovações refletem-se de imediato no dashboard.
  if (AUTH_ENABLED) subscribeApprovals(reloadApprovals);
}

init().catch(err => {
  console.error("[dashboard] init falhou:", err);
});
