// main.js — load items, render calendar + carrossel list + stories + reels galleries.

import { loadItems, startContentPolling, currentContentSig } from "./data-loader.js";
import { userIsEditing } from "./utils/user-editing.js";
import { approvalStore, init as initApprovalStore } from "./stores/approval-store.js";
import { supabase, AUTH_ENABLED, USE_SUPABASE, initSupabase } from "./lib/supabase-client.js";
import { monthShortLabel } from "./components/month-switcher.js";
import { DASHBOARD_URL, APP_VERSION } from "./config.js";
import { fitScaledFrame, dimsFor } from "./lib/fit-frame.js";

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
  galleryGrid:     () => document.getElementById("galleryGrid"),
  galleryCount:    () => document.getElementById("galleryCount"),
  totalCount:      () => document.getElementById("totalCount"),
  approvedCount:   () => document.getElementById("approvedCount"),
  rejectedCount:   () => document.getElementById("rejectedCount"),
  pendingCount:    () => document.getElementById("pendingCount"),
  viewer:          () => document.getElementById("viewer"),
};

function sortBySchedule(a, b) {
  return (a.scheduled_for || "").localeCompare(b.scheduled_for || "");
}

// Lê overrides de data do Supabase (via approvalStore) e aplica em
// state.items. Garante que reagendamentos manuais persistem cross-device.
function applyDateOverrides() {
  const overrides = approvalStore.getAllDateOverrides?.() || {};
  let mutated = false;
  for (const it of state.items) {
    const ov = overrides[it.id]?.date;
    if (!ov) continue;
    if (it.scheduled_for !== ov) {
      it.scheduled_for = ov;
      mutated = true;
    }
    if (ov.length >= 7 && it.month !== ov.slice(0, 7)) {
      it.month = ov.slice(0, 7);
      mutated = true;
    }
  }
  return mutated;
}

function applyHourOverrides() {
  const overrides = approvalStore.getAllHourOverrides?.() || {};
  let mutated = false;
  for (const it of state.items) {
    const ov = overrides[it.id]?.hour;
    if (!ov) continue;
    if (it.hour !== ov) {
      it.hour = ov;
      mutated = true;
    }
  }
  return mutated;
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
    const cur = map.get(it.brand) || { count: 0, approved: 0 };
    cur.count += 1;
    if (approvalStore.get(it.id)?.status === "approved") cur.approved += 1;
    map.set(it.brand, cur);
  }
  return Array.from(map.entries()).sort().map(([value, v]) => ({ value, count: v.count, approved: v.approved }));
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

// Função para saber o status efectivo (items.json status tem prioridade).
const effectiveStatus = (it) => it.status === "published"
  ? "published"
  : (approvalStore.get(it.id)?.status || "pending");

