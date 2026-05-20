// <post-tile> — single 9:16 tile representing a "post" (Instagram story).
// Usa <img> em vez de iframe — muito mais rápido. Iframe só na vista detalhada.

import { approvalStore } from "../stores/approval-store.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };

class PostTile extends HTMLElement {
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

    const base = (it.html_url || "").replace(/\.html$/, "");
    const pngUrl = `${base}.png`;
    const jpgUrl = `${base}.jpg`;

    this.innerHTML = `
      <article class="tile tile--img" data-item-id="${it.id}">
        <span class="tile__label">Story · ${BRAND_LABELS[it.brand]?.toUpperCase() || it.brand}</span>
        <img class="tile__img" loading="lazy" decoding="async" src="${pngUrl}" alt="${(it.title || it.theme || "").replace(/"/g, "&quot;")}" onerror="this.onerror=null;this.src='${jpgUrl}'" />
        <a class="tile__download" href="${pngUrl}" download="${it.id}.png" title="Descarregar PNG 1080×1920" aria-label="Descarregar story">⤓</a>
        <div class="tile__caption">
          <strong>${it.title || it.theme}</strong>
          <span class="tile__date-line">
            <label class="inline-date" title="Alterar data de publicação">
              <input type="date" data-edit-date value="${it.scheduled_for || ""}" />
            </label>
            ·
            <label class="inline-date" title="Alterar hora de publicação">
              <input type="time" data-edit-hour value="${it.hour || ""}" />
            </label>
          </span>
        </div>
      </article>
    `;

    this.querySelector(".tile").addEventListener("click", (e) => {
      if (e.target.closest(".tile__download")) return;
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
          console.error("[post-tile] setDate failed:", err);
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
          console.error("[post-tile] setHour failed:", err);
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

customElements.define("post-tile", PostTile);
