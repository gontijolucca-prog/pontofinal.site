// main.js — load items, render calendar + carrossel list + stories + reels galleries.

import { loadItems } from "./data-loader.js";
import { approvalStore, init as initApprovalStore } from "./stores/approval-store.js";
import { supabase, AUTH_ENABLED, USE_SUPABASE, initSupabase } from "./lib/supabase-client.js";
import { monthShortLabel } from "./components/month-switcher.js";
import { DASHBOARD_URL } from "./config.js";

function todayYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const state = {
  items: [],
  currentMonth: todayYYYYMM(),
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
    if (inferMonth(i) !== state.currentMonth) return false;
    if (state.currentBrand  !== "all" && i.brand  !== state.currentBrand)  return false;
    if (state.currentFormat !== "all" && i.format !== state.currentFormat) return false;
    return true;
  });
}

// Extrai padrão de publicação a partir dos items reais (qualquer mês).
// Retorna lista de { day, hour, brand, format, title }.
function publishPattern() {
  // Usa o primeiro mês com items como template (assumimos cadência mensal).
  const months = activeMonths();
  if (!months.length) return [];
  const template = months[0];
  const pattern = [];
  for (const it of state.items) {
    if (inferMonth(it) !== template) continue;
    if (!it.scheduled_for) continue;
    const day = parseInt(it.scheduled_for.split("-")[2], 10);
    if (!day) continue;
    pattern.push({
      day,
      hour: it.hour || "",
      brand: it.brand,
      format: it.format,
      theme: it.theme || "",
      title: it.title || it.theme || "",
    });
  }
  return pattern;
}

// Constrói "ghost items" (não-clicáveis, placeholder) para um mês sem conteúdo.
// Aplica os mesmos brand/format filters do state para coerência visual.
function ghostItemsFor(yyyymm) {
  return publishPattern()
    .filter(p => state.currentBrand === "all" || p.brand === state.currentBrand)
    .filter(p => state.currentFormat === "all" || p.format === state.currentFormat)
    .map((p, i) => ({
      id: `ghost-${yyyymm}-${i}`,
      _ghost: true,
      brand: p.brand,
      format: p.format,
      scheduled_for: `${yyyymm}-${String(p.day).padStart(2, "0")}`,
      hour: p.hour,
      theme: p.theme,
      title: p.title,
    }));
}

function activeMonths() {
  // Meses que têm pelo menos 1 item real.
  const set = new Set();
  for (const it of state.items) {
    const m = inferMonth(it);
    if (m) set.add(m);
  }
  return Array.from(set).sort();
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
  apply("month",  state.currentMonth,  todayYYYYMM());
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
    if (inferMonth(it) !== state.currentMonth) continue;
    if (state.currentFormat !== "all" && it.format !== state.currentFormat) continue;
    map.set(it.brand, (map.get(it.brand) || 0) + 1);
  }
  return Array.from(map.entries()).sort().map(([value, count]) => ({ value, count }));
}

