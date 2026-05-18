// <carrossel-row> — full-width row showing one carousel with all 6 slides side-by-side.
// Stays mounted; approve/reject only toggles the status stamp so the iframes never reload.

import { approvalStore } from "../stores/approval-store.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };

class CarrosselRow extends HTMLElement {
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
    const state = approvalStore.get(this._item.id);
    const article = this.querySelector(".carrossel-row");
    if (!article) return;
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

    this.innerHTML = `
      <article class="carrossel-row" data-item-id="${it.id}">
        <div class="carrossel-row__meta">
          <span class="carrossel-row__brand">${BRAND_LABELS[it.brand] || it.brand}</span>
          <h3 class="carrossel-row__title">${it.title || it.theme}</h3>
          <div class="carrossel-row__tags">
            ${it.pilar ? `<span class="tag">${it.pilar}</span>` : ""}
            ${it.audience ? `<span class="tag tag--solid">${it.audience.toUpperCase()}</span>` : ""}
            <span class="tag tag--accent">${it.slides} slides</span>
          </div>
          <div class="carrossel-row__schedule">
            ${it.scheduled_for || ""} · ${it.hour || ""}
          </div>
        </div>
        <div class="slide-strip">
          ${Array.from({ length: it.slides || 6 }).map((_, i) => {
            const shotBase = (it.html_url || "").replace(/\.html$/, "");
            const shotJpg = `${shotBase}_shots/slide_${String(i + 1).padStart(2, "0")}.jpg`;
            return `
              <div class="slide-thumb slide-thumb--img" data-slide-index="${i}">
                <img class="slide-thumb__img" loading="lazy" decoding="async" src="${shotJpg}" alt="Slide ${i + 1}" />
                <span class="slide-thumb__num">${String(i + 1).padStart(2, "0")} / ${it.slides}</span>
              </div>
            `;
          }).join("")}
        </div>
        <div class="carrossel-row__actions">
          <button class="btn btn--ghost" data-action="open">Ver detalhe</button>
          <button class="btn btn--ghost" data-action="download" title="Descarregar slides em PNG">⤓ Descarregar</button>
          <button class="btn btn--approve" data-action="approve">Aprovar</button>
          <button class="btn btn--reject" data-action="reject">Rejeitar</button>
        </div>
      </article>
    `;

    this.querySelector(".carrossel-row").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) {
        if (e.target.closest(".slide-thumb") || e.target.closest(".carrossel-row__meta")) {
          this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
        }
        return;
      }
      const action = btn.dataset.action;
      if (action === "open") {
        this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
      } else if (action === "download") {
        // Single ZIP with all 6 PNGs at native 2160×2700 — avoids browser
        // multi-download blocking and ensures the client gets the full set.
        const zipUrl = (it.html_url || "").replace(/\.html$/, ".zip");
        const a = document.createElement("a");
        a.href = zipUrl;
        a.download = `${it.id}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (action === "approve" || action === "reject") {
        const desired = action === "approve" ? "approved" : "rejected";
        const current = approvalStore.get(it.id).status;
        approvalStore.set(it.id, current === desired ? "pending" : desired, "");
      }
    });

  }
}

customElements.define("carrossel-row", CarrosselRow);
