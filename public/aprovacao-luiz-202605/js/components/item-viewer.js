// <item-viewer> — modal preview with prev/next arrows for carousels, close button
// outside the image area, side panel with copy + approval actions.

import { approvalStore, init as initApprovalStore } from "../stores/approval-store.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };

class ItemViewer extends HTMLElement {
  connectedCallback() {
    this.classList.add("viewer-backdrop");
    this._slide = 1;
    this._notes = null;
    // Re-renderiza notas e badges quando o cache muda (ex.: realtime do
    // Supabase entregou uma nova anotação de outro device).
    this._onApprovalChange = () => {
      if (!this._item || this.getAttribute("data-open") !== "true") return;
      const fresh = approvalStore.listNotes(this._item.id);
      this._notes = fresh;
      this._renderNotes();
      this._updateCaptionBadge();
    };
    window.addEventListener("approval:changed", this._onApprovalChange);
    this.addEventListener("click", (e) => { if (e.target === this) this.close(); });
    document.addEventListener("keydown", (e) => {
      if (this.getAttribute("data-open") !== "true") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if (e.key === "Escape") return this.close();
      if (e.key === "ArrowRight") return this._step(+1);
      if (e.key === "ArrowLeft")  return this._step(-1);
      if (typing) return;
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
    if (!this._advanceItem(+1)) this.close();
  }

  _advanceItem(direction) {
    if (!this._item) return false;
    const ev = new CustomEvent("viewer:advance", {
      bubbles: true,
      cancelable: true,
      detail: { currentId: this._item.id, direction, callback: null },
    });
    this.dispatchEvent(ev);
    const next = ev.detail.next;
    if (!next) return false;
    this.open(next);
    return true;
  }

  open(item) {
    this._item = item;
    this._slide = 1;
    this._notes = null;
    this.setAttribute("data-open", "true");
    this.setAttribute("aria-hidden", "false");
    this.render();
    this._loadNotes();
  }

  async _loadNotes() {
    if (!this._item) return;
    const itemId = this._item.id;
    await initApprovalStore();
    if (!this._item || this._item.id !== itemId) return;
    this._notes = approvalStore.listNotes(itemId);
    this._renderNotes();
  }

  _renderNotes() {
    const wrap = this.querySelector(".viewer-notes");
    if (!wrap) return;
    const rows = this._notes || [];
    const counter = this.querySelector("[data-notes-count]");
    if (counter) counter.textContent = rows.length > 0 ? `(${rows.length})` : "";

    if (!rows.length) {
      wrap.innerHTML = `<p class="viewer-notes__empty">Ainda não há anotações. Escreve uma em baixo e carrega "Guardar anotação".</p>`;
      return;
    }
    const fmt = (iso) => {
      const d = new Date(iso);
      return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    };
    wrap.innerHTML = rows.map(r => `
      <div class="viewer-note" data-note-key="${this._escapeForHtml(r.key)}">
        <div class="viewer-note__meta">
          ${r.slide ? `<span class="viewer-note__slide">Slide ${String(r.slide).padStart(2, "0")}</span>` : ""}
          <span class="viewer-note__time">${fmt(r.changed_at)}</span>
          ${r.changed_by_email ? `<span class="viewer-note__author">· ${this._escapeForHtml(r.changed_by_email)}</span>` : ""}
          <button type="button" class="viewer-note__delete" data-action="delete-note" data-note-key="${this._escapeForHtml(r.key)}" aria-label="Apagar anotação" title="Apagar anotação">✕</button>
        </div>
        <p class="viewer-note__text">${this._escapeForHtml(r.note)}</p>
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
    this._notes = null;
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
    // Sincronizar dropdown "Slide" da zona de anotação com o slide actual
    const sel = this.querySelector("[data-slide-select]");
    if (sel) sel.value = String(this._slide);
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
    const isReel = it.format === "reel";
    const captionLabel = { approved: "Aprovada", rejected: "Rejeitada", pending: "Pendente" };
    const hasCaption = !!(it.caption && it.caption.trim());

    const navbarHtml = isCarousel ? `
      <div class="viewer-navbar">
        <button class="viewer-nav viewer-nav--prev" data-action="prev" aria-label="Slide anterior">‹</button>
        <span class="viewer-counter">${this._slide} / ${it.slides}</span>
        <button class="viewer-nav viewer-nav--next" data-action="next" aria-label="Próximo slide">›</button>
      </div>
    ` : "";

    const ROLE_LABELS = { hook: "Hook", demo: "Desenvolvimento", proof: "Prova", development: "Desenvolvimento", cta: "CTA", outro: "Fecho", intro: "Intro" };
    const reelScriptHtml = isReel ? `
      <div class="viewer-reel-script">
        <div class="viewer-reel-script__head">
          <span class="viewer-reel-script__badge">Script para gravação</span>
          <span class="viewer-reel-script__duration">Reel ${it.slides || 15}s</span>
        </div>
        <ol class="viewer-reel-script__list">
          ${(it.slides_text || []).map((s, i) => {
            const role = s.role || "";
            const roleLabel = ROLE_LABELS[role] || role.toUpperCase();
            const text = s.text_overlay || s.text || "";
            return `
              <li class="viewer-reel-script__line">
                <div class="viewer-reel-script__line-head">
                  <span class="viewer-reel-script__line-num">${String(i + 1).padStart(2, "0")}</span>
                  ${roleLabel ? `<span class="viewer-reel-script__line-role">${this._escapeForHtml(roleLabel)}</span>` : ""}
                </div>
                <p class="viewer-reel-script__line-text">${this._escapeForHtml(text)}</p>
              </li>
            `;
          }).join("")}
        </ol>
      </div>
    ` : "";

    // Dropdown de slide para o textarea principal (só em carrosseis).
    const slideSelectHtml = isCarousel ? `
      <label class="viewer-actions__slide-label">
        <span>Slide:</span>
        <select data-slide-select aria-label="Slide a que se refere a anotação">
          <option value="0">— Geral (sem slide) —</option>
          ${(it.slides_text || []).map((s, i) => {
            const n = i + 1;
            const preview = (s.text_overlay || s.text || "").slice(0, 40);
            return `<option value="${n}" ${n === this._slide ? "selected" : ""}>${String(n).padStart(2, "0")} — ${this._escapeForHtml(preview)}</option>`;
          }).join("")}
        </select>
      </label>
    ` : "";

    this.innerHTML = `
      <div class="viewer-modal" data-format="${it.format}" role="dialog" aria-modal="true" aria-label="${it.title || it.theme}">
        <div class="viewer-frame-col">
          <div class="viewer-frame-wrap">
            ${isReel
              ? reelScriptHtml
              : (it.html_url ? `<iframe src="${it.html_url}${isCarousel ? "#slide-1" : ""}" title="${it.title}"></iframe>` : ``)}
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
                Anotações
                <span class="viewer-section__counter" data-notes-count></span>
              </summary>
              <div class="viewer-notes" data-notes>
                <p class="viewer-notes__empty">A carregar…</p>
              </div>
            </details>
          </div>
          <div class="viewer-actions">
            ${slideSelectHtml}
            <textarea data-note placeholder="Escreve uma anotação"></textarea>
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

    this.querySelector(".viewer-modal").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "close") return this.close();
      if (action === "prev")  return this._step(-1);
      if (action === "next")  return this._step(+1);
      if (action === "save-note") {
        const ta = this.querySelector("textarea[data-note]");
        const note = (ta?.value || "").trim();
        if (!note) {
          const fb = this.querySelector("[data-feedback]");
          if (fb) {
            fb.textContent = "Escreve algo antes de guardar.";
            fb.classList.add("is-visible");
            setTimeout(() => { fb.classList.remove("is-visible"); fb.textContent = ""; }, 1800);
          }
          return;
        }
        const sel = this.querySelector("[data-slide-select]");
        const slideN = sel ? parseInt(sel.value, 10) || null : null;
        await approvalStore.saveNote(this._item.id, note, slideN ? { slideN } : {});
        if (ta) ta.value = "";
        const fb = this.querySelector("[data-feedback]");
        if (fb) {
          fb.textContent = slideN ? `✓ Anotação guardada (slide ${slideN})` : "✓ Anotação guardada";
          fb.classList.add("is-visible");
          setTimeout(() => { fb.classList.remove("is-visible"); fb.textContent = ""; }, 2200);
        }
        const notesPanel = this.querySelector('details[data-notes-section]');
        if (notesPanel && !notesPanel.open) notesPanel.open = true;
        await this._loadNotes();
        return;
      }
      if (action === "delete-note") {
        const key = btn.dataset.noteKey;
        if (!key) return;
        if (!window.confirm("Apagar esta anotação? Esta acção não pode ser desfeita.")) return;
        const ok = await approvalStore.deleteNote(key);
        if (!ok) {
          window.alert("Não foi possível apagar a anotação. Tenta de novo.");
          return;
        }
        await this._loadNotes();
        return;
      }
      if (action === "approve" || action === "reject") {
        const note = (this.querySelector("textarea[data-note]")?.value || "").trim();
        const desired = action === "approve" ? "approved" : "rejected";
        const current = approvalStore.get(this._item.id).status;
        await approvalStore.set(this._item.id, current === desired ? "pending" : desired, note);
        this.close();
      }
      if (action === "caption-save-note") {
        const note = (this.querySelector("textarea[data-caption-note]")?.value || "").trim();
        const current = approvalStore.getCaption(this._item.id);
        await approvalStore.setCaption(this._item.id, current.status, note);
        const fb = this.querySelector("[data-caption-feedback]");
        if (fb) {
          fb.textContent = "✓ Guardado";
          fb.classList.add("is-visible");
          setTimeout(() => { fb.classList.remove("is-visible"); fb.textContent = ""; }, 1800);
        }
        await this._loadNotes();
        return;
      }
      if (action === "caption-approve" || action === "caption-reject") {
        const note = (this.querySelector("textarea[data-caption-note]")?.value || "").trim();
        const desired = action === "caption-approve" ? "approved" : "rejected";
        const current = approvalStore.getCaption(this._item.id).status;
        await approvalStore.setCaption(this._item.id, current === desired ? "pending" : desired, note);
        this._updateCaptionBadge();
        await this._loadNotes();
      }
    });
  }
}

customElements.define("item-viewer", ItemViewer);
