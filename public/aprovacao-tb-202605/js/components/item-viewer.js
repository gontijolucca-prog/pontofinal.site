// <item-viewer> — preview em zoom (HTML ao vivo) com navegação entre slides.
// Sem vista detalhada nem anotações: apenas Aprovar / Reprovar. Ao carregar
// num desses botões abre-se um assistente que percorre o copy de cada slide
// (editável, com "Aplicar" que altera o texto ao vivo no iframe same-origin e
// guarda o override) e termina no copy da descrição. O PNG final é
// re-renderizado do lado do produtor a partir dos overrides guardados.

import { approvalStore, init as initApprovalStore } from "../stores/approval-store.js";
import { fitScaledFrame, dimsFor } from "../lib/fit-frame.js";
import { APP_VERSION } from "../config.js";
import { currentContentSig } from "../data-loader.js";
import { userIsEditing } from "../utils/user-editing.js";
import { fmtToHtml } from "../lib/rich-text.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };
const ROLE_LABELS = { hook: "Hook", demo: "Desenvolvimento", proof: "Prova", development: "Desenvolvimento", cta: "CTA", outro: "Fecho", intro: "Intro" };

class ItemViewer extends HTMLElement {
  connectedCallback() {
    this.classList.add("viewer-backdrop");
    this._slide = 1;
    this._wizard = null;
    // Refresca o estado mostrado no painel quando o cache muda (ex.: realtime).
    this._onApprovalChange = () => {
      if (!this._item || this.getAttribute("data-open") !== "true") return;
      if (!this._wizard) this._refreshStatusLine();
    };
    window.addEventListener("approval:changed", this._onApprovalChange);

    // Auto-refresh quando o conteúdo do servidor muda enquanto o viewer está
    // aberto. Substitui o item em memória pela versão fresca e recarrega o
    // iframe com novo cache-bust. Adia se o user está a editar texto (não
    // mexe enquanto há um campo focado).
    this._onContentChanged = (ev) => {
      if (this.getAttribute("data-open") !== "true" || !this._item) return;
      const d = ev.detail || {};
      if (!Array.isArray(d.changedIds) || !d.changedIds.includes(this._item.id)) return;
      if (userIsEditing()) { this._pendingContentRefresh = d; return; }
      const fresh = (d.items || []).find(it => it.id === this._item.id);
      if (!fresh) return;
      this._item = fresh;
      // Refresh conforme o modo activo.
      if (this._viewMode === "live") {
        const iframe = this.querySelector(".viewer-frame-iframe");
        if (iframe && fresh.html_url) {
          const hash = this._isCarousel ? `#slide-${this._slide || 1}` : "";
          iframe.src = `${fresh.html_url}?v=${APP_VERSION}&c=${d.contentSig}${hash}`;
        }
      } else if (this._isCarousel) {
        this._gotoSlideImage(this._slide || 1);
      } else {
        const img = this.querySelector(".viewer-slide-img");
        if (img && fresh.html_url) {
          const shotBase = (fresh.html_url || "").replace(/\.html$/, "");
          const bust = `?v=${APP_VERSION}&c=${d.contentSig}`;
          img.src = `${shotBase}.jpg${bust}`;
        }
      }
      this._applyStoredOverrides && this._applyStoredOverrides();
    };
    window.addEventListener("content:changed", this._onContentChanged);
    // Tentar aplicar o último update adiado quando o user sai do foco.
    this._onFocusOut = () => {
      setTimeout(() => {
        if (!this._pendingContentRefresh || userIsEditing()) return;
        const d = this._pendingContentRefresh; this._pendingContentRefresh = null;
        this._onContentChanged({ detail: d });
      }, 60);
    };
    document.addEventListener("focusout", this._onFocusOut);
    this.addEventListener("click", (e) => { if (e.target === this) this.close(); });
    document.addEventListener("keydown", (e) => {
      if (this.getAttribute("data-open") !== "true") return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if (e.key === "Escape") { if (this._wizard) return this._exitWizard(); return this.close(); }
      if (typing) return;
      if (e.key === "ArrowRight") return this._wizard ? this._wizardNext() : this._step(+1);
      if (e.key === "ArrowLeft")  return this._wizard ? this._wizardBack() : this._step(-1);
      if (this._wizard) return;
      const key = e.key.toLowerCase();
      if (key === "j" || e.key === "ArrowDown") { e.preventDefault(); this._advanceItem(+1); return; }
      if (key === "k" || e.key === "ArrowUp")   { e.preventDefault(); this._advanceItem(-1); return; }
    });
  }

