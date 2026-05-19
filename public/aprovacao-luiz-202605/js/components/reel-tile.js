// <reel-tile> — text-only script card. Sem iframe, sem imagens/vídeos.
// Mostra título, role markers e o texto que vai ser dito/escrito no reel.

import { approvalStore } from "../stores/approval-store.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };

const ROLE_LABELS = {
  hook: "Hook",
  demo: "Desenvolvimento",
  proof: "Prova",
  development: "Desenvolvimento",
  cta: "CTA",
  outro: "Fecho",
  intro: "Intro",
};

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

class ReelTile extends HTMLElement {
  setItem(item) {
    this._item = item;
    this.render();
    this._mountStamp();
    window.addEventListener("approval:changed", this._onApprovalChange);
  }
  disconnectedCallback() {
    window.removeEventListener("approval:changed", this._onApprovalChange);
  }
  _onApprovalChange = () => this._mountStamp();
  _mountStamp() {
    if (!this._item) return;
    const article = this.querySelector(".tile");
    if (!article) return;
    const state = approvalStore.get(this._item.id);
    let stamp = article.querySelector(":scope > .status-stamp");
    if (state.status === "pending") {
      if (stamp) stamp.remove();
      article.removeAttribute("data-status");
      return;
    }
    article.setAttribute("data-status", state.status);
    const label = state.status === "approved" ? "Aprovado" : "Rejeitado";
    const tooltip = state.author ? `${label} por ${state.author}` : label;
    if (stamp) {
      stamp.textContent = label;
      stamp.className = `status-stamp status-stamp--${state.status}`;
      stamp.title = tooltip;
    } else {
      stamp = document.createElement("span");
      stamp.className = `status-stamp status-stamp--${state.status}`;
      stamp.textContent = label;
      stamp.title = tooltip;
      article.prepend(stamp);
    }
  }
  render() {
    const it = this._item;
    if (!it) return;
    const duration = it.slides || 15;
    const brandLabel = (BRAND_LABELS[it.brand] || it.brand).toUpperCase();
    const slides = Array.isArray(it.slides_text) ? it.slides_text : [];

    const linesHtml = slides.map((s, i) => {
      const role = s.role || "";
      const roleLabel = ROLE_LABELS[role] || role.toUpperCase();
      const text = s.text_overlay || s.text || "";
      return `
        <div class="reel-tile__line">
          <div class="reel-tile__line-head">
            <span class="reel-tile__line-num">${String(i + 1).padStart(2, "0")}</span>
            ${roleLabel ? `<span class="reel-tile__line-role">${escapeHtml(roleLabel)}</span>` : ""}
          </div>
          <p class="reel-tile__line-text">${escapeHtml(text)}</p>
        </div>
      `;
    }).join("");

    this.innerHTML = `
      <article class="tile tile--reel tile--reel-text" data-item-id="${it.id}">
        <header class="reel-tile__head">
          <span class="tile__label">Reel ${duration}s · ${brandLabel}</span>
          <h3 class="reel-tile__title">${escapeHtml(it.title || it.theme || "")}</h3>
        </header>
        <div class="reel-tile__script">
          ${linesHtml || `<p class="reel-tile__empty">Sem script.</p>`}
        </div>
        <div class="tile__caption reel-tile__foot">
          <span>${escapeHtml(it.scheduled_for || "")} · ${escapeHtml(it.hour || "")} · script para gravação</span>
        </div>
      </article>
    `;

    this.querySelector(".tile").addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
    });
  }
}

customElements.define("reel-tile", ReelTile);
