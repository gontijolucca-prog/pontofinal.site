// pub-queue.js — Fila de Publicação Real com PNGs que vão para o Instagram.
//
// Mostra no fundo da página de aprovação os items aprovados + agendados,
// com os PNGs REAIS (não HTML iframes). Isto é a fonte da verdade do que
// vai sair no Instagram.
//
// Estados: approved → pending_render → render_done → published
// Polling de 5s ao Supabase para manter-se atualizado.

import { SUPABASE_URL, SUPABASE_ANON_KEY, NAMESPACE, APP_VERSION, BRANDS_FILTER } from "../config.js";
import { approvalStore } from "../stores/approval-store.js";

const POLL_INTERVAL = 5000;
let _pollTimer = null;
let _container = null;
let _brandFilter = "all"; // filtro de marca activo

// ... ( resto acima inalterado )

export function setBrandFilter(brand) {
  _brandFilter = brand;
  // Re-render com o filtro activo — precisa dos items atuais
  // Vai buscar via o evento content:changed ou via os items guardados
  if (_currentItems) renderQueue(_currentItems);
}

let _currentItems = [];

// Dimensões esperadas por formato
const EXPECTED_DIMS = {
  carrossel: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  reel: { w: 1080, h: 1920 },
};

const BRAND_LABELS = {
  techbody: "TechBody",
  techbody_u: "TechBody U",
  luiz_santana: "Luiz Santana",
};