  _advanceItem(direction) {
    if (!this._item) return false;
    const ev = new CustomEvent("viewer:advance", {
      bubbles: true, cancelable: true,
      detail: { currentId: this._item.id, direction, next: null },
    });
    this.dispatchEvent(ev);
    const next = ev.detail.next;
    if (!next) return false;
    this.open(next);
    return true;
  }

  // ─── Abertura / fecho ────────────────────────────────────────────────────

  open(item) {
    this._item = item;
    this._slide = 1;
    this._wizard = null;
    this._viewMode = "image";
    this.setAttribute("data-open", "true");
    this.setAttribute("aria-hidden", "false");
    document.body.classList.add("viewer-open");
    this.render();
    // Aplica overrides de copy já guardados (de sessões anteriores) por cima
    // do items.json, para o texto editado aparecer mesmo após reload.
    this._applyStoredOverrides();
  }

  close() {
    if (this._fitCleanup) { this._fitCleanup(); this._fitCleanup = null; }
    this._item = null;
    this._wizard = null;
    this._onboard = null;
    this.removeAttribute("data-open");
    this.setAttribute("aria-hidden", "true");
    document.body.classList.remove("viewer-open");
    this.innerHTML = "";
  }

  // ─── Helpers de dados ─────────────────────────────────────────────────────

  get _isCarousel() { return this._item?.format === "carrossel" && (this._item?.slides || 1) > 1; }
  get _isReel()     { return this._item?.format === "reel"; }

  _slideText(n) {
    const s = (this._item?.slides_text || [])[n - 1];
    return s ? (s.text_overlay || s.text || "") : "";
  }

  _slideCount() {
    const it = this._item;
    if (!it) return 0;
    if (it.slides_text && it.slides_text.length) return it.slides_text.length;
    return it.slides || 1;
  }

  // Carrega overrides guardados (Supabase/localStorage) e aplica-os ao item em
  // memória + ao iframe ao vivo.
  _applyStoredOverrides() {
    const it = this._item;
    if (!it) return;
    const slideOv = approvalStore.getAllSlideCopyOverrides?.()[it.id] || {};
    for (const [n, ov] of Object.entries(slideOv)) {
      const idx = parseInt(n, 10) - 1;
      if (it.slides_text && it.slides_text[idx]) {
        const f = it.slides_text[idx].text_overlay != null ? "text_overlay" : "text";
        it.slides_text[idx][f] = ov.text;
      }
    }
    const capOv = approvalStore.getAllCaptionCopyOverrides?.()[it.id];
    if (capOv) it.caption = capOv.text;
    // Reflectir nos textareas do painel directo (caso render() já tenha corrido).
    for (const [n, ov] of Object.entries(slideOv)) {
      const ta = this.querySelector(`[data-edit-slide="${n}"]`);
      if (ta) ta.value = ov.text;
    }
    if (capOv) {
      const capTa = this.querySelector("[data-edit-caption]");
      if (capTa) capTa.value = capOv.text;
    }
    // Reflectir no iframe do wizard assim que carregar (o viewer principal
    // agora usa imagens estáticas por defeito — o iframe vive no modo "ao vivo").
    if (Object.keys(slideOv).length) {
      const iframe = this.querySelector(".viewer-frame-iframe") || this.querySelector(".onboard__preview iframe");
      if (iframe) {
        const reapply = () => { for (const n of Object.keys(slideOv)) this._editFrameH1(iframe, parseInt(n, 10), slideOv[n].text); };
        iframe.addEventListener("load", reapply, { once: true });
        // Caso já esteja carregado.
        try { if (iframe.contentDocument?.readyState === "complete") reapply(); } catch {}
      }
    }
  }

  // ─── Navegação de slides (sem reload do iframe) ───────────────────────────

  _step(delta) {
    if (!this._isCarousel) return;
    const total = this._slideCount();
    const next = Math.min(total, Math.max(1, this._slide + delta));
    if (next === this._slide) return;
    this._slide = next;
    if (this._viewMode === "live") this._gotoSlideInFrame(next);
    else this._gotoSlideImage(next);
    this._updateCounter();
  }

  _gotoSlideImage(n) {
    const img = this.querySelector(".viewer-slide-img");
    if (!img || !this._item) return;
    const shotBase = (this._item.html_url || "").replace(/\.html$/, "");
    if (!shotBase) return;
    const src = `${shotBase}_shots/slide_${String(n).padStart(2, "0")}.jpg?v=${APP_VERSION}&c=${currentContentSig()}`;
    img.src = src;
  }