function formatCounts() {
  const map = new Map();
  for (const it of state.items) {
    if (inferMonth(it) !== state.currentMonth) continue;
    if (state.currentBrand !== "all" && it.brand !== state.currentBrand) continue;
    map.set(it.format, (map.get(it.format) || 0) + 1);
  }
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

function render() {
  const items = visibleItems();
  const monthHasContent = items.length > 0
    || state.items.some(i => inferMonth(i) === state.currentMonth);

  // Calendário mostra sempre o mês actual. Se este mês tem conteúdo real,
  // mostra os items reais; senão, mostra "ghost" placeholders no padrão.
  els.calendar().setMonth(state.currentMonth);
  if (monthHasContent) {
    const realCalendarItems = state.items.filter(i =>
      inferMonth(i) === state.currentMonth
      && (state.currentBrand  === "all" || i.brand  === state.currentBrand)
      && (state.currentFormat === "all" || i.format === state.currentFormat)
    );
    els.calendar().setItems(realCalendarItems);
  } else {
    els.calendar().setItems(ghostItemsFor(state.currentMonth));
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

  // Empty state: distinguir entre "mês sem conteúdo ainda" e "filtros vazios".
  const monthEmpty = items.length === 0;
  const otherMonthsHaveContent = activeMonths().length > 0;
  if (monthEmpty && otherMonthsHaveContent && !state.items.some(i => inferMonth(i) === state.currentMonth)) {
    toggleEmptyState("month-empty");
  } else if (monthEmpty && hasActiveFilters()) {
    toggleEmptyState("filter-empty");
  } else {
    toggleEmptyState(null);
  }

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

  const headerLabel = els.headerLabel();
  if (headerLabel) {
    headerLabel.textContent = `Aprovação · ${monthShortLabel(state.currentMonth)}`;
  }

  writeUrlState();
  updateCounts();
}

function hasActiveFilters() {
  return state.currentBrand !== "all" || state.currentFormat !== "all";
}

function toggleEmptyState(kind) {
  let el = document.getElementById("filterEmptyState");
  if (!kind) { el?.remove(); return; }
  if (el && el.dataset.kind === kind) return;
  el?.remove();
  el = document.createElement("div");
  el.id = "filterEmptyState";
  el.className = "filter-empty-state";
  el.dataset.kind = kind;
  if (kind === "month-empty") {
    el.innerHTML = `
      <p class="filter-empty-state__title">Sem conteúdo produzido para ${monthShortLabel(state.currentMonth)}.</p>
      <p class="filter-empty-state__sub">O calendário mostra o padrão de publicação (dias e horas) — os posts serão produzidos mais perto da data.</p>
    `;
  } else {
    el.innerHTML = `
      <p class="filter-empty-state__title">Nenhum item para estes filtros.</p>
      <button type="button" class="filter-empty-state__reset">Limpar filtros</button>
    `;
    el.querySelector(".filter-empty-state__reset").addEventListener("click", () => {
      state.currentBrand  = "all";
      state.currentFormat = "all";
      render();
    });
  }
  document.getElementById("carrosseisSection").before(el);
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
  // Keyboard advance dentro do viewer (A/R/J/K).
  document.addEventListener("viewer:advance", e => {
    const items = visibleItems().sort(sortBySchedule);
    const idx = items.findIndex(it => it.id === e.detail.currentId);
    if (idx < 0) { e.detail.next = null; return; }
    const target = items[idx + e.detail.direction];
    e.detail.next = target || null;
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
  const label  = document.querySelector(".loader__label-text") || document.querySelector(".loader__label");
  if (!loader) return;

  const start = performance.now();
  const MIN_VISIBLE_MS = 700;
  const PER_IFRAME_HARD_TIMEOUT = 60_000; // 60s por iframe — só dispara em casos extremos
  const ABSOLUTE_SAFETY_MS = 5 * 60_000;  // 5 min absoluto (rede partida)
  const SETTLE_WINDOW_MS = 400;           // body height tem de estar estável este tempo
  const SETTLE_POLL_MS = 80;
  const POST_LOAD_PAINT_MS = 250;

  const iframes = Array.from(document.querySelectorAll("iframe"));
  const total = iframes.length;
  let done = 0;
  let hidden = false;
  let allIframesReady = false;

  function hideNow() {
    if (hidden) return;
    hidden = true;
    setTimeout(() => loader.setAttribute("aria-hidden", "true"), 220);
  }

  // Espera até a página estar estável (fonts loaded + body height parou de mudar).
  // Só depois liberta o scroll. Isto resolve o "loader desaparece mas página
  // continua a saltar" — fica visível enquanto o reflow está em curso.
  function waitForSettlementThenHide() {
    if (hidden) return;
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => {
      let lastHeight = document.body.scrollHeight;
      let stableSince = performance.now();
      const poll = () => {
        if (hidden) return;
        const h = document.body.scrollHeight;
        if (h !== lastHeight) {
          lastHeight = h;
          stableSince = performance.now();
        }
        if (performance.now() - stableSince >= SETTLE_WINDOW_MS) {
          // Garantir min-visible
          const elapsed = performance.now() - start;
          if (elapsed >= MIN_VISIBLE_MS) hideNow();
          else setTimeout(hideNow, MIN_VISIBLE_MS - elapsed);
        } else {
          setTimeout(poll, SETTLE_POLL_MS);
        }
      };
      poll();
    });
  }

  function update() {
    const pct = total === 0 ? 1 : done / total;
    if (fill) fill.style.transform = `scaleX(${pct})`;
    if (hint) hint.textContent = `${done} / ${total}`;
    if (label && allIframesReady) label.textContent = "Quase pronto…";
    if (done >= total && !allIframesReady) {
      allIframesReady = true;
      if (label) label.textContent = "A finalizar…";
      // iframes todos reportaram done — agora espera que a página assente.
      waitForSettlementThenHide();
    }
  }

  if (total === 0) {
    update();
    waitForSettlementThenHide();
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

    const onLoad = () => {
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
        setTimeout(tick, POST_LOAD_PAINT_MS);
      }
    };

    if (f.contentDocument && f.contentDocument.readyState === "complete") {
      onLoad();
    } else {
      f.addEventListener("load",  onLoad, { once: true });
      f.addEventListener("error", tick,   { once: true });
    }

    setTimeout(tick, PER_IFRAME_HARD_TIMEOUT);
  });

  // Safety absoluta — só dispara se algo for *muito* mal (rede partida).
  setTimeout(hideNow, ABSOLUTE_SAFETY_MS);
}

async function ensureAuthenticated() {
  // USE_SUPABASE mode: init Supabase (anon), skip auth modal completely.
  if (USE_SUPABASE && !AUTH_ENABLED) {
    await initSupabase();
    return null;
  }
  if (!AUTH_ENABLED) return null;
  const authModal = document.getElementById("authModal");
  const userMenu  = document.getElementById("userMenu");

  const client = await initSupabase();
  if (!client) return null;
  const { data: { session } } = await client.auth.getSession();
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
  // Dashboard link no header — visível se config.js definir DASHBOARD_URL.
  const dashLink = document.getElementById("dashboardLink");
  if (dashLink && DASHBOARD_URL) {
    dashLink.href = DASHBOARD_URL;
    dashLink.hidden = false;
  }

  await ensureAuthenticated();
  await initApprovalStore();
  state.items = await loadItems();
  bindOpen();
  window.addEventListener("approval:changed", () => {
    updateCounts();
    // Re-render calendar para actualizar os badges. Galerias mantêm-se.
    els.calendar()?.render?.();
  });

  const months = activeMonths();
  const urlState = readUrlState();
  state.currentMonth  = urlState.month  || todayYYYYMM();
  state.currentBrand  = urlState.brand  || "all";
  state.currentFormat = urlState.format || "all";

  const switcher = els.monthSwitcher();
  if (switcher) {
    switcher.setActiveMonths(months);
    switcher.setMonth(state.currentMonth);
    switcher.addEventListener("month:change", e => {
      const prevY = window.scrollY;
      state.currentMonth = e.detail.month;
      render();
      requestAnimationFrame(() => {
        const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo(0, Math.min(prevY, maxY));
      });
    });
  }

  const filterBar = els.filterBar();
  if (filterBar) {
    filterBar.addEventListener("filter:change", e => {
      const prevY = window.scrollY;
      state.currentBrand  = e.detail.brand;
      state.currentFormat = e.detail.format;
      render();
      // Restaurar scroll DEPOIS do render (a página pode encolher e o
      // browser snap-to-max levaria o user "para o meio"). Não voltamos
      // a chamar manageLoader — filtros são interacções rápidas, sem
      // re-show do loader.
      requestAnimationFrame(() => {
        const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo(0, Math.min(prevY, maxY));
      });
    });
  }

  render();
  // Wait one frame for the components to mount their iframes, then watch them.
  requestAnimationFrame(() => requestAnimationFrame(manageLoader));
}

init();