// Construir preview card (gallery-card) com capa + iframe/video lazy.
const buildCard = (it) => {
  const card = document.createElement("div");
  card.className = "gallery-card";
  card.setAttribute("data-item-id", it.id);
  card.setAttribute("data-format", it.format);
  card.setAttribute("data-brand", it.brand);
  const st = effectiveStatus(it);
  card.setAttribute("data-status", st);
  const title = it.title || it.theme || "";
  const shotBase = (it.html_url || "").replace(/\.html$/, "");
  const isReel = it.format === "reel";
  const coverPath = isReel
    ? shotBase ? shotBase + ".jpg" : ""
    : it.format === "carrossel"
    ? shotBase ? shotBase + "_shots/slide_01.jpg" : ""
    : shotBase ? shotBase + ".jpg" : "";
  const coverSrc = coverPath ? coverPath + "?v=" + APP_VERSION + "&c=" + currentContentSig() : "";
  const iframeSrc = !isReel && it.html_url
    ? it.html_url + "?v=" + APP_VERSION + "&c=" + currentContentSig() + (it.format === "carrossel" ? "#slide-1" : "")
    : "";
  const videoSrc = isReel && it.video_url
    ? it.video_url + "?v=" + APP_VERSION + "&c=" + currentContentSig()
    : "";
  const poster = isReel && it.video_url
    ? it.video_url.replace(/.mp4$/, ".jpg")
    : "";
  card.innerHTML = `
    <div class="gallery-card__thumb" data-fmt="${it.format}">
      ${coverSrc
        ? '<img class="gallery-card__cover" src="' + coverSrc + '" alt="' + _escapeForHtml(title) + '" loading="eager" fetchpriority="high" onerror="this.onerror=null;this.closest(\'.gallery-card__thumb\').classList.add(\'is-broken\')" />'
        : '<div class="gallery-card__no-preview">Sem preview</div>'}
      ${videoSrc
        ? '<video class="gallery-card__video" data-src="' + videoSrc + '" poster="' + poster + '" muted loop playsinline preload="none" style="display:none"></video>'
        : iframeSrc
        ? '<iframe data-hover-src="' + iframeSrc + '" title="' + _escapeForHtml(title) + '" scrolling="no" loading="lazy" tabindex="-1" style="display:none"></iframe>'
        : ""}
      <span class="gallery-card__badge gallery-card__badge--${st}">${st === "approved" ? "\u2713" : st === "rejected" ? "\u2717" : st === "published" ? "📌" : ""}</span>
    </div>
    <div class="gallery-card__info">
      <span class="gallery-card__title">${title}</span>
    </div>`;
  const thumb = card.querySelector(".gallery-card__thumb");
  const img = card.querySelector("img.gallery-card__cover");
  const iframe = card.querySelector("iframe");
  if (img && iframe) {
    const loadIframe = () => {
      if (iframe.dataset.hoverSrc && !iframe.src) {
        iframe.src = iframe.dataset.hoverSrc;
        iframe.style.display = "";
        img.style.display = "none";
        var nw_nh = dimsFor(it.format);
        fitScaledFrame(thumb, nw_nh[0], nw_nh[1]);
      }
    };
    thumb.addEventListener("mouseenter", loadIframe);
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadIframe();
          obs.unobserve(entry.target);
        }
      }
    }, { rootMargin: "200px" });
    obs.observe(thumb);
    card._pubObserver = obs;
  }
  const video = card.querySelector("video");
  if (img && video) {
    thumb.addEventListener("mouseenter", () => {
      if (video.dataset.src && !video.src) {
        video.src = video.dataset.src;
        delete video.dataset.src;
      }
      video.play().catch(() => {});
      img.style.display = "none";
      video.style.display = "";
    });
    thumb.addEventListener("mouseleave", () => {
      video.pause();
      video.currentTime = 0;
    });
  }
  card.addEventListener("click", () => {
    const found = findItem(card.dataset.itemId);
    if (found) els.viewer().open(found);
  });
  return card;
};

// ─── Render ──────────────────────────────────────────────────────────────


function renderPublishedSection() {
  const container = document.getElementById("publishedGrid");
  const totalEl = document.getElementById("publishedCount");
  if (!container) return;
  const pubItems = state.items.filter(i => i.status === "published");
  pubItems.sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")));
  if (totalEl) totalEl.textContent = pubItems.length;
  // Actualizar hint com contagens por formato.
  const hintEl = document.getElementById("publishedSection")?.querySelector(".section__hint");
  if (hintEl) {
    const counts = { carrossel: 0, reel: 0, story: 0 };
    for (const it of pubItems) { if (counts[it.format] !== undefined) counts[it.format]++; }
    hintEl.textContent = `Carrosséis ${counts.carrossel}  ·  Reels ${counts.reel}  ·  Storys ${counts.story}  —  clique para abrir`;
  }
  // Renderizar mini previews (gallery-card) — igual à galeria.
  // Agrupar por formato (carrossel / reel / story) em sub-grids já presentes no HTML.
  const FORMAT_ORDER = ["carrossel", "reel", "story"];
  const groups = { carrossel: [], reel: [], story: [] };
  for (const it of pubItems) { if (groups[it.format]) groups[it.format].push(it); }
  for (const fmt of FORMAT_ORDER) {
    const sub = container.querySelector(`[data-grid="${fmt}"]`);
    const countEl = container.querySelector(`[data-count="${fmt}"]`);
    if (!sub) continue;
    if (countEl) countEl.textContent = groups[fmt].length;
    sub.innerHTML = "";
    for (const it of groups[fmt]) {
      if (typeof buildCard === "function") {
        sub.appendChild(buildCard(it));
      } else {
        // fallback raro: se buildCard não estiver disponível
        const el = document.createElement("div");
        el.className = "gallery-card";
        el.style.cssText = "padding:12px;border:2px solid var(--border);font:700 11px/1.3 var(--font-mono);cursor:pointer;";
        el.textContent = it.title || it.theme || it.id;
        sub.appendChild(el);
      }
    }
    // Esconder sub-categoria se não tem items.
    const groupDiv = sub.closest(".gallery-group");
    if (groupDiv) groupDiv.style.display = groups[fmt].length === 0 ? "none" : "";
  }
  // Click delegation (abre o item-viewer).
  container.addEventListener("click", (e) => {
    const card = e.target.closest(".gallery-card");
    if (card) {
      const ev = new CustomEvent("published:item-click", { bubbles: true, detail: { id: card.dataset.itemId } });
      document.dispatchEvent(ev);
    }
  });
}