  _gotoSlideInFrame(n) {
    // Target: iframe do viewer principal (modo ao vivo) ou iframe do wizard.
    const iframe = this.querySelector(".viewer-frame-iframe") || this.querySelector(".onboard__preview iframe");
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      const el = doc && doc.getElementById(`slide-${n}`);
      if (el) {
        const sc = doc.querySelector(".carousel");
        if (sc) sc.scrollTo({ left: el.offsetLeft, top: 0, behavior: "instant" });
        else iframe.contentWindow.scrollTo({ left: el.offsetLeft, top: el.offsetTop, behavior: "instant" });
        return;
      }
    } catch {}
    if (this._item?.html_url) iframe.src = `${this._item.html_url}?v=${APP_VERSION}&c=${currentContentSig()}#slide-${n}`;
  }

  _updateCounter() {
    const el = this.querySelector(".viewer-counter");
    if (el) el.textContent = `${this._slide} / ${this._slideCount()}`;
    const prev = this.querySelector(".viewer-nav--prev");
    const next = this.querySelector(".viewer-nav--next");
    if (prev) prev.disabled = this._slide <= 1;
    if (next) next.disabled = this._slide >= this._slideCount();
  }

  // Edita ao vivo o h1 de um slide num iframe same-origin. Não persiste.
  _editFrameH1(iframe, n, text) {
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      let target = doc.querySelector(`#slide-${n} h1, #slide-${n} h2, #slide-${n} blockquote`);
      if (!target && n === 1) target = doc.querySelector("h1, h2, blockquote");
      if (target) target.innerHTML = fmtToHtml(text);
    } catch { /* cross-origin improvável (mesmo domínio) — ignora */ }
  }

  _scrollFrameToSlide(iframe, n) {
    try {
      const doc = iframe.contentDocument;
      const el = doc && doc.getElementById(`slide-${n}`);
      // scrollTo no scroller real — ver nota em _gotoSlideInFrame.
      if (el) {
        const sc = doc.querySelector(".carousel");
        if (sc) sc.scrollTo({ left: el.offsetLeft, top: 0, behavior: "instant" });
        else iframe.contentWindow.scrollTo({ left: el.offsetLeft, top: el.offsetTop, behavior: "instant" });
      }
    } catch {}
  }

  _liveEditSlide(n, text) { this._editFrameH1(this.querySelector(".viewer-frame-iframe"), n, text); }

  // ─── Render principal ─────────────────────────────────────────────────────

  render() {
    const it = this._item;
    if (!it) return;
    const isCarousel = this._isCarousel;
    const isReel = this._isReel;

    const navbarHtml = isCarousel ? `
      <div class="viewer-navbar">
        <button class="viewer-nav viewer-nav--prev" data-action="prev" aria-label="Slide anterior">‹</button>
        <span class="viewer-counter">${this._slide} / ${this._slideCount()}</span>
        <button class="viewer-nav viewer-nav--next" data-action="next" aria-label="Próximo slide">›</button>
      </div>` : "";

    const reelScriptHtml = isReel ? `
      <div class="viewer-reel-script">
        <div class="viewer-reel-script__head">
          <span class="viewer-reel-script__badge">Script para gravação</span>
          <span class="viewer-reel-script__duration">Reel ${it.slides || 15}s</span>
        </div>
        <ol class="viewer-reel-script__list">
          ${(it.slides_text || []).map((s, i) => `
            <li class="viewer-reel-script__line" data-reel-line="${i + 1}">
              <div class="viewer-reel-script__line-head">
                <span class="viewer-reel-script__line-num">${String(i + 1).padStart(2, "0")}</span>
                ${s.role ? `<span class="viewer-reel-script__line-role">${this._escapeForHtml(ROLE_LABELS[s.role] || s.role)}</span>` : ""}
              </div>
              <p class="viewer-reel-script__line-text">${this._escapeForHtml(s.text_overlay || s.text || "")}</p>
            </li>`).join("")}
        </ol>
      </div>` : "";

    const isReelVideo = isReel && !!it.video_url;
    const bust = `?v=${APP_VERSION}&c=${currentContentSig()}`;
    // Híbrido: imagem final (screenshot) visível por defeito + iframe HTML
    // escondido para edição ao vivo. Toggle permite alternar entre os dois.
    // Quando o user focus um textarea, auto-switch para modo "ao vivo".
    const shotBase = (it.html_url || "").replace(/\.html$/, "");
    let frameHtml = "";
    if (isReelVideo) {
      frameHtml = `<video class="viewer-video" src="${it.video_url}${bust}" controls autoplay loop playsinline></video>`;
    } else if (isReel) {
      frameHtml = reelScriptHtml;
    } else if (isCarousel && shotBase) {
      const slideImg = `${shotBase}_shots/slide_01.jpg${bust}`;
      const iframeSrc = `${it.html_url}${bust}#slide-1`;
      frameHtml = `<img class="viewer-slide-img" src="${slideImg}" alt="${this._escapeForHtml(it.title || "")}" />` +
        `<iframe class="viewer-frame-iframe" data-src="${iframeSrc}" style="display:none" title="${this._escapeForHtml(it.title || "")}" scrolling="no"></iframe>`;
    } else if (it.html_url && shotBase) {
      // Story: imagem única + iframe para edição
      const storyImg = `${shotBase}.jpg${bust}`;
      const iframeSrc = `${it.html_url}${bust}`;
      frameHtml = `<img class="viewer-slide-img" src="${storyImg}" alt="${this._escapeForHtml(it.title || "")}" />` +
        `<iframe class="viewer-frame-iframe" data-src="${iframeSrc}" style="display:none" title="${this._escapeForHtml(it.title || "")}" scrolling="no"></iframe>`;
    }
    // Direct-edit textareas for each slide + caption
    // Fallback: se slides_text está vazio mas o item tem slides, gera textareas vazios
    const slidesArr = (it.slides_text && it.slides_text.length)
      ? it.slides_text
      : Array.from({ length: it.slides || 1 }, () => ({ text_overlay: "" }));
    const slideEditors = slidesArr.map((s, i) => {
      const n = i + 1;
      const text = s.text_overlay || s.text || "";
      const label = it.format === "reel" ? `Linha ${String(n).padStart(2, "0")}` : `Slide ${String(n).padStart(2, "0")}`;
      return `<div class="viewer-edit-slide">
        <label class="viewer-edit-slide__label">${label} <span class="hint">Enter = quebra de linha · *palavra* = destaque</span></label>
        <textarea data-edit-slide="${n}" rows="5">${this._escapeForHtml(text)}</textarea>
        <span class="viewer-edit-slide__fb" data-fb-slide="${n}"></span>
      </div>`;
    }).join("");
    const captionEditor = it.caption ? `
      <div class="viewer-edit-caption">
        <label class="viewer-edit-caption__label">Descrição (Instagram) <span class="hint" style="font-weight:400;text-transform:none;letter-spacing:0;opacity:0.5;font-size:9px">edita aqui</span></label>
        <textarea data-edit-caption rows="4">${this._escapeForHtml(it.caption || "")}</textarea>
        <span class="viewer-edit-caption__fb" data-fb-caption></span>
      </div>` : "";

    this.innerHTML = `
      <div class="viewer-modal viewer-modal--zoom" data-format="${it.format}" role="dialog" aria-modal="true" aria-label="${this._escapeForHtml(it.title || it.theme || "")}">
        <div class="viewer-frame-col">
          <div class="viewer-frame-wrap${isReelVideo ? " viewer-frame-wrap--video" : ""}">${frameHtml}</div>
          ${navbarHtml}
        </div>
        <aside class="viewer-panel">
          <div class="viewer-panel__default" data-panel="default">
            <div class="viewer-meta">
              <span class="viewer-brand">${BRAND_LABELS[it.brand] || it.brand}</span><span class="card__ref">${(it.id || "").split("-").pop()}</span>
              <h3 class="viewer-title">${this._escapeForHtml(it.title || it.theme || "")}</h3>
              <div class="viewer-tags">
                <span class="tag tag--accent">${it.format}</span>
                ${it.pilar ? `<span class="tag">${this._escapeForHtml(it.pilar)}</span>` : ""}
                ${it.audience ? `<span class="tag tag--solid">${String(it.audience).toUpperCase()}</span>` : ""}
                <label class="tag tag--date" title="Alterar data de publicação"><input type="date" data-edit-date value="${it.scheduled_for || ""}" /></label>
                <label class="tag tag--date" title="Alterar hora de publicação"><input type="time" data-edit-hour value="${it.hour || ""}" /></label>
              </div>
              <p class="viewer-status-line" data-status-line></p>
            </div>
            ${slideEditors}
            ${captionEditor}
            <div class="viewer-actions" style="display:flex;gap:0;margin-top:8px;flex-wrap:wrap">
              <button class="btn" data-action="start-edit" style="flex:1 0 100%;padding:10px;border:2px solid var(--border);background:var(--text);color:var(--bg);cursor:pointer;font:700 12px/1 'JetBrains Mono',monospace;text-transform:uppercase;margin-bottom:4px">✎ Assistente de revisão</button>
              <button class="btn" data-action="approve-direct" style="flex:1;padding:8px;border:2px solid var(--border);background:var(--bg);cursor:pointer;font:700 11px/1 'JetBrains Mono',monospace;text-transform:uppercase">✓ Aprovar</button>
              <button class="btn" data-action="reject-direct" style="flex:1;padding:8px;border:2px solid var(--border);background:var(--bg);cursor:pointer;font:700 11px/1 'JetBrains Mono',monospace;text-transform:uppercase">✗ Reprovar</button>
              <button class="btn" data-action="publish" style="flex:1;padding:8px;border:2px solid var(--border);background:var(--bg);cursor:pointer;font:700 11px/1 'JetBrains Mono',monospace;text-transform:uppercase">📌 Publicado</button>
            </div>
            <p class="viewer-hint">${isCarousel ? "Desliza entre os slides com ‹ ›. " : ""}A imagem final é a referência. Clica num campo de texto para editar.</p>
          </div>
        </aside>
        <button class="viewer-close" data-action="close" aria-label="Fechar">×</button>
      </div>`;

    // Imagens estáticas: não precisam de fitScaledFrame (CSS object-fit: contain
    // faz o scaling). O fitScaledFrame só se aplica a iframes (wizard preview).
    if (this._fitCleanup) { this._fitCleanup(); this._fitCleanup = null; }

    this._updateCounter();
    this._refreshStatusLine();
    this._bindDefaultHandlers();
    this._bindDirectEditors();
  }

  // Toggle imagem/ao-vivo removido — ambos modos usam .jpg agora

  _refreshStatusLine() {
    const el = this.querySelector("[data-status-line]");
    if (!el || !this._item) return;
    const st = approvalStore.get(this._item.id);
    if (st.status === "pending" || !st.status) { el.textContent = ""; el.hidden = true; return; }
    el.hidden = false;
    const label = st.status === "published" ? "Publicado" : st.status === "approved" ? "Aprovado" : "Rejeitado";
    el.innerHTML = `${label}${st.author ? ` por <strong>${this._escapeForHtml(st.author)}</strong>` : ""}`;
    el.dataset.status = st.status;
  }

  _bindDefaultHandlers() {
    const modal = this.querySelector(".viewer-modal");
    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const a = btn.dataset.action;
      if (a === "close")  return this._wizard ? this._exitWizard() : this.close();
      if (a === "prev")   return this._step(-1);
      if (a === "next")   return this._step(+1);
      // mode toggle removido — imagem final = ao vivo
      if (a === "start-approve") return this._startWizard("approved");
      if (a === "start-reject")  return this._startWizard("rejected");
      if (a === "start-edit")    return this._startWizard("edit");
      if (a === "approve-direct") {
        if (confirm("Aprovar este item?")) {
          import("../stores/approval-store.js").then(m => m.approvalStore.set(this._item.id, "approved"));
          this._refreshStatusLine();
        }
        return;
      }
      if (a === "reject-direct") {
        if (confirm("Reprovar este item?")) {
          import("../stores/approval-store.js").then(m => m.approvalStore.set(this._item.id, "rejected"));
          this._refreshStatusLine();
        }
        return;
      }
      if (a === "publish") {
        if (confirm("Marcar como publicado?")) {
          import("../stores/approval-store.js").then(m => m.approvalStore.set(this._item.id, "published"));
          this._refreshStatusLine();
        }
        return;
      }
    });

    const dateInput = this.querySelector("input[data-edit-date]");
    if (dateInput) dateInput.addEventListener("change", async (e) => {
      const v = e.target.value; if (!v || !this._item) return;
      const old = this._item.scheduled_for; if (v === old) return;
      this._item.scheduled_for = v;
      try { await approvalStore.setDate(this._item.id, v); }
      catch { this._item.scheduled_for = old; e.target.value = old || ""; return; }
      this.dispatchEvent(new CustomEvent("item:date-changed", { bubbles: true, detail: { id: this._item.id, date: v, oldDate: old } }));
    });

    const hourInput = this.querySelector("input[data-edit-hour]");
    if (hourInput) hourInput.addEventListener("change", async (e) => {
      const v = e.target.value; if (!v || !this._item) return;
      const old = this._item.hour; if (v === old) return;
      this._item.hour = v;
      try { await approvalStore.setHour(this._item.id, v); }
      catch { this._item.hour = old; e.target.value = old || ""; return; }
      this.dispatchEvent(new CustomEvent("item:hour-changed", { bubbles: true, detail: { id: this._item.id, hour: v, oldHour: old } }));
    });
  }

  // ─── Assistente de confirmação de copies ──────────────────────────────────

  _startWizard(disposition) {
    const it = this._item;
    if (!it) return;
    const steps = [];
    const n = this._slideCount();
    const hasSlides = (it.slides_text && it.slides_text.length) || it.format === "carrossel" || it.format === "story";
    if (hasSlides) {
      for (let i = 1; i <= Math.max(1, n); i++) {
        steps.push({ type: "slide", n: i, label: it.format === "story" ? "Texto da imagem" : `Slide ${String(i).padStart(2, "0")}` });
      }
    }
    if (it.caption && it.caption.trim()) steps.push({ type: "caption", label: "Descrição (Instagram)" });
    if (!steps.length) steps.push({ type: "caption", label: "Descrição (Instagram)" });
    this._wizard = { disposition, steps, idx: 0 };
    const isEditMode = disposition === "edit";
    const modal = this.querySelector(".viewer-modal");
    const ob = document.createElement("div");
    ob.className = "onboard";
    ob.innerHTML = `<div class="onboard__scrim"></div><div class="onboard__card" role="dialog" aria-modal="true"></div>`;
    modal.appendChild(ob);
    this._onboard = ob;
    ob.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const a = btn.dataset.action;
      if (a === "wz-exit")   return this._exitWizard();
      if (a === "wz-back")   return this._wizardBack();
      if (a === "wz-next")   return this._wizardNext();
      if (a === "wz-apply")  return this._wizardApply();
      if (a === "wz-finish") return this._wizardFinish();
    });
    this._renderWizardStep();
  }

  _exitWizard() {
    this._wizard = null;
    if (this._onboard) { this._onboard.remove(); this._onboard = null; }
    this._refreshStatusLine();
  }

  _renderWizardStep() {
    const w = this._wizard;
    const card = this._onboard && this._onboard.querySelector(".onboard__card");
    if (!card || !w) return;
    const it = this._item;
    const step = w.steps[w.idx];
    const isLast = w.idx === w.steps.length - 1;
    const dispLabel = w.disposition === "approved" ? "Aprovar" : w.disposition === "rejected" ? "Reprovar" : "Editar";

    // Mantém a vista de zoom (atrás) sincronizada com o passo.
    if (step.type === "slide") {
      this._slide = step.n;
      if (this._isCarousel) { this._gotoSlideInFrame(step.n); this._updateCounter(); }
      this._highlightReelLine(step.n);
    }

    const value = step.type === "caption" ? (it.caption || "") : this._slideText(step.n);
    const hashtags = step.type === "caption" && it.hashtags ? it.hashtags : "";

    // Pré-visualização ao vivo do post dentro do próprio popup.
    let previewHtml = "";
    if (step.type === "slide" && it.html_url && !this._isReel) {
      const ratio = it.format === "story" ? "9-16" : "4-5";
      const src = `${it.html_url}?v=${APP_VERSION}&c=${currentContentSig()}${this._isCarousel ? `#slide-${step.n}` : ""}`;
      previewHtml = `<div class="onboard__preview onboard__preview--${ratio}"><iframe data-ob-frame src="${src}" title="pré-visualização" scrolling="no"></iframe></div>`;
    } else if (this._isReel && step.type === "slide") {
      const role = (it.slides_text || [])[step.n - 1]?.role;
      previewHtml = `<div class="onboard__reel-tag">Linha ${String(step.n).padStart(2, "0")}${role ? " · " + this._escapeForHtml(ROLE_LABELS[role] || role) : ""}</div>`;
    }

    card.innerHTML = `
      <div class="onboard__head">
        <span class="onboard__kicker">Confirmar conteúdo</span>
        <span class="wizard__disp wizard__disp--${w.disposition}">${dispLabel}</span>
        <button class="onboard__close" data-action="wz-exit" aria-label="Cancelar">×</button>
      </div>
      <div class="wizard__progress" aria-hidden="true">
        ${w.steps.map((s, i) => `<span class="wizard__dot${i === w.idx ? " is-active" : ""}${i < w.idx ? " is-done" : ""}"></span>`).join("")}
      </div>
      <div class="wizard__step-label">${this._escapeForHtml(step.label)} <span class="wizard__step-count">${w.idx + 1} / ${w.steps.length}</span></div>
      ${previewHtml}
      <p class="wizard__q">${step.type === "caption" ? "Concordas com o copy da descrição?" : "Concordas com o texto deste post?"}</p>
      <textarea class="wizard__textarea" data-wz-text rows="${step.type === "caption" ? 8 : 3}">${this._escapeForHtml(value)}</textarea>
      ${hashtags ? `<pre class="wizard__hashtags">${this._escapeForHtml(hashtags)}</pre>` : ""}
      <div class="wizard__apply-row">
        <button class="btn btn--ghost btn--small" data-action="wz-apply" disabled><span class="btn__icon" aria-hidden="true">✎</span> Aplicar alteração</button>
        <span class="wizard__feedback" data-wz-feedback aria-live="polite"></span>
      </div>
      <div class="wizard__nav">
        <button class="btn btn--ghost" data-action="wz-back" ${w.idx === 0 ? "disabled" : ""}>‹ Anterior</button>
        ${isLast
          ? (isEditMode
            ? `<button class="btn btn--solid" data-action="wz-finish">Concluir edição ✓</button>`
            : `<button class="btn btn--${w.disposition === "approved" ? "approve" : "reject"}" data-action="wz-finish">Concluir — ${dispLabel} ✓</button>`)
          : `<button class="btn btn--solid" data-action="wz-next">Confirmar ›</button>`}
      </div>`;

    // Pré-visualização: navega para o slide e aplica o texto actual (override).
    const obFrame = card.querySelector("[data-ob-frame]");
    if (obFrame && step.type === "slide") {
      obFrame.addEventListener("load", () => { this._scrollFrameToSlide(obFrame, step.n); this._editFrameH1(obFrame, step.n, value); }, { once: true });
    }

    const ta = card.querySelector("[data-wz-text]");
    const applyBtn = card.querySelector('[data-action="wz-apply"]');
    const original = value;
    ta.addEventListener("input", () => { applyBtn.disabled = ta.value.trim() === original.trim(); });
    setTimeout(() => ta.focus(), 40);
  }

  _highlightReelLine(n) {
    if (!this._isReel) return;
    this.querySelectorAll(".viewer-reel-script__line").forEach(li => {
      li.classList.toggle("is-active", String(li.dataset.reelLine) === String(n));
    });
    const active = this.querySelector(`.viewer-reel-script__line[data-reel-line="${n}"]`);
    if (active) active.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async _wizardApply() {
    const w = this._wizard; if (!w) return;
    const card = this._onboard.querySelector(".onboard__card");
    const ta = card.querySelector("[data-wz-text]");
    const step = w.steps[w.idx];
    const text = (ta.value || "").trim();
    const fb = card.querySelector("[data-wz-feedback]");
    try {
      if (step.type === "caption") {
        await approvalStore.setCaptionCopy(this._item.id, text);
        this._item.caption = text;
      } else {
        await approvalStore.setSlideCopy(this._item.id, step.n, text);
        const idx = step.n - 1;
        if (this._item.slides_text && this._item.slides_text[idx]) {
          const f = this._item.slides_text[idx].text_overlay != null ? "text_overlay" : "text";
          this._item.slides_text[idx][f] = text;
        }
        this._liveEditSlide(step.n, text);                                  // zoom grande (atrás)
        this._editFrameH1(card.querySelector("[data-ob-frame]"), step.n, text); // preview no popup
        this._updateReelLineText(step.n, text);
      }
      if (fb) { fb.textContent = "✓ Aplicado"; fb.classList.add("is-ok"); }
      card.querySelector('[data-action="wz-apply"]').disabled = true;
    } catch (err) {
      console.error("[wizard] apply failed:", err);
      if (fb) { fb.textContent = "Falhou — tenta de novo"; fb.classList.remove("is-ok"); }
    }
  }

  _updateReelLineText(n, text) {
    const p = this.querySelector(`.viewer-reel-script__line[data-reel-line="${n}"] .viewer-reel-script__line-text`);
    if (p) p.textContent = text;
  }

  _wizardBack() {
    const w = this._wizard; if (!w || w.idx === 0) return;
    w.idx--;
    this._renderWizardStep();
  }

  _wizardNext() {
    const w = this._wizard; if (!w) return;
    if (w.idx < w.steps.length - 1) { w.idx++; this._renderWizardStep(); }
  }

  async _wizardFinish() {
    const w = this._wizard; if (!w) return;
    const it = this._item;
    // In edit mode, just close — no approval change
    if (w.disposition === "edit") {
      this._showActionToast("edit");
      this._wizard = null;
      if (this._onboard) { this._onboard.remove(); this._onboard = null; }
      this._refreshStatusLine();
      return;
    }
    await approvalStore.set(it.id, w.disposition);
    // Marca também a descrição com a mesma disposição (foi confirmada no fluxo).
    if (it.caption && it.caption.trim()) {
      try { await approvalStore.setCaption(it.id, w.disposition); } catch {}
    }
    this._showActionToast(w.disposition);
    this._wizard = null;
    if (this._onboard) { this._onboard.remove(); this._onboard = null; }
    if (!this._advanceItem(+1)) this.close();
  }

  _showActionToast(status) {
    try {
      const cfg = {
        approved: { icon: "✓", text: "Aprovado", color: "#2BB05F" },
        rejected: { icon: "✕", text: "Rejeitado", color: "#FF4D2E" },
        edit: { icon: "✎", text: "Textos guardados", color: "#333" },
      };
      const c = cfg[status]; if (!c) return;
      const toast = document.createElement("div");
      toast.className = "action-toast";
      toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${c.color};color:#fff;padding:14px 24px;font:900 14px/1 var(--font-heavy,'Arial Black',sans-serif);letter-spacing:0.08em;text-transform:uppercase;border:3px solid #050505;box-shadow:6px 6px 0 0 #050505;z-index:9999;display:flex;align-items:center;gap:10px;`;
      toast.innerHTML = `<span style="font-size:18px">${c.icon}</span>${c.text}`;
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.transition = "opacity 200ms,transform 200ms"; toast.style.opacity = "0"; toast.style.transform = "translateX(-50%) translateY(10px)"; setTimeout(() => toast.remove(), 220); }, 1400);
    } catch {}
  }

  _bindDirectEditors() {
    this._editTimers = {};
    // Slide text editors
    this.querySelectorAll("[data-edit-slide]").forEach(ta => {
      const n = parseInt(ta.dataset.editSlide, 10);
      ta.addEventListener("input", () => {
        this._editFrameH1(this.querySelector(".viewer-frame-iframe"), n, ta.value);
        this._debounceEdit(`slide-${n}`, async () => {
          await approvalStore.setSlideCopy(this._item.id, n, ta.value.trim());
          const idx = n - 1;
          if (this._item.slides_text && this._item.slides_text[idx]) {
            const f = this._item.slides_text[idx].text_overlay != null ? "text_overlay" : "text";
            this._item.slides_text[idx][f] = ta.value.trim();
          }
          const fb = this.querySelector(`[data-fb-slide="${n}"]`);
          if (fb) { fb.textContent = "✓"; setTimeout(() => { fb.textContent = ""; }, 1500); }
          // Commit permanente no HTML do post
          this._saveToHtmlFile(n, ta.value.trim());
        });
      });
    });
    // Caption editor
    const capTa = this.querySelector("[data-edit-caption]");
    if (capTa) capTa.addEventListener("input", () => {
      this._debounceEdit("caption", async () => {
        await approvalStore.setCaptionCopy(this._item.id, capTa.value.trim());
        this._item.caption = capTa.value.trim();
        const fb = this.querySelector("[data-fb-caption]");
        if (fb) { fb.textContent = "✓"; setTimeout(() => { fb.textContent = ""; }, 1500); }
      });
    });
  }

  _debounceEdit(key, fn) {
    clearTimeout(this._editTimers[key]);
    this._editTimers[key] = setTimeout(fn, 500);
  }

  // Salva a edição do texto permanentemente no ficheiro HTML do post
  // via GitHub API (CloudFlare Pages Function). Modifica o h1 do slide
  // directamente no HTML e faz commit no repo — triggers auto-deploy.
  async _saveToHtmlFile(n, text) {
    const it = this._item;
    if (!it || !it.html_url) return;
    try {
      // Resolver o path relativo do html_url para path do repo
      const fullUrl = new URL(it.html_url, window.location.href).pathname;
      const repoPath = "public" + fullUrl;
      // Fetch do HTML actual (same-origin)
      const resp = await fetch(it.html_url + "?v=" + APP_VERSION + "&c=" + currentContentSig(), { cache: "no-store" });
      if (!resp.ok) return;
      const html = await resp.text();
      // Parse + modificar o h1 do slide
      const doc = new DOMParser().parseFromString(html, "text/html");
      let target = doc.querySelector(`#slide-${n} h1, #slide-${n} h2, #slide-${n} blockquote`);
      if (!target && n === 1) target = doc.querySelector("h1, h2, blockquote");
      if (!target) return;
      target.innerHTML = fmtToHtml(text);
      // Serializar de volta para HTML string
      const modifiedHtml = "<!doctype html>\n" + doc.documentElement.outerHTML;
      // Commit via API
      const apiResp = await fetch("/api/edit-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: repoPath,
          htmlContent: modifiedHtml,
          message: `edit: slide ${n} text in ${repoPath.split("/").pop()}`,
        }),
      });
      if (apiResp.ok) {
        console.log("[viewer] HTML commitado permanentemente:", repoPath);
      } else {
        console.warn("[viewer] falha ao commitar HTML:", await apiResp.text());
      }
    } catch (e) {
      console.warn("[viewer] erro ao salvar HTML:", e);
    }
  }

  _escapeForHtml(s) {
    // items.json pode conter "&nbsp;" como texto literal (não entidade HTML).
    // Decodificar antes de escapar para não mostrar "&nbsp;" na página.
    return String(s == null ? "" : s)
      .replace(/&nbsp;/g, " ")
      .replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
}

customElements.define("item-viewer", ItemViewer);
