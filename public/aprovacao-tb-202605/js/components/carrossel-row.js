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
            <label class="inline-date" title="Alterar data de publicação">
              <input type="date" data-edit-date value="${it.scheduled_for || ""}" />
            </label>
            ·
            <label class="inline-date" title="Alterar hora de publicação">
              <input type="time" data-edit-hour value="${it.hour || ""}" />
            </label>
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

    // Edição inline da data e hora — não propaga clicks (não abre o detalhe).
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
          console.error("[carrossel-row] setDate failed:", err);
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
          console.error("[carrossel-row] setHour failed:", err);
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

customElements.define("carrossel-row", CarrosselRow);