function render() {
  const items = visibleItems();
  const monthHasContent = items.length > 0
    || state.items.some(i => inferMonth(i) === state.currentMonth);

  // Calendário mostra sempre o mês actual. Se este mês tem conteúdo real
  // COM datas agendadas, mostra os items reais. Senão (ou se os items não
  // têm scheduled_for), mostra "ghost" placeholders no padrão.
  els.calendar().setMonth(state.currentMonth);
  const realCalendarItems = state.items.filter(i =>
    inferMonth(i) === state.currentMonth
    && (state.currentBrand  === "all" || i.brand  === state.currentBrand)
    && (state.currentFormat === "all" || i.format === state.currentFormat)
  );
  // Secção "Publicados" — itens com status: published em items.json (independentemente
  // do mês visível no calendário: serve de log histórico do que já saiu).
  renderPublishedSection();

  const hasScheduled = realCalendarItems.some(i => i.scheduled_for);
  if (hasScheduled) {
    els.calendar().setItems(realCalendarItems);
  } else {
    // Sem datas agendadas neste mês — usa ghost items (ou items reais como ghost)
    const ghosts = ghostItemsFor(state.currentMonth);
    if (realCalendarItems.length > 0) {
      realCalendarItems.forEach((it, i) => {
        ghosts.push({
          ...it,
          id: `real-${it.id}`,
          _real: true,
        });
      });
    }
    els.calendar().setItems(ghosts);
  }

  // Galeria unificada — dividida por marca e tipo de conteúdo
  const gg = els.galleryGrid();
  if (gg) {
    gg.innerHTML = "";
    const allSorted = [...items].sort(sortBySchedule);
    // Agrupar por marca → formato. Publicados vão para grupo separado.
    const BRAND_NAMES = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };
    const FORMAT_NAMES = { carrossel: "Carrosséis", story: "Stories", reel: "Reels" };
    const FORMAT_ORDER = ["carrossel", "story", "reel"];
    // Função para saber o status efectivo (items.json status tem prioridade)
    const grouped = {};
    const publishedItems = [];
    for (const it of allSorted) {
      if (effectiveStatus(it) === "published") {
        publishedItems.push(it);
        continue;
      }
      const b = it.brand || "outro";
      const f = it.format || "outro";
      if (!grouped[b]) grouped[b] = {};
      if (!grouped[b][f]) grouped[b][f] = [];
      grouped[b][f].push(it);
    }
    // buildCard definido a nível de módulo — reutilizável pela secção
    // "Publicados" (previews com imagem/iframe) e pela galeria principal.
    // Grupo "Publicados" — primeiro (publicados vão para baixo)
    // Placeholder: criado depois dos grupos marca+formato
    // Grupos por marca → formato
    const brandOrder = Object.keys(BRAND_NAMES).filter(b => grouped[b]);
    const otherBrands = Object.keys(grouped).filter(b => !BRAND_NAMES[b]);
    for (const brand of [...brandOrder, ...otherBrands]) {
      const brandGroup = grouped[brand];
      const brandLabel = BRAND_NAMES[brand] || brand;
      const groupEl = document.createElement("div");
      groupEl.className = "gallery-group";
      const titleRow = document.createElement("div");
      titleRow.className = "gallery-group__head";
      const brandTotal = Object.values(brandGroup).reduce((s, arr) => s + arr.length, 0);
      titleRow.innerHTML = `<h3 class="gallery-group__title">${brandLabel}</h3><span class="gallery-group__count">${brandTotal}</span>`;
      groupEl.appendChild(titleRow);
      for (const fmt of FORMAT_ORDER) {
        const arr = brandGroup[fmt];
        if (!arr || !arr.length) continue;
        const fmtWrap = document.createElement("div");
        fmtWrap.className = "gallery-group__sub";
        fmtWrap.innerHTML = `<h4 class="gallery-group__subtitle">${FORMAT_NAMES[fmt] || fmt} <span class="gallery-group__subcount">${arr.length}</span></h4>`;
        const grid = document.createElement("div");
        grid.className = "gallery-grid";
        for (const it of arr) grid.appendChild(buildCard(it));
        fmtWrap.appendChild(grid);
        groupEl.appendChild(fmtWrap);
      }
      gg.appendChild(groupEl);
    }
    // Grupo "Publicados" no TOPO da galeria, subdividido por formato.
    if (publishedItems.length > 0) {
      const pubGroup = document.createElement("div");
      pubGroup.className = "gallery-group gallery-group--published";
      pubGroup.innerHTML = `<div class="gallery-group__head"><h3 class="gallery-group__title">📌 Publicados</h3><span class="gallery-group__count">${publishedItems.length}</span></div>`;
      // Agrupar por formato (carrossel / reel / story) — mesmo padrão que a
      // secção "Publicados" do calendário, para consistência visual.
      const publishedByFmt = { carrossel: [], reel: [], story: [] };
      for (const it of publishedItems) {
        if (publishedByFmt[it.format]) publishedByFmt[it.format].push(it);
      }
      for (const fmt of FORMAT_ORDER) {
        const arr = publishedByFmt[fmt];
        if (!arr || !arr.length) continue;
        const sub = document.createElement("div");
        sub.className = "gallery-group__sub";
        sub.innerHTML = `<h4 class="gallery-group__subtitle">${FORMAT_NAMES[fmt] || fmt} <span class="gallery-group__subcount">${arr.length}</span></h4>`;
        const grid = document.createElement("div");
        grid.className = "gallery-grid";
        for (const it of arr) grid.appendChild(buildCard(it));
        sub.appendChild(grid);
        pubGroup.appendChild(sub);
      }
      gg.appendChild(pubGroup);
    }
    setCount(els.galleryCount(), allSorted.length);
  }

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

  setCount(els.totalCount(), items.length);

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
    if (!it) return;
    // Always open viewer (sections are hidden in calendar-only mode)
    els.viewer().open(it);
  });
  document.addEventListener("published:item-click", e => {
    const it = findItem(e.detail.id);
    if (it) els.viewer().open(it);
  });
  // Toggle "Esconder" da secção Publicados (mesmo padrão do calendário).
  const pubBtn = document.getElementById("publishedToggle");
  const pubSection = document.getElementById("publishedSection");
  if (pubBtn && pubSection) {
    pubBtn.addEventListener("click", () => {
      const isHidden = pubSection.classList.toggle("is-collapsed");
      const grid = document.getElementById("publishedGrid");
      if (grid) grid.style.display = isHidden ? "none" : "";
      pubBtn.textContent = isHidden ? "Mostrar" : "Esconder";
      pubBtn.setAttribute("aria-expanded", String(!isHidden));
    });
  }
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
  let approved = 0, rejected = 0, published = 0;
  for (const it of items) {
    // items.json status tem prioridade para "published"
    const s = it.status === "published"
      ? "published"
      : approvalStore.get(it.id)?.status;
    if (s === "published") published++;
    else if (s === "approved") approved++;
    else if (s === "rejected") rejected++;
  }
  const pending = items.length - approved - rejected - published;
  els.approvedCount().textContent = String(approved);
  els.rejectedCount().textContent = String(rejected);
  els.pendingCount().textContent  = String(pending);
  // Sincronizar chips do header (mesma fonte de verdade)
  const hA = document.getElementById("headerApprovedCount");
  const hR = document.getElementById("headerRejectedCount");
  const hP = document.getElementById("headerPendingCount");
  if (hA) hA.textContent = String(approved);
  if (hR) hR.textContent = String(rejected);
  if (hP) {
    hP.textContent = String(pending);
    const chip = hP.closest(".header-progress__chip");
    if (chip) chip.dataset.hasPending = pending > 0 ? "true" : "false";
  }
  // Hero action banner — banner CTA proeminente no topo
  updateHeroAction(approved, rejected, pending);
}

