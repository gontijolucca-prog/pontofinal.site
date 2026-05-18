// <post-tile> — single 9:16 tile representing a "post" (Instagram story).
// Stays mounted across approve/reject; only the status stamp is toggled.

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

    const pngUrl = (it.html_url || "").replace(/\.html$/, ".png");

    this.innerHTML = `
      <article class="tile" data-item-id="${it.id}">
        <span class="tile__label">Story · ${BRAND_LABELS[it.brand]?.toUpperCase() || it.brand}</span>
        <iframe data-src="${it.html_url}" loading="lazy" tabindex="-1" onload="this.classList.add('is-loaded')"></iframe>
        <a class="tile__download" href="${pngUrl}" download="${it.id}.png" title="Descarregar PNG 1080×1920" aria-label="Descarregar story">⤓</a>
        <div class="tile__caption">
          <strong>${it.title || it.theme}</strong>
          <span>${it.scheduled_for || ""} · ${it.hour || ""}</span>
        </div>
      </article>
    `;

    this.querySelector(".tile").addEventListener("click", (e) => {
      if (e.target.closest(".tile__download")) return;
      this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
    });

    this._observeLazy();
  }

  _observeLazy() {
    const iframe = this.querySelector("iframe[data-src]");
    if (!iframe) return;
    if (!("IntersectionObserver" in window)) {
      iframe.src = iframe.dataset.src;
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          iframe.src = iframe.dataset.src;
          obs.unobserve(iframe);
        }
      }
    }, { rootMargin: "200px" });
    io.observe(iframe);
  }
}

customElements.define("post-tile", PostTile);
