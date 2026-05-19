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
    const tooltipText = state.author ? `${label} por ${state.author}` : "";
    if (!stamp) {
      stamp = document.createElement("span");
      article.prepend(stamp);
      stamp.addEventListener("click", (e) => {
        e.stopPropagation();
        stamp.classList.toggle("is-tapped");
        setTimeout(() => stamp.classList.remove("is-tapped"), 2400);
      });
    }
    stamp.textContent = label;
    stamp.className = `status-stamp status-stamp--${state.status}`;
    if (tooltipText) {
      stamp.setAttribute("data-author", tooltipText);
      stamp.setAttribute("aria-label", tooltipText);
      stamp.setAttribute("tabindex", "0");
    } else {
      stamp.removeAttribute("data-author");
      stamp.removeAttribute("aria-label");
      stamp.removeAttribute("tabindex");
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
          <span class="tile__date-line">
            <label class="inline-date" title="Alterar data de publicação">
              <input type="date" data-edit-date value="${it.scheduled_for || ""}" />
            </label>
            ·
            <label class="inline-date" title="Alterar hora de publicação">
              <input type="time" data-edit-hour value="${it.hour || ""}" />
            </label>
            · script para gravação
          </span>
        </div>
      </article>
    `;

    this.querySelector(".tile").addEventListener("click", (e) => {
      if (e.target.closest(".inline-date")) return;
      this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
    });

    const dateInput = this.querySelector("input[data-edit-date]");
    if (dateInput) {
      dateInput.addEventListener("click", e => e.stopPropagation());
      dateInput.addEventListener("change", async (e) => {
        e.stopPropagation();
        const newDate = e.target.value;
        if (!newDate || newDate === it.scheduled_for) return;
        const oldDate = it.scheduled_for;
        it.scheduled_for = newDate;
        try {
          await approvalStore.setDate(it.id, newDate);
        } catch (err) {
          console.error("[reel-tile] setDate failed:", err);
          it.scheduled_for = oldDate;
          e.target.value = oldDate || "";
          return;
        }
        this.dispatchEvent(new CustomEvent("item:date-changed", {
          bubbles: true,
          detail: { id: it.id, date: newDate, oldDate },
        }));
      });
    }
    const hourInput = this.querySelector("input[data-edit-hour]");
    if (hourInput) {
      hourInput.addEventListener("click", e => e.stopPropagation());
      hourInput.addEventListener("change", async (e) => {
        e.stopPropagation();
        const newHour = e.target.value;
        if (!newHour || newHour === it.hour) return;
        const oldHour = it.hour;
        it.hour = newHour;
        try {
          await approvalStore.setHour(it.id, newHour);
        } catch (err) {
          console.error("[reel-tile] setHour failed:", err);
          it.hour = oldHour;
          e.target.value = oldHour || "";
          return;
        }
        this.dispatchEvent(new CustomEvent("item:hour-changed", {
          bubbles: true,
          detail: { id: it.id, hour: newHour, oldHour },
        }));
      });
    }
  }
}

customElements.define("reel-tile", ReelTile);
