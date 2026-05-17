// main.js — load items, render calendar + carrossel list + stories + reels galleries.

import { loadItems } from "./data-loader.js";
import { approvalStore, init as initApprovalStore } from "./stores/approval-store.js";
import { supabase, AUTH_ENABLED } from "./lib/supabase-client.js";
import { monthShortLabel } from "./components/month-switcher.js";

const state = {
  items: [],
  currentMonth: "all",
  currentBrand:  "all",
  currentFormat: "all",
};

const els = {
  calendar:        () => document.getElementById("calendar"),
  monthSwitcher:   () => document.getElementById("monthSwitcher"),
  filterBar:       () => document.getElementById("filterBar"),
  headerLabel:     () => document.getElementById("headerLabel"),
  carrosseisList:  () => document.getElementById("carrosseisList"),
  postsGallery:    () => document.getElementById("postsGallery"),
  reelsGallery:    () => document.getElementById("reelsGallery"),
  totalCount:      () => document.getElementById("totalCount"),
  carrosseisCount: () => document.getElementById("carrosseisCount"),
  postsCount:      () => document.getElementById("postsCount"),
  reelsCount:      () => document.getElementById("reelsCount"),
  approvedCount:   () => document.getElementById("approvedCount"),
  rejectedCount:   () => document.getElementById("rejectedCount"),
  pendingCount:    () => document.getElementById("pendingCount"),
  viewer:          () => document.getElementById("viewer"),
};

function sortBySchedule(a, b) {
  return (a.scheduled_for || "").localeCompare(b.scheduled_for || "");
}

function visibleItems() {
  return state.items.filter(i => {
    if (state.currentMonth  !== "all" && inferMonth(i) !== state.currentMonth)  return false;
    if (state.currentBrand  !== "all" && i.brand        !== state.currentBrand)  return false;
    if (state.currentFormat !== "all" && i.format       !== state.currentFormat) return false;
    return true;
  });
}

// ─── URL state persistence ───────────────────────────────────────────────

function readUrlState() {
  const u = new URLSearchParams(window.location.search);
  return {
    month:  u.get("month")  || null,
    brand:  u.get("brand")  || null,
    format: u.get("format") || null,
  };
}

function writeUrlState() {
  const u = new URLSearchParams(window.location.search);
  const apply = (k, v, def) => {
    if (!v || v === def) u.delete(k); else u.set(k, v);
  };
  apply("month",  state.currentMonth,  "all");
  apply("brand",  state.currentBrand,  "all");
  apply("format", state.currentFormat, "all");
  const qs = u.toString();
  const path = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
  window.history.replaceState(null, "", path);
}

// ─── Aggregate stats for filter chip counts (respect *other* axes) ───────

function brandCounts() {
  const map = new Map();
  for (const it of state.items) {
    if (state.currentMonth  !== "all" && inferMonth(it) !== state.currentMonth)  continue;
    if (state.currentFormat !== "all" && it.format      !== state.currentFormat) continue;
    map.set(it.brand, (map.get(it.brand) || 0) + 1);
  }
  return Array.from(map.entries()).sort().map(([value, count]) => ({ value, count }));
}

function formatCounts() {
  const map = new Map();
  for (const it of state.items) {
    if (state.currentMonth !== "all" && inferMonth(it) !== state.currentMonth) continue;
    if (state.currentBrand !== "all" && it.brand       !== state.currentBrand) continue;
    map.set(it.format, (map.get(it.format) || 0) + 1);
  }
  // Ordem natural: carrossel → story → reel
  const ORDER = { carrossel: 0, story: 1, reel: 2 };
  return Array.from(map.entries())
    .sort(([a], [b]) => (ORDER[a] ?? 99) - (ORDER[b] ?? 99))
    .map(([value, count]) => ({ value, count }));
}

function inferMonth(item) {
  // Prefer it.month; fall back to first 7 chars of scheduled_for ("2026-05-07" → "2026-05").
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
  if (months.length <= 1) return months[0]?.value || "all";
  // Default to the *first* month containing the current date, or the latest month otherwise.
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (months.some(m => m.value === ym)) return ym;
  return months[months.length - 1].value; // most recent
}