// Banner CTA proeminente que diz "tens X pendentes" + botao para abrir
// o proximo. Esconde-se quando pending === 0 (passa a "tudo revisto").
function updateHeroAction(approved, rejected, pending) {
  const hero = document.getElementById("heroAction");
  if (!hero) return;
  const count = document.getElementById("heroActionCount");
  const label = document.getElementById("heroActionLabel");
  const fill  = document.getElementById("heroActionBarFill");
  const total = approved + rejected + pending;
  const reviewed = approved + rejected;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 100;
  if (pending > 0) {
    hero.removeAttribute("hidden");
    hero.removeAttribute("data-state");
    if (count) count.textContent = String(pending);
    if (label) label.textContent = pending === 1 ? "item por rever" : "items por rever";
    if (fill)  fill.style.width = pct + "%";
  } else if (total > 0) {
    hero.removeAttribute("hidden");
    hero.setAttribute("data-state", "done");
    if (count) count.textContent = String(approved);
    if (label) label.textContent = approved === 1 ? "item revisto — tudo pronto" : "items revistos — tudo pronto";
    if (fill)  fill.style.width = "100%";
  } else {
    hero.setAttribute("hidden", "");
  }
}

// ── PUBLISHED SECTION ──
// Publicados aparecem na galeria principal (filtrados por mês).
// Não há secção separada.

