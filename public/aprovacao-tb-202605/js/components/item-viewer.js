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
      // Ignorar atalhos se o user estiver a escrever uma nota.
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (e.key === "Escape") return this.close();
      if (e.key === "ArrowRight") return this._step(+1);
      if (e.key === "ArrowLeft")  return this._step(-1);
      if (typing) return;
      // Atalhos action — só fora de inputs.
      const key = e.key.toLowerCase();
      if (key === "a") { e.preventDefault(); this._actAndAdvance("approve"); return; }
      if (key === "r") { e.preventDefault(); this._actAndAdvance("reject");  return; }
      if (key === "j" || e.key === "ArrowDown") { e.preventDefault(); this._advanceItem(+1); return; }
      if (key === "k" || e.key === "ArrowUp")   { e.preventDefault(); this._advanceItem(-1); return; }
    });
  }

  _actAndAdvance(action) {
    if (!this._item) return;
    const note = this.querySelector("textarea[data-note]")?.value || "";
    const desired = action === "approve" ? "approved" : "rejected";
    const current = approvalStore.get(this._item.id).status;
    approvalStore.set(this._item.id, current === desired ? "pending" : desired, note);
    // Avança para o próximo item visível, OU fecha se estava no último.
    if (!this._advanceItem(+1)) this.close();
  }

  _advanceItem(direction) {
    // Pede ao main.js para encontrar o próximo item visível na mesma direcção
    // e abri-lo se existir. Retorna true se conseguiu mover.
    if (!this._item) return false;
    const ev = new CustomEvent("viewer:advance", {
      bubbles: true,
      cancelable: true,
      detail: { currentId: this._item.id, direction, callback: null },
    });
    this.dispatchEvent(ev);
    // main.js terá preenchido callback com o item para abrir, ou null.
    const next = ev.detail.next;
    if (!next) return false;
    this.open(next);
    return true;
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
    const counter = this.querySelector("[data-notes-count]");
    const noteRows = rows.filter(r => r.note);
    if (counter) counter.textContent = noteRows.length > 0 ? `(${noteRows.length})` : "";

    if (!rows.length) {
      wrap.innerHTML = `<p class="viewer-history__empty">Ainda não há anotações guardadas. Escreve uma em baixo e carrega "Guardar anotação".</p>`;
      return;
    }
    const fmt = (iso) => {
      const d = new Date(iso);
      return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    };
    const statusLabel = { approved: "Aprovado", rejected: "Rejeitado", pending: "Anotação", deleted: "Apagado" };
    // Ordem cronológica: mais recente primeiro
    wrap.innerHTML = rows.map(r => `
      <div class="viewer-history__row viewer-history__row--${r.status}">
        <span class="viewer-history__status">${statusLabel[r.status] || r.status}</span>
        <span class="viewer-history__meta">${fmt(r.changed_at)}</span>
        ${r.note ? `<p class="viewer-history__note">${this._escapeForHtml(r.note)}</p>` : ""}
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

  _updateCaptionBadge() {
    if (!this._item) return;
    const captionState = approvalStore.getCaption(this._item.id);
    const wrap = this.querySelector(".viewer-caption");
    if (!wrap) return;
    wrap.setAttribute("data-caption-status", captionState.status);
    const badge = wrap.querySelector(".viewer-caption__badge");
    if (badge) {
      badge.className = `viewer-caption__badge viewer-caption__badge--${captionState.status}`;
      const map = { approved: "Aprovada", rejected: "Rejeitada", pending: "Pendente" };
      badge.textContent = map[captionState.status];
    }
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
    const captionState = approvalStore.getCaption(it.id);
    const isCarousel = it.format === "carrossel" && it.slides > 1;
    const captionLabel = { approved: "Aprovada", rejected: "Rejeitada", pending: "Pendente" };
    const hasCaption = !!(it.caption && it.caption.trim());

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
          <div class="viewer-panel__scroll">
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
            <details class="viewer-section" open>
              <summary>Texto dos slides</summary>
              <div class="viewer-slides">
                ${(it.slides_text || []).map((s, i) => `
                  <div class="viewer-slide">
                    <span class="viewer-slide__num">${String(i + 1).padStart(2, "0")}</span>
                    <p class="viewer-slide__text">${s.text_overlay || s.text || ""}</p>
                  </div>
                `).join("")}
              </div>
            </details>
            ${hasCaption ? `
            <details class="viewer-section viewer-section--caption" data-caption-status="${captionState.status}">
              <summary>
                Descrição Instagram
                <span class="viewer-caption__badge viewer-caption__badge--${captionState.status}">${captionLabel[captionState.status]}</span>
              </summary>
              <div class="viewer-caption">
                <pre class="viewer-caption__text">${this._escapeForHtml(it.caption)}</pre>
                ${it.hashtags ? `<pre class="viewer-caption__hashtags">${this._escapeForHtml(it.hashtags)}</pre>` : ""}
                <div class="viewer-caption__actions">
                  <textarea data-caption-note placeholder="Sugestão para a descrição (opcional)">${this._escapeForHtml(captionState.note || "")}</textarea>
                  <button class="btn btn--ghost btn--small" data-action="caption-save-note">Guardar anotação</button>
                  <span class="viewer-caption__feedback" data-caption-feedback aria-live="polite"></span>
                  <button class="btn btn--reject btn--small" data-action="caption-reject">Rejeitar descrição</button>
                  <button class="btn btn--approve btn--small" data-action="caption-approve">Aprovar descrição</button>
                </div>
              </div>
            </details>
            ` : ""}
            <details class="viewer-section" data-notes-section open>
              <summary>
                Anotações e histórico
                <span class="viewer-section__counter" data-notes-count></span>
              </summary>
              <div class="viewer-history" data-history>
                <p class="viewer-history__empty">A carregar…</p>
              </div>
            </details>
          </div>
          <div class="viewer-actions">
            <textarea data-note placeholder="Sugestão de edição (opcional)">${state.note || ""}</textarea>
            <button class="btn btn--ghost" data-action="save-note">Guardar anotação</button>
            <span class="viewer-actions__feedback" data-feedback aria-live="polite"></span>
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
      if (action === "save-note") {
        const note = this.querySelector("textarea[data-note]")?.value || "";
        approvalStore.saveNote(this._item.id, note);
        const fb = this.querySelector("[data-feedback]");
        if (fb) {
          fb.textContent = "✓ Anotação guardada";
          fb.classList.add("is-visible");
          setTimeout(() => { fb.classList.remove("is-visible"); fb.textContent = ""; }, 2200);
        }
        // Limpar a textarea após guardar para deixar espaço para outra
        const ta = this.querySelector("textarea[data-note]");
        if (ta) ta.value = "";
        // Recarregar histórico (após delay para o INSERT do trigger propagar)
        setTimeout(() => this._loadHistory(), 600);
        // Garantir que o painel das anotações está aberto
        const notesPanel = this.querySelector('details[data-notes-section]');
        if (notesPanel && !notesPanel.open) notesPanel.open = true;
        return;
      }
      if (action === "approve" || action === "reject") {
        const note = this.querySelector("textarea[data-note]")?.value || "";
        const desired = action === "approve" ? "approved" : "rejected";
        const current = approvalStore.get(this._item.id).status;
        approvalStore.set(this._item.id, current === desired ? "pending" : desired, note);
        this.close();
      }
      if (action === "caption-save-note") {
        const note = this.querySelector("textarea[data-caption-note]")?.value || "";
        const current = approvalStore.getCaption(this._item.id);
        approvalStore.setCaption(this._item.id, current.status, note);
        const fb = this.querySelector("[data-caption-feedback]");
        if (fb) {
          fb.textContent = "✓ Guardado";
          fb.classList.add("is-visible");
          setTimeout(() => { fb.classList.remove("is-visible"); fb.textContent = ""; }, 1800);
        }
        return;
      }
      if (action === "caption-approve" || action === "caption-reject") {
        const note = this.querySelector("textarea[data-caption-note]")?.value || "";
        const desired = action === "caption-approve" ? "approved" : "rejected";
        const current = approvalStore.getCaption(this._item.id).status;
        approvalStore.setCaption(this._item.id, current === desired ? "pending" : desired, note);
        this._updateCaptionBadge();
      }
    });
  }
}

customElements.define("item-viewer", ItemViewer);