function render() {
  const items = visibleItems();

  // Calendar reflects current month (or first month if "all"). Chips no calendário
  // respeitam o filtro brand/format actual.
  const calendarMonthScope = state.currentMonth !== "all"
    ? state.currentMonth
    : (availableMonths()[0]?.value || null);
  if (calendarMonthScope) {
    els.calendar().setMonth(calendarMonthScope);
    const calendarItems = state.items.filter(i =>
      inferMonth(i) === calendarMonthScope
      && (state.currentBrand  === "all" || i.brand  === state.currentBrand)
      && (state.currentFormat === "all" || i.format === state.currentFormat)
    );
    els.calendar().setItems(calendarItems);
  } else {
    els.calendar().setItems(items);
  }

  const carrosseis = items.filter(i => i.format === "carrossel").sort(sortBySchedule);
  const posts      = items.filter(i => i.format === "story").sort(sortBySchedule);
  const reels      = items.filter(i => i.format === "reel").sort(sortBySchedule);

  const list = els.carrosseisList();
  list.innerHTML = "";
  carrosseis.forEach(it => {
    const row = document.createElement("carrossel-row");
    row.setItem(it);
    list.appendChild(row);
  });

  const pg = els.postsGallery();
  pg.innerHTML = "";
  posts.forEach(it => {
    const tile = document.createElement("post-tile");
    tile.setItem(it);
    pg.appendChild(tile);
  });

  const rg = els.reelsGallery();
  rg.innerHTML = "";
  reels.forEach(it => {
    const tile = document.createElement("reel-tile");
    tile.setItem(it);
    rg.appendChild(tile);
  });

  // Empty state: se todos os filtros activos resultam em zero items,
  // mostrar mensagem clara em cima da lista de carrosseis.
  toggleEmptyState(items.length === 0 && hasActiveFilters());

  setCount(els.totalCount(),      items.length);
  setCount(els.carrosseisCount(), carrosseis.length);
  setCount(els.postsCount(),      posts.length);
  setCount(els.reelsCount(),      reels.length);

  // Atualiza as contagens das chips do filter-bar — reflectem a intersecção
  // dos *outros* eixos para que o user veja antecipadamente o efeito.
  const filterBar = els.filterBar();
  if (filterBar) {
    filterBar.setOptions(
      { brands: brandCounts(), formats: formatCounts() },
      { brand: state.currentBrand, format: state.currentFormat },
    );
  }

  // Header label reflects current scope.
  const headerLabel = els.headerLabel();
  if (headerLabel) {
    headerLabel.textContent = state.currentMonth === "all"
      ? "Aprovação · Todos os meses"
      : `Aprovação · ${monthShortLabel(state.currentMonth)}`;
  }

  writeUrlState();
  updateCounts();
}

function hasActiveFilters() {
  return state.currentBrand !== "all"
      || state.currentFormat !== "all"
      || state.currentMonth !== "all";
}

function toggleEmptyState(visible) {
  let el = document.getElementById("filterEmptyState");
  if (visible && !el) {
    el = document.createElement("div");
    el.id = "filterEmptyState";
    el.className = "filter-empty-state";
    el.innerHTML = `
      <p class="filter-empty-state__title">Nenhum item para estes filtros.</p>
      <button type="button" class="filter-empty-state__reset">Limpar filtros</button>
    `;
    el.querySelector(".filter-empty-state__reset").addEventListener("click", () => {
      state.currentBrand  = "all";
      state.currentFormat = "all";
      render();
    });
    document.getElementById("carrosseisSection").before(el);
  } else if (!visible && el) {
    el.remove();
  }
}

function setCount(el, n) {
  if (!el) return;
  el.textContent = n > 0 ? String(n) : "—";
  el.setAttribute("data-zero", n > 0 ? "false" : "true");
}

function findItem(id) { return state.items.find(it => it.id === id); }

function bindOpen() {
  document.addEventListener("item:open", e => {
    const it = findItem(e.detail.id);
    if (it) els.viewer().open(it);
  });
  document.addEventListener("calendar:item-click", e => {
    const it = findItem(e.detail.id);
    if (it) els.viewer().open(it);
  });
}

function updateCounts() {
  const counts = approvalStore.counts();
  const items = visibleItems();
  // Counts são por item visível: o approval-store guarda por id, mas só queremos
  // mostrar approved/rejected/pending para os items presentes no scope actual.
  let approved = 0, rejected = 0;
  for (const it of items) {
    const s = approvalStore.get(it.id)?.status;
    if (s === "approved") approved++;
    else if (s === "rejected") rejected++;
  }
  const pending = items.length - approved - rejected;
  els.approvedCount().textContent = String(approved);
  els.rejectedCount().textContent = String(rejected);
  els.pendingCount().textContent  = String(pending);
}