// Abre o 1o item pendente no viewer (CTA do hero-action banner).
// Procura por items que NAO estao em status approved/rejected. Items
// sem entrada no cache contam como pending (default).
function openNextPending() {
  const items = visibleItems();
  const next = items.find(it => {
    const s = it.status === "published" ? "published" : approvalStore.get(it.id)?.status;
    return s !== "approved" && s !== "rejected" && s !== "published";
  });
  if (!next) return;
  const viewer = document.querySelector("item-viewer");
  if (viewer && typeof viewer.open === "function") viewer.open(next);
}

// Toggle do calendario — colapsa/expande para libertar foco para as
// listas abaixo. Estado persiste em localStorage.
function initCalendarToggle() {
  const btn = document.getElementById("calendarToggle");
  const section = document.getElementById("calendarSection");
  if (!btn || !section) return;
  const STORAGE_KEY = "pf-calendar-collapsed";
  const apply = (collapsed) => {
    section.classList.toggle("section--collapsed", collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.textContent = collapsed ? "Mostrar" : "Esconder";
  };
  let initial = false;
  try { initial = localStorage.getItem(STORAGE_KEY) === "1"; } catch {}
  apply(initial);
  btn.addEventListener("click", () => {
    const now = !section.classList.contains("section--collapsed");
    apply(now);
    try { localStorage.setItem(STORAGE_KEY, now ? "1" : "0"); } catch {}
  });
}

function manageLoader() {
  const loader = document.getElementById("loader");
  const fill   = document.getElementById("loaderFill");
  const hint   = document.getElementById("loaderHint");
  const label  = document.querySelector(".loader__label-text") || document.querySelector(".loader__label");
  if (!loader) return;

  let hidden = false;
  const hide = () => {
    if (hidden) return;
    hidden = true;
    if (fill) fill.style.transform = "scaleX(1)";
    if (hint) hint.textContent = "";
    if (label) label.textContent = "Pronto.";
    loader.setAttribute("aria-hidden", "true");
    setTimeout(() => { loader.style.display = "none"; }, 250);
  };

  // Como já não há iframes pesados nos tiles (substituídos por <img> com
  // loading="lazy"), o render é síncrono. Não bloquear em fonts.ready
  // (Safari pode demorar/penurar). Mostrar progresso curto e esconder.
  const imgs = Array.from(document.querySelectorAll(".slide-thumb__img, .tile__img"))
    .filter(img => {
      try {
        const r = img.getBoundingClientRect();
        return r.top < window.innerHeight + 400;
      } catch { return false; }
    });
  const total = imgs.length;
  let done = 0;

  const tick = () => {
    done += 1;
    const pct = total === 0 ? 1 : Math.min(1, done / total);
    if (fill) fill.style.transform = `scaleX(${pct})`;
    if (hint) hint.textContent = `${done} / ${total}`;
    if (done >= total) hide();
  };

  if (total === 0) {
    // Nada visível para esperar — esconder no próximo frame.
    requestAnimationFrame(() => requestAnimationFrame(hide));
    return;
  }

  if (hint) hint.textContent = `0 / ${total}`;
  imgs.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) {
      tick();
    } else {
      img.addEventListener("load", tick, { once: true });
      img.addEventListener("error", tick, { once: true });
    }
  });

  // Safety: hide em 2.5s mesmo que algum load não dispare.
  setTimeout(hide, 2500);
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