const MONTH_LABELS = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d} ${MONTH_LABELS[m] || m} ${y}`;
}

function fmtTime(hourStr) {
  if (!hourStr) return "12h00";
  return hourStr.replace(/h$/, "h00").replace(/(\d+)h(\d+)/, "$1h$2").replace(/(\d+):(\d+)/, "$1h$2");
}

// Constrói URL do PNG para um item
function pngUrl(item, slide = 1) {
  const base = (item.html_url || "").replace(/^\.\.\//, "").replace(/\.html$/, "");
  if (item.format === "carrossel") {
    const parts = base.split("/");
    const slug = parts.pop();
    return `/${parts.join("/")}/${slug}_shots/slide_${String(slide).padStart(2, "0")}.png?v=${APP_VERSION}`;
  }
  return `/${base}.png?v=${APP_VERSION}`;
}

// Constrói URL do JPG (preview leve)
function jpgUrl(item, slide = 1) {
  return pngUrl(item, slide).replace(".png", ".jpg");
}

function effectiveStatus(item) {
  if (item.status === "published") return "published";
  const ap = approvalStore.get(item.id);
  return ap?.status || "pending";
}

function effectiveDate(item) {
  const ov = approvalStore.getDate?.(item.id);
  return ov?.date || item.scheduled_for;
}

function effectiveHour(item) {
  const ov = approvalStore.getHour?.(item.id);
  return ov?.hour || item.hour;
}

// Verifica se item está "due" (data/hora já passou)
function isDue(item) {
  const date = effectiveDate(item);
  const hour = effectiveHour(item);
  if (!date) return false;
  const [h, m] = (hour || "12h00").replace("h", ":").replace(/^(\d+):?(\d*)/, (_, h, m) => `${h}:${m || "00"}`).split(":").map(Number);
  const when = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  return when <= new Date();
}

function isApproved(item) {
  return effectiveStatus(item) === "approved";
}

function isPublished(item) {
  return effectiveStatus(item) === "published";
}

function renderQueueItem(item) {
  const status = effectiveStatus(item);
  const date = effectiveDate(item);
  const hour = effectiveHour(item);
  const due = isDue(item);
  const brand = BRAND_LABELS[item.brand] || item.brand;
  const fmtLabel = item.format === "carrossel" ? "Carrossel" : item.format === "reel" ? "Reel" : "Story";
  const nSlides = item.slides || (item.format === "carrossel" ? 6 : 1);

  // Estado visual
  let stateIcon = "⏳";
  let stateLabel = "Pendente";
  let stateClass = "pq-pending";

  if (isPublished(item)) {
    stateIcon = "✅";
    stateLabel = "Publicado";
    stateClass = "pq-published";
  } else if (status === "approved") {
    // Nada está realmente agendado (cron off + kill switch) — todos são "prontos sem data"
    stateIcon = "📤";
    stateLabel = "Pronto sem data";
    stateClass = "pq-ready";
  } else if (status === "rejected") {
    stateIcon = "❌";
    stateLabel = "Rejeitado";
    stateClass = "pq-rejected";
  }

  // Thumbnail: primeiro slide do carrossel ou único PNG
  const thumb = jpgUrl(item, 1);

  // Para carrosséis: mostrar contagem de slides
  const slidesInfo = item.format === "carrossel" ? `${nSlides} slides` : "";

  const card = document.createElement("div");
  card.className = `pq-card ${stateClass}`;
  card.setAttribute("data-item-id", item.id);
  card.innerHTML = `
    <div class="pq-card__thumb">
      <img src="${thumb}" alt="${item.title || item.theme || item.id}"
           loading="lazy" decoding="async"
           onerror="this.onerror=null;this.src='${pngUrl(item, 1)}'" />
      <span class="pq-card__badge">${stateIcon}</span>
    </div>
    <div class="pq-card__info">
      <div class="pq-card__header">
        <span class="pq-card__brand">${brand}</span>
        <span class="pq-card__fmt">${fmtLabel}</span>
      </div>
      <div class="pq-card__title">${item.title || item.theme || item.id}</div>
      <div class="pq-card__schedule">
        <span class="pq-card__date">📅 ${fmtDate(date)}</span>
        <span class="pq-card__time">🕐 ${fmtTime(hour)}</span>
        ${slidesInfo ? `<span class="pq-card__slides">${slidesInfo}</span>` : ""}
      </div>
      <div class="pq-card__state">${stateIcon} ${stateLabel}</div>
    </div>
  `;

  // Click: abrir no viewer
  card.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("item:open", { detail: { id: item.id } }));
  });

  return card;
}

function renderQueue(items) {
  if (!_container) return;
  _currentItems = items;

  const queueItems = items.filter(it => {
    const s = effectiveStatus(it);
    if (s !== "approved" && s !== "published") return false;
    // Aplicar filtro de marca
    if (_brandFilter !== "all" && it.brand !== _brandFilter) return false;
    // Filtrar items que não pertencem a esta página
    if (BRANDS_FILTER && BRANDS_FILTER.length && !BRANDS_FILTER.includes(it.brand)) return false;
    return true;
  });

  // Ordenar: por data agendada (mais próxima primeiro)
  queueItems.sort((a, b) => {
    const da = effectiveDate(a) || "9999";
    const db = effectiveDate(b) || "9999";
    return da.localeCompare(db);
  });

  const grid = _container.querySelector(".pq-grid");
  const countEl = _container.querySelector(".pq-count");

  if (countEl) countEl.textContent = queueItems.length;

  if (!grid) return;

  if (queueItems.length === 0) {
    grid.innerHTML = `
      <div class="pq-empty-state">
        <div class="pq-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" stroke-width="2"/>
            <path d="M6 18h36" stroke="currentColor" stroke-width="2"/>
            <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
            <circle cx="17" cy="14" r="1.5" fill="currentColor"/>
            <path d="M16 28l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="pq-empty-title">Fila de Publicação</div>
        <div class="pq-empty-desc">Os itens aprovados na Galeria aparecem aqui automaticamente.<br>Aprova um item para o veres nesta fila.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = "";
  for (const item of queueItems) {
    grid.appendChild(renderQueueItem(item));
  }

  // Atualizar contadores no header da secção
  // Nada está realmente agendado (cron off + kill switch) — todos approved são "prontos sem data"
  const ready = queueItems.filter(it => isApproved(it) && !isPublished(it)).length;
  const published = queueItems.filter(it => isPublished(it)).length;

  const hint = _container.querySelector(".pq-hint");
  if (hint) {
    const parts = [];
    if (ready > 0) parts.push(`📤 ${ready} prontos sem data`);
    if (published > 0) parts.push(`✅ ${published} publicados`);
    hint.textContent = parts.join("  ·  ") || "Fila vazia";
  }
}