function manageLoader() {
  const loader = document.getElementById("loader");
  const fill   = document.getElementById("loaderFill");
  const hint   = document.getElementById("loaderHint");
  if (!loader) return;

  const start = performance.now();
  const MIN_VISIBLE_MS = 1200;   // never flash & disappear
  const PER_IFRAME_MS  = 18000;  // give each iframe up to 18s before we count it
  const HARD_CAP_MS    = 30000;  // absolute ceiling so user isn't stuck forever
  const POST_LOAD_PAINT_MS = 400; // wait for content to actually paint after load fires

  // Catch every iframe that gets rendered into the DOM.
  const iframes = Array.from(document.querySelectorAll("iframe"));
  const total = iframes.length;
  let done = 0;
  let hidden = false;

  const hideNow = () => {
    if (hidden) return;
    hidden = true;
    // Tiny delay so the user sees the bar reach 100% before fade.
    setTimeout(() => loader.setAttribute("aria-hidden", "true"), 220);
  };

  const tryHide = () => {
    if (hidden) return;
    if (done < total) return;
    const elapsed = performance.now() - start;
    if (elapsed >= MIN_VISIBLE_MS) {
      hideNow();
    } else {
      setTimeout(tryHide, MIN_VISIBLE_MS - elapsed + 20);
    }
  };

  const update = () => {
    const pct = total === 0 ? 1 : done / total;
    fill.style.transform = `scaleX(${pct})`;
    hint.textContent = `${done} / ${total}`;
    tryHide();
  };

  if (total === 0) {
    fill.style.transform = "scaleX(1)";
    setTimeout(() => loader.setAttribute("aria-hidden", "true"), MIN_VISIBLE_MS);
    return;
  }

  update();

  iframes.forEach((f) => {
    let ticked = false;
    const tick = () => {
      if (ticked) return;
      ticked = true;
      done += 1;
      update();
    };

    // Wait for the iframe's window load (covers its images + fonts), then
    // wait one paint cycle so the content is actually on the screen.
    const onLoad = () => {
      // The iframe document is now done. Wait for its inner window load too
      // (catches images/fonts inside the carousel/story HTML).
      try {
        const w = f.contentWindow;
        const inner = () => requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(tick, POST_LOAD_PAINT_MS))
        );
        if (w && w.document && w.document.readyState === "complete") {
          inner();
        } else if (w) {
          w.addEventListener("load", inner, { once: true });
        } else {
          inner();
        }
      } catch {
        // Cross-origin or similar — best effort.
        setTimeout(tick, POST_LOAD_PAINT_MS);
      }
    };

    if (f.contentDocument && f.contentDocument.readyState === "complete") {
      onLoad();
    } else {
      f.addEventListener("load",  onLoad, { once: true });
      f.addEventListener("error", tick,   { once: true });
    }

    // Per-iframe safety net.
    setTimeout(tick, PER_IFRAME_MS);
  });

  // Absolute ceiling.
  setTimeout(hideNow, HARD_CAP_MS);
}

async function ensureAuthenticated() {
  if (!AUTH_ENABLED) return null; // modo dev: salta auth, usa localStorage
  const authModal = document.getElementById("authModal");
  const userMenu  = document.getElementById("userMenu");

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    userMenu.setSession(session);
    return session;
  }

  // Esconde o loader; o modal toma conta.
  const loader = document.getElementById("loader");
  if (loader) loader.setAttribute("aria-hidden", "true");

  authModal.open();

  // Aguarda evento de sessão estabelecida (após click do magic link, Supabase
  // emite SIGNED_IN).
  return new Promise((resolve) => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "SIGNED_IN" && sess) {
        sub?.subscription?.unsubscribe?.();
        authModal.close();
        userMenu.setSession(sess);
        resolve(sess);
      }
    });
  });
}

async function init() {
  await ensureAuthenticated();
  await initApprovalStore();
  state.items = await loadItems();
  bindOpen();
  window.addEventListener("approval:changed", updateCounts);

  // Wire the month switcher: list available months + pick default.
  const months = availableMonths();
  const urlState = readUrlState();
  state.currentMonth  = urlState.month  || pickDefaultMonth(months);
  state.currentBrand  = urlState.brand  || "all";
  state.currentFormat = urlState.format || "all";

  const switcher = els.monthSwitcher();
  if (switcher) {
    switcher.setMonths(months, state.currentMonth);
    switcher.addEventListener("month:change", e => {
      state.currentMonth = e.detail.month;
      render();
      requestAnimationFrame(() => requestAnimationFrame(manageLoader));
    });
  }

  const filterBar = els.filterBar();
  if (filterBar) {
    filterBar.addEventListener("filter:change", e => {
      state.currentBrand  = e.detail.brand;
      state.currentFormat = e.detail.format;
      render();
      requestAnimationFrame(() => requestAnimationFrame(manageLoader));
    });
  }

  render();
  // Wait one frame for the components to mount their iframes, then watch them.
  requestAnimationFrame(() => requestAnimationFrame(manageLoader));
}

init();
