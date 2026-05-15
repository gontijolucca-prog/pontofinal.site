// <reel-tile> — 9:16 tile that loads the reel storyboard HTML inside an iframe,
// scaled like the carousel slide thumbs. Stays mounted across approve/reject.

import { approvalStore } from "../stores/approval-store.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };

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
      return;
    }
    const label = state.status === "approved" ? "Aprovado" : "Rejeitado";
    if (stamp) {
      stamp.textContent = label;
      stamp.className = `status-stamp status-stamp--${state.status}`;
    } else {
      stamp = document.createElement("span");
      stamp.className = `status-stamp status-stamp--${state.status}`;
      stamp.textContent = label;
      article.prepend(stamp);
    }
  }
  render() {
    const it = this._item;
    if (!it) return;
    const duration = it.slides || 15;

    this.innerHTML = `
      <article class="tile tile--reel" data-item-id="${it.id}">
        <span class="tile__label">Reel ${duration}s · ${BRAND_LABELS[it.brand]?.toUpperCase() || it.brand}</span>
        <iframe src="${it.html_url}" loading="lazy" tabindex="-1"></iframe>
        <div class="tile__caption">
          <strong>${it.title || it.theme}</strong>
          <span>${it.scheduled_for || ""} · ${it.hour || ""} · ${duration}s</span>
        </div>
      </article>
    `;

    this.querySelector(".tile").addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
    });
  }
}

customElements.define("reel-tile", ReelTile);
