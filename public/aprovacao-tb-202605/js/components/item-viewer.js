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
    document.body.classList.add("viewer-open");
    this.render();
    this._maybeShowSwipeHint();
    // Defensivo: força "Texto dos slides" e "Descrição Instagram" fechados.
    // Anotações fica aberto (tem data-notes-section).
    this.querySelectorAll("details.viewer-section:not([data-notes-section])").forEach(d => { d.open = false; });
    this._loadNotes();
  }

  async _loadNotes() {
    if (!this._item) return;
    const itemId = this._item.id;
    await initApprovalStore();
    if (!this._item || this._item.id !== itemId) return;
    this._notes = approvalStore.listNotes(itemId);
    this._captionNotes = approvalStore.listCaptionNotes(itemId);
    this._renderNotes();
    this._renderCaptionNotes();
  }

  _renderCaptionNotes() {
    const wrap = this.querySelector("[data-caption-notes]");
    if (!wrap) return;
    const rows = this._captionNotes || [];
    const counter = this.querySelector("[data-caption-notes-count]");
    if (counter) counter.textContent = rows.length > 0 ? `(${rows.length})` : "";
    if (!rows.length) {
      wrap.innerHTML = `<p class="viewer-notes__empty">Ainda não há anotações. Escreve uma em baixo e carrega "Guardar anotação".</p>`;
      return;
    }
    wrap.innerHTML = this._buildNoteRowsHtml(rows);
  }

  // Helper partilhado para renderizar rows de anotações (slides ou caption).
  _buildNoteRowsHtml(rows) {
    const fmt = (iso) => {
      const d = new Date(iso);
      return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    };
    return rows.map(r => {
      const isDeleted = r.deleted;
      const hasText = r.note && r.note.trim();
      let bodyHtml, rightBtn;
      if (!isDeleted) {
        bodyHtml = `<p class="viewer-note__text">${this._escapeForHtml(r.note)}</p>`;
        rightBtn = `<button type="button" class="viewer-note__delete" data-action="delete-note" data-note-key="${this._escapeForHtml(r.key)}" aria-label="Apagar anotação" title="Apagar anotação">✕</button>`;
      } else if (hasText) {
        bodyHtml = `<p class="viewer-note__text viewer-note__text--struck">${this._escapeForHtml(r.note)}</p>`;
        rightBtn = `<button type="button" class="viewer-note__restore" data-action="restore-note" data-note-key="${this._escapeForHtml(r.key)}" aria-label="Restaurar anotação" title="Restaurar anotação">↺</button>`;
      } else {
        bodyHtml = `<p class="viewer-note__text viewer-note__text--deleted"><em>[anotação apagada — texto original perdido]</em></p>`;
        rightBtn = ``;
      }
      const deletedTag = isDeleted ? `<span class="viewer-note__deleted-tag">apagada</span>` : "";
      const slideTag = r.slide ? `<span class="viewer-note__slide">Slide ${String(r.slide).padStart(2, "0")}</span>` : "";
      return `
      <div class="viewer-note${isDeleted ? ' viewer-note--deleted' : ''}" data-note-key="${this._escapeForHtml(r.key)}">
        <div class="viewer-note__meta">
          ${slideTag}
          ${deletedTag}
          <span class="viewer-note__time">${fmt(r.changed_at)}</span>
          ${r.changed_by_email ? `<span class="viewer-note__author">· ${this._escapeForHtml(r.changed_by_email)}</span>` : ""}
          ${rightBtn}
        </div>
        ${bodyHtml}
      </div>
      `;
    }).join("");
  }

  _renderNotes() {
    const wrap = this.querySelector("[data-notes]");
    if (!wrap) return;
    const rows = this._notes || [];
    const counter = this.querySelector("[data-notes-count]");
    if (counter) counter.textContent = rows.length > 0 ? `(${rows.length})` : "";

    if (!rows.length) {
      wrap.innerHTML = `<p class="viewer-notes__empty">Ainda não há anotações. Escreve uma em baixo e carrega "Guardar anotação".</p>`;
      return;
    }
    wrap.innerHTML = this._buildNoteRowsHtml(rows);
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
    document.body.classList.remove("viewer-open");
    this.innerHTML = "";
  }

  // Mostra hint de swipe uma vez por sessão em mobile — só na primeira
  // abertura do viewer. Persiste em sessionStorage para não chatear.
  _maybeShowSwipeHint() {
    try {
      if (window.innerWidth > 720) return;
      if (sessionStorage.getItem("pf-swipe-hint-seen") === "1") return;
      const hint = document.createElement("div");
      hint.className = "swipe-hint";
      hint.innerHTML = `
        <div class="swipe-hint__row">
          <span class="swipe-hint__arrow">‹</span>
          <span>desliza para navegar</span>
          <span class="swipe-hint__arrow">›</span>
        </div>`;
      document.body.appendChild(hint);
      setTimeout(() => hint.remove(), 2600);
      sessionStorage.setItem("pf-swipe-hint-seen", "1");
    } catch {}
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
    // Procura do <details> para apanhar tanto o badge (no <summary>)
    // como o div .viewer-caption (filho directo).
    const details = this.querySelector(".viewer-section--caption");
    if (!details) return;
    details.setAttribute("data-caption-status", captionState.status);
    const wrap = details.querySelector(".viewer-caption");
    if (wrap) wrap.setAttribute("data-caption-status", captionState.status);
    const badge = details.querySelector(".viewer-caption__badge");
    if (badge) {
      badge.className = `viewer-caption__badge viewer-caption__badge--${captionState.status}`;
      const map = { approved: "Aprovada", rejected: "Rejeitada", pending: "Pendente" };
      badge.textContent = map[captionState.status];
    }
    const authorEl = details.querySelector("[data-caption-author]");
    if (authorEl) {
      if (captionState.status !== "pending" && captionState.author) {
        const label = captionState.status === "approved" ? "Aprovada" : "Rejeitada";
        authorEl.innerHTML = `${label} por <strong>${this._escapeForHtml(captionState.author)}</strong>`;
        authorEl.hidden = false;
      } else {
        authorEl.innerHTML = "";
        authorEl.hidden = true;
      }
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
                <label class="tag tag--date" title="Alterar data de publicação">
                  <input type="date" data-edit-date value="${it.scheduled_for || ""}" />
                </label>
                <label class="tag tag--date" title="Alterar hora de publicação">
                  <input type="time" data-edit-hour value="${it.hour || ""}" />
                </label>
              </div>
              ${state.status !== "pending" && state.author ? `
                <p class="viewer-author" title="${this._escapeForHtml(state.author)}">
                  ${state.status === "approved" ? "Aprovado" : "Rejeitado"} por
                  <strong>${this._escapeForHtml(state.author)}</strong>
                </p>
              ` : ""}
            </div>
            <details class="viewer-section">
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
              <div class="viewer-caption" data-caption-status="${captionState.status}">
                <p class="viewer-caption__author" data-caption-author ${captionState.status === "pending" || !captionState.author ? "hidden" : ""}>${captionState.status !== "pending" && captionState.author ? `${captionState.status === "approved" ? "Aprovada" : "Rejeitada"} por <strong>${this._escapeForHtml(captionState.author)}</strong>` : ""}</p>
                <pre class="viewer-caption__text">${this._escapeForHtml(it.caption)}</pre>
                ${it.hashtags ? `<pre class="viewer-caption__hashtags">${this._escapeForHtml(it.hashtags)}</pre>` : ""}
                <div class="viewer-caption__notes-block">
                  <div class="viewer-caption__notes-head">
                    Anotações <span class="viewer-section__counter" data-caption-notes-count></span>
                  </div>
                  <div class="viewer-notes viewer-caption__notes" data-caption-notes>
                    <p class="viewer-notes__empty">A carregar…</p>
                  </div>
                </div>
                <div class="viewer-caption__actions">
                  <textarea data-caption-note placeholder="Escreve uma anotação sobre a descrição"></textarea>
                  <button class="btn btn--ghost btn--small" data-action="caption-save-note"><span class="btn__icon" aria-hidden="true">✎</span> Guardar anotação</button>
                  <span class="viewer-caption__feedback" data-caption-feedback aria-live="polite"></span>
                  <button class="btn btn--reject btn--small" data-action="caption-reject"><span class="btn__icon" aria-hidden="true">✕</span> Rejeitar descrição</button>
                  <button class="btn btn--approve btn--small" data-action="caption-approve"><span class="btn__icon" aria-hidden="true">✓</span> Aprovar descrição</button>
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
            <button class="btn btn--ghost" data-action="save-note"><span class="btn__icon" aria-hidden="true">✎</span> Guardar anotação</button>
            <span class="viewer-actions__feedback" data-feedback aria-live="polite"></span>
            <button class="btn btn--reject" data-action="reject"><span class="btn__icon" aria-hidden="true">✕</span> Rejeitar</button>
            <button class="btn btn--approve" data-action="approve"><span class="btn__icon" aria-hidden="true">✓</span> Aprovar</button>
          </div>
        </aside>
        <button class="viewer-close" data-action="close" aria-label="Fechar">×</button>
      </div>
    `;

    this._updateCounter();

    // Edição da data de publicação. Quando o user escolhe nova data:
    // 1) Persiste em Supabase via approvalStore.setDate
    // 2) Muta _item.scheduled_for em memória
    // 3) Emite item:date-changed para o main.js mutar state.items + render()
    const dateInput = this.querySelector("input[data-edit-date]");
    if (dateInput) {
      dateInput.addEventListener("change", async (e) => {
        const newDate = e.target.value;
        if (!newDate || !this._item) return;
        const oldDate = this._item.scheduled_for;
        if (newDate === oldDate) return;
        this._item.scheduled_for = newDate;
        try {
          await approvalStore.setDate(this._item.id, newDate);
        } catch (err) {
          console.error("[viewer] setDate failed:", err);
          this._item.scheduled_for = oldDate;
          e.target.value = oldDate || "";
          return;
        }
        this.dispatchEvent(new CustomEvent("item:date-changed", {
          bubbles: true,
          detail: { id: this._item.id, date: newDate, oldDate },
        }));
      });
    }

    const hourInput = this.querySelector("input[data-edit-hour]");
    if (hourInput) {
      hourInput.addEventListener("change", async (e) => {
        const newHour = e.target.value;
        if (!newHour || !this._item) return;
        const oldHour = this._item.hour;
        if (newHour === oldHour) return;
        this._item.hour = newHour;
        try {
          await approvalStore.setHour(this._item.id, newHour);
        } catch (err) {
          console.error("[viewer] setHour failed:", err);
          this._item.hour = oldHour;
          e.target.value = oldHour || "";
          return;
        }
        this.dispatchEvent(new CustomEvent("item:hour-changed", {
          bubbles: true,
          detail: { id: this._item.id, hour: newHour, oldHour },
        }));
      });
    }

    // Swipe gestures (mobile) — swipe horizontal no modal navega entre items.
    // Ignora swipes dentro de áreas de scroll, inputs ou na action bar
    // (caso contrário o user perde a anotação a meio).
    const modalEl = this.querySelector(".viewer-modal");
    let _tsX = 0, _tsY = 0, _tsT = 0, _tsValid = false;
    modalEl.addEventListener("touchstart", (e) => {
      _tsValid = false;
      if (e.touches.length !== 1) return;
      const t = e.target;
      if (t.closest("textarea, select, input, button, a, iframe, .viewer-panel__scroll, .viewer-actions, .viewer-caption__actions")) return;
      _tsX = e.touches[0].clientX;
      _tsY = e.touches[0].clientY;
      _tsT = Date.now();
      _tsValid = true;
    }, { passive: true });
    modalEl.addEventListener("touchend", (e) => {
      if (!_tsValid) return;
      _tsValid = false;
      const dx = e.changedTouches[0].clientX - _tsX;
      const dy = e.changedTouches[0].clientY - _tsY;
      const dt = Date.now() - _tsT;
      if (dt > 500) return;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (Math.abs(dx) < 70) return;
      if (dx < 0) this._advanceItem(+1);
      else this._advanceItem(-1);
    }, { passive: true });

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
        if (!window.confirm("Apagar esta anotação? O texto fica preservado e podes restaurar mais tarde.")) return;
        const ok = await approvalStore.deleteNote(key);
        if (!ok) {
          window.alert("Não foi possível apagar a anotação. Tenta de novo.");
          return;
        }
        await this._loadNotes();
        return;
      }
      if (action === "restore-note") {
        const key = btn.dataset.noteKey;
        if (!key) return;
        const ok = await approvalStore.restoreNote(key);
        if (!ok) {
          window.alert("Não foi possível restaurar a anotação (texto original perdido).");
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
        const ta = this.querySelector("textarea[data-caption-note]");
        const text = (ta?.value || "").trim();
        if (!text) return;
        await approvalStore.saveNote(this._item.id, text, { caption: true });
        if (ta) ta.value = "";
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
        const desired = action === "caption-approve" ? "approved" : "rejected";
        const current = approvalStore.getCaption(this._item.id).status;
        // Aprovação/rejeição da caption — note vazia, a opinião fica nas
        // anotações dedicadas via saveNote({caption:true}).
        await approvalStore.setCaption(this._item.id, current === desired ? "pending" : desired, "");
        this._updateCaptionBadge();
        await this._loadNotes();
      }
    });
  }
}

customElements.define("item-viewer", ItemViewer);
