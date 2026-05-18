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
    const duration = it.slides || 15;
    const isGuide = it.kind === "shoot_guide";
    const isVideo = it.kind === "video";
    const kindClass = isGuide ? "tile--guide" : (isVideo ? "tile--video" : "");
    const kindLabel = isGuide ? `Guia ${duration}s`
                    : isVideo ? `Vídeo ${duration}s`
                    : `Reel ${duration}s`;
    const kindDesc  = isGuide ? "guia de gravação"
                    : isVideo ? "vídeo aprovado · pronto a publicar"
                    : "motion graphics";

    this.innerHTML = `
      <article class="tile tile--reel ${kindClass}" data-item-id="${it.id}">
        <span class="tile__label">${kindLabel} · ${BRAND_LABELS[it.brand]?.toUpperCase() || it.brand}</span>
        <iframe data-src="${it.html_url}" loading="lazy" tabindex="-1" onload="this.classList.add('is-loaded')"></iframe>
        <div class="tile__caption">
          <strong>${it.title || it.theme}</strong>
          <span>${it.scheduled_for || ""} · ${it.hour || ""} · ${duration}s · ${kindDesc}</span>
        </div>
      </article>
    `;

    this.querySelector(".tile").addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
    });

    this._observeLazy();
  }

  _observeLazy() {
    const iframe = this.querySelector("iframe[data-src]");
    if (!iframe) return;
    if (!("IntersectionObserver" in window)) { iframe.src = iframe.dataset.src; return; }
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (e.isIntersecting) { iframe.src = iframe.dataset.src; obs.unobserve(iframe); }
      }
    }, { rootMargin: "200px" });
    io.observe(iframe);
  }
}

customElements.define("reel-tile", ReelTile);