// Helper: race a promise with a timeout. Resolve com `fallback` se o timeout
// disparar antes (não rejeita — para o init não morrer).
function withTimeout(promise, ms, fallback, label) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[init] timeout ${ms}ms em "${label}", a continuar com fallback`);
      resolve(fallback);
    }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).then((v) => { clearTimeout(timer); return v; }),
    timeout,
  ]).catch((err) => {
    clearTimeout(timer);
    console.warn(`[init] erro em "${label}":`, err?.message || err);
    return fallback;
  });
}

async function init() {
  // Dashboard link no header — visível se config.js definir DASHBOARD_URL.
  const dashLink = document.getElementById("dashboardLink");
  if (dashLink && DASHBOARD_URL) {
    dashLink.href = DASHBOARD_URL;
    dashLink.hidden = false;
  }

  // Carregar items.json e Supabase em paralelo. Esperamos por ambos antes
  // de render() para que os stamps (aprovado/rejeitado) apareçam logo.
  // Timeouts generosos: se Supabase pendurar (ETP/extensão), continua-se
  // em modo localStorage; mas se carregar normalmente, persiste tudo.
  const itemsP = withTimeout(loadItems(), 8000, [], "loadItems");
  const supabaseP = withTimeout(
    (async () => {
      await ensureAuthenticated();
      await initApprovalStore();
    })(),
    6000,
    null,
    "supabase+approvals"
  );

  state.items = await itemsP;
  // Primeiro paint só com items.json — esperar também pela cadeia Supabase
  // (sessão + aprovações, 1.5–6s) segurava o loader. Os stamps hidratam
  // quando o Supabase chegar: re-aplicar overrides e re-renderizar por cima.
  supabaseP.then(() => {
    applyDateOverrides();
    applyHourOverrides();
    render();
    updateCounts();
  });
  applyDateOverrides();
  applyHourOverrides();
  bindOpen();
  initCalendarToggle();
  const heroCta = document.getElementById("heroActionCta");
  if (heroCta) heroCta.addEventListener("click", openNextPending);
  window.addEventListener("approval:changed", () => {
    updateCounts();
    applyDateOverrides();
    applyHourOverrides();
    render();
  });

  // Auto-refresh silencioso quando items.json / captions.json mudam no servidor
  // (sem bump de APP_VERSION). O polling vive em data-loader.js e dispara este
  // CustomEvent. Substituímos os items afectados em state.items e re-renderizamos.
  // Skip se o user está a editar texto — adiamos para o próximo ciclo (não
  // queremos perder/interromper escrita em curso).
  let _pendingContentRefresh = null;
  function applyContentRefresh(detail) {
    if (!detail || !Array.isArray(detail.items)) return;
    const incomingById = new Map(detail.items.map((it) => [it.id, it]));
    // Preservar overrides locais que main.js aplicou (datas/horas reagendadas
    // via item-viewer) — não queremos perdê-los só porque o server reabriu o
    // mesmo ficheiro. As overrides voltam a ser aplicadas no fim.
    const next = state.items.map((old) => {
      const incoming = incomingById.get(old.id);
      return incoming ? incoming : old;
    });
    // Items novos que não existiam em state.items
    for (const it of detail.items) {
      if (!state.items.some((s) => s.id === it.id)) next.push(it);
    }
    state.items = next;
    applyDateOverrides();
    applyHourOverrides();
    render();
  }
  window.addEventListener("content:changed", (e) => {
    const detail = e.detail || {};
    if (userIsEditing()) {
      // Guarda o último update; aplica quando o user largar o foco.
      _pendingContentRefresh = detail;
      return;
    }
    applyContentRefresh(detail);
  });
  document.addEventListener("focusout", () => {
    // Esperar um tick para o focusin do próximo elemento entrar — se o user
    // saltou para outro campo não devemos puxar o tapete a meio.
    setTimeout(() => {
      if (!_pendingContentRefresh) return;
      if (userIsEditing()) return;
      const d = _pendingContentRefresh;
      _pendingContentRefresh = null;
      applyContentRefresh(d);
    }, 60);
  });
  // Arrancar o polling depois de termos um snapshot inicial.
  startContentPolling();

  // Reagendamento manual via item-viewer: muta state.items e re-renderiza
  // tudo (galerias incluídas) para que o chip do calendário e a label da
  // tile mostrem a nova data imediatamente.
  document.addEventListener("item:date-changed", (e) => {
    const { id, date } = e.detail || {};
    if (!id || !date) return;
    const it = state.items.find(i => i.id === id);
    if (!it) return;
    it.scheduled_for = date;
    // inferMonth prefere item.month sobre scheduled_for — sincronizar aqui
    // para que mudar de mês mova o item para o calendário correcto.
    if (date.length >= 7) it.month = date.slice(0, 7);
    render();
  });

  document.addEventListener("item:hour-changed", (e) => {
    const { id, hour } = e.detail || {};
    if (!id || !hour) return;
    const it = state.items.find(i => i.id === id);
    if (!it) return;
    it.hour = hour;
    render();
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

  // Refresh/abertura começa sempre no calendário: desligamos o restauro de
  // scroll do browser e ancoramos na secção do calendário após o 1º render.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.getElementById("calendarSection")?.scrollIntoView({ block: "start" });
  }));
}

// Safety global: se init() pendurar ou throw (ex.: Supabase bloqueado por
// extensão/firewall em Safari), o loader esconde-se ao fim de 6s para o
// utilizador ver pelo menos algum estado em vez de "0/0" indefinidamente.
// Se nessa altura ainda não houver galleries renderizados, tenta carregar
// items.json directamente e dar render fallback.
function forceHideLoader(reason) {
  const loader = document.getElementById("loader");
  if (loader && loader.getAttribute("aria-hidden") !== "true") {
    console.warn("[loader] force-hide:", reason);
    const label = document.querySelector(".loader__label-text");
    if (label) label.textContent = "Pronto.";
    loader.setAttribute("aria-hidden", "true");
    setTimeout(() => { loader.style.display = "none"; }, 250);
  }
  // Fallback: se o init pendurou e não há galleries renderizadas, força
  // um carregamento mínimo só com items.json + render.
  const main = document.getElementById("main");
  const hasGalleries = main && main.querySelector("post-tile, carrossel-row, reel-tile");
  if (!hasGalleries && reason !== "manual") {
    console.warn("[loader] render fallback: a tentar render sem Supabase");
    (async () => {
      try {
        if (!state.items || state.items.length === 0) {
          state.items = await loadItems();
        }
        if (!state.currentMonth) {
          state.currentMonth = readUrlState().month || todayYYYYMM();
          state.currentBrand = "all";
          state.currentFormat = "all";
        }
        render();
      } catch (e) {
        console.error("[loader] render fallback falhou:", e);
      }
    })();
  }
}
setTimeout(() => forceHideLoader("safety-6s"), 6000);

// Escapar HTML para atributos (títulos de iframes, etc.)
function _escapeForHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&nbsp;/g, " ")
    .replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

init().catch((err) => {
  console.error("[init] failed:", err);
  forceHideLoader("init-error");
});
