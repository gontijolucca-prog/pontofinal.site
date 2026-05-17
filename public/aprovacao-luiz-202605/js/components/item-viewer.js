// <item-viewer> — modal preview with prev/next arrows for carousels, close button
// outside the image area, side panel with copy + approval actions.

import { approvalStore } from "../stores/approval-store.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };

class ItemViewer extends HTMLElement {
  connectedCallback() {
    this.classList.add("viewer-backdrop");
    this._slide = 1;
    this.addEventListener("click", (e) => { if (e.target === this) this.close(); });
    document.addEventListener("keydown", (e) => {
      if (this.getAttribute("data-open") !== "true") return;
      if (e.key === "Escape") this.close();
      if (e.key === "ArrowRight") this._step(+1);
      if (e.key === "ArrowLeft")  this._step(-1);
    });
  }

  open(item) {
    this._item = item;
    this._slide = 1;
    this._history = null;
    this.setAttribute("data-open", "true");
    this.setAttribute("aria-hidden", "false");
    this.render();
    this._loadHistory();
  }

  async _loadHistory() {
    if (!this._item) return;
    const itemId = this._item.id;
    const rows = await approvalStore.history(itemId);
    if (!this._item || this._item.id !== itemId) return; // changed item meanwhile
    this._history = rows;
    this._renderHistory();
  }

  _renderHistory() {
    const wrap = this.querySelector(".viewer-history");
    if (!wrap) return;
    const rows = this._history || [];
    if (!rows.length) {
      wrap.innerHTML = `<p class="viewer-history__empty">Sem histórico ainda.</p>`;
      return;
    }
    const fmt = (iso) => {
      const d = new Date(iso);
      return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    };
    const statusLabel = { approved: "Aprovado", rejected: "Rejeitado", pending: "Pendente", deleted: "Apagado" };
    wrap.innerHTML = rows.map(r => `
      <div class="viewer-history__row viewer-history__row--${r.status}">
        <span class="viewer-history__status">${statusLabel[r.status] || r.status}</span>
        <span class="viewer-history__meta">
          ${this._escapeForHtml(r.changed_by_email || "—")} · ${fmt(r.changed_at)}
        </span>
        ${r.note ? `<p class="viewer-history__note">"${this._escapeForHtml(r.note)}"</p>` : ""}
      </div>
    `).join("");
  }

  _escapeForHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  close() {
    this._item = null;
    this.removeAttribute("data-open");
    this.setAttribute("aria-hidden", "true");
    this.innerHTML = "";
  }

  _step(delta) {
    if (!this._item) return;
    const total = this._item.slides || 1;
    if (total <= 1) return;
    const next = Math.min(total, Math.max(1, this._slide + delta));
    if (next === this._slide) return;
    this._slide = next;
    this._syncIframeHash();
    this._updateCounter();
  }

  _syncIframeHash() {
    const iframe = this.querySelector(".viewer-frame-wrap iframe");
    if (!iframe || !this._item?.html_url) return;
    iframe.src = `${this._item.html_url}#slide-${this._slide}`;
  }

  _updateCounter() {
    const el = this.querySelector(".viewer-counter");
    if (el && this._item) el.textContent = `${this._slide} / ${this._item.slides}`;
    const prev = this.querySelector(".viewer-nav--prev");
    const next = this.querySelector(".viewer-nav--next");
    if (prev) prev.disabled = this._slide <= 1;
    if (next) next.disabled = this._slide >= (this._item?.slides || 1);
  }

  render() {
    const it = this._item;
    if (!it) return;
    const state = approvalStore.get(it.id);
    const isCarousel = it.format === "carrossel" && it.slides > 1;

    const navbarHtml = isCarousel ? `
      <div class="viewer-navbar">
        <button class="viewer-nav viewer-nav--prev" data-action="prev" aria-label="Slide anterior">‹</button>
        <span class="viewer-counter">${this._slide} / ${it.slides}</span>
        <button class="viewer-nav viewer-nav--next" data-action="next" aria-label="Próximo slide">›</button>
      </div>
    ` : "";

    this.innerHTML = `
      <div class="viewer-modal" data-format="${it.format}" role="dialog" aria-modal="true" aria-label="${it.title || it.theme}">
        <div class="viewer-frame-col">
          <div class="viewer-frame-wrap">
            ${it.html_url ? `<iframe src="${it.html_url}${isCarousel ? "#slide-1" : ""}" title="${it.title}"></iframe>` : ``}
          </div>
          ${navbarHtml}
        </div>
        <aside class="viewer-panel">
          <div class="viewer-meta">
            <span class="viewer-brand">${BRAND_LABELS[it.brand] || it.brand}</span>
            <h3 class="viewer-title">${it.title || it.theme}</h3>
            <div class="viewer-tags">
              <span class="tag tag--accent">${it.format}</span>
              ${it.pilar ? `<span class="tag">${it.pilar}</span>` : ""}
              ${it.audience ? `<span class="tag tag--solid">${it.audience.toUpperCase()}</span>` : ""}
              <span class="tag">${it.scheduled_for || ""} ${it.hour || ""}</span>
            </div>
          </div>
          <div class="viewer-slides">
            ${(it.slides_text || []).map((s, i) => `
              <div class="viewer-slide">
                <span class="viewer-slide__num">${String(i + 1).padStart(2, "0")}</span>
                <p class="viewer-slide__text">${s.text_overlay || s.text || ""}</p>
              </div>
            `).join("")}
          </div>
          <details class="viewer-history-block">
            <summary>Histórico de aprovação</summary>
            <div class="viewer-history" data-history>
              <p class="viewer-history__empty">A carregar…</p>
            </div>
          </details>
          <div class="viewer-actions">
            <textarea data-note placeholder="Sugestão de edição (opcional)">${state.note || ""}</textarea>
            <button class="btn btn--reject" data-action="reject">Rejeitar</button>
            <button class="btn btn--approve" data-action="approve">Aprovar</button>
          </div>
        </aside>
        <button class="viewer-close" data-action="close" aria-label="Fechar">×</button>
      </div>
    `;

    this._updateCounter();

    this.querySelector(".viewer-modal").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "close") return this.close();
      if (action === "prev")  return this._step(-1);
      if (action === "next")  return this._step(+1);
      if (action === "approve" || action === "reject") {
        const note = this.querySelector("textarea[data-note]")?.value || "";
        const desired = action === "approve" ? "approved" : "rejected";
        const current = approvalStore.get(this._item.id).status;
        approvalStore.set(this._item.id, current === desired ? "pending" : desired, note);
        this.close();
      }
    });
  }
}

customElements.define("item-viewer", ItemViewer);