// CSS para a fila de publicação
const QUEUE_CSS = `
.pq-section {
  margin: 48px 0 32px;
  padding: 0;
  border-top: 4px solid var(--border, #e0e0e0);
}
.pq-section__heading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 0 16px;
  flex-wrap: wrap;
}
.pq-section__heading h2 {
  font: 800 18px/1 'JetBrains Mono', ui-monospace, monospace;
  letter-spacing: -0.02em;
  margin: 0;
}
.pq-section__heading .pq-count {
  font: 700 13px/1 'JetBrains Mono', ui-monospace, monospace;
  background: var(--accent, #f69e1e);
  color: #fff;
  padding: 4px 10px;
  border-radius: 999px;
}
.pq-section__heading .pq-hint {
  font: 400 12px/1.3 'JetBrains Mono', ui-monospace, monospace;
  color: var(--muted, #888);
  margin-left: auto;
}
.pq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding-bottom: 24px;
}
@media (max-width: 480px) {
  .pq-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
}
@media (max-width: 380px) {
  .pq-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
}
.pq-card {
  border: 2px solid var(--border, #e0e0e0);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  background: #fff;
}
.pq-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
.pq-card__thumb {
  position: relative;
  aspect-ratio: 4/5;
  background: #f5f5f5;
  overflow: hidden;
}
.pq-card__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pq-card__badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 20px;
  background: rgba(255,255,255,0.9);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.pq-card__info {
  padding: 10px 12px 12px;
}
.pq-card__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.pq-card__brand {
  font: 700 11px/1 'JetBrains Mono', ui-monospace, monospace;
  color: var(--muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pq-card__fmt {
  font: 600 10px/1 'JetBrains Mono', ui-monospace, monospace;
  color: var(--muted, #aaa);
}
.pq-card__title {
  font: 700 13px/1.3 'JetBrains Mono', ui-monospace, monospace;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pq-card__schedule {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font: 400 10px/1.2 'JetBrains Mono', ui-monospace, monospace;
  color: var(--muted, #888);
  margin-bottom: 4px;
}
.pq-card__state {
  font: 600 10px/1 'JetBrains Mono', ui-monospace, monospace;
  padding-top: 4px;
}
.pq-ready {
  border-color: #2BB05F;
}
.pq-ready .pq-card__state {
  color: #2BB05F;
}
.pq-scheduled {
  border-color: #f69e1e;
}
.pq-scheduled .pq-card__state {
  color: #f69e1e;
}
.pq-published {
  border-color: #ccc;
  opacity: 0.7;
}
.pq-published .pq-card__state {
  color: #888;
}
.pq-rejected {
  border-color: #FF2A2A;
  opacity: 0.5;
}
.pq-rejected .pq-card__state {
  color: #FF2A2A;
}
.pq-empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px 24px;
  text-align: center;
}
.pq-empty-icon {
  color: var(--muted, #999);
  opacity: 0.5;
}
.pq-empty-title {
  font: 800 16px/1 'JetBrains Mono', ui-monospace, monospace;
  color: var(--text, #333);
  letter-spacing: -0.01em;
}
.pq-empty-desc {
  font: 400 13px/1.5 'JetBrains Mono', ui-monospace, monospace;
  color: var(--muted, #888);
  max-width: 360px;
}
`;

function injectCSS() {
  if (document.getElementById("pq-styles")) return;
  const style = document.createElement("style");
  style.id = "pq-styles";
  style.textContent = QUEUE_CSS;
  document.head.appendChild(style);
}

export function initPubQueue(items) {
  injectCSS();

  // Verificar se a secção já existe
  _container = document.getElementById("pubQueueSection");

  if (!_container) {
    // Criar secção no fundo da página, antes do footer
    _container = document.createElement("section");
    _container.id = "pubQueueSection";
    _container.className = "pq-section";
    _container.innerHTML = `
      <div class="pq-section__heading">
        <h2>📤 Fila de Publicação</h2>
        <span class="pq-count">0</span>
        <span class="pq-hint">Próximas publicações — PNGs reais que vão para o Instagram</span>
      </div>
      <div class="pq-grid"></div>
    `;

    const main = document.getElementById("main");
    const footer = document.querySelector(".app-footer");
    if (footer) {
      footer.before(_container);
    } else if (main) {
      main.appendChild(_container);
    } else {
      document.body.appendChild(_container);
    }
  }

  // Renderizar com os items atuais
  renderQueue(items);

  // Re-renderizar quando aprovações mudam
  window.addEventListener("approval:changed", () => {
    renderQueue(items);
  });

  // Re-renderizar quando conteúdo muda
  window.addEventListener("content:changed", (e) => {
    if (e.detail?.items) {
      renderQueue(e.detail.items);
    }
  });

  // Polling de 5s para manter atualizado
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(() => {
    if (!document.hidden) {
      renderQueue(items);
    }
  }, POLL_INTERVAL);
}