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
      if (e.key === "Escape") return this.close();
      if (typing) return;
      if (e.key === "ArrowRight") return this._step(+1);
      if (e.key === "ArrowLeft")  return this._step(-1);
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
    this._viewMode = "live";
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
    // Preview ao vivo (iframe HTML) por defeito — o que está nos textboxes
    // reflecte-se no preview em tempo real. A imagem estática fica oculta.
    const shotBase = (it.html_url || "").replace(/\.html$/, "");
    const effSt = it.status === "published" ? "published" : (approvalStore.get(it.id)?.status || "pending");
    let frameHtml = "";
    if (isReelVideo) {
      frameHtml = `<video class="viewer-video" src="${it.video_url}${bust}" controls autoplay loop playsinline></video>`;
    } else if (isReel) {
      frameHtml = reelScriptHtml;
    } else if (isCarousel && shotBase) {
      const slideImg = `${shotBase}_shots/slide_01.jpg${bust}`;
      const iframeSrc = `${it.html_url}${bust}#slide-1`;
      frameHtml = `<img class="viewer-slide-img" src="${slideImg}" alt="${this._escapeForHtml(it.title || "")}" style="display:none" />` +
        `<iframe class="viewer-frame-iframe" src="${iframeSrc}" title="${this._escapeForHtml(it.title || "")}" scrolling="no"></iframe>`;
    } else if (it.html_url && shotBase) {
      // Story: imagem única + iframe para edição
      const storyImg = `${shotBase}.jpg${bust}`;
      const iframeSrc = `${it.html_url}${bust}`;
      frameHtml = `<img class="viewer-slide-img" src="${storyImg}" alt="${this._escapeForHtml(it.title || "")}" style="display:none" />` +
        `<iframe class="viewer-frame-iframe" src="${iframeSrc}" title="${this._escapeForHtml(it.title || "")}" scrolling="no"></iframe>`;
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
    const toggleChecked = effSt === "approved" || effSt === "published";
    const toggleDisabled = effSt === "published";

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
              <label class="toggle-approve" data-action="approve-toggle"${toggleDisabled ? " data-disabled" : ""}>
                <input type="checkbox" ${toggleChecked ? "checked" : ""} ${toggleDisabled ? "disabled" : ""} />
                <span class="toggle-approve__slider"></span>
                <span class="toggle-approve__label">Aprovado</span>
              </label>
              <button class="btn" data-action="publish" style="flex:1;padding:8px;border:2px solid var(--border);background:var(--bg);cursor:pointer;font:700 11px/1 'JetBrains Mono',monospace;text-transform:uppercase">📌 Publicado</button>
            </div>
            <p class="viewer-hint">${isCarousel ? "Desliza entre os slides com ‹ ›. " : ""}A imagem final é a referência. Clica num campo de texto para editar.</p>
          </div>
        </aside>
        <button class="viewer-close" data-action="close" aria-label="Fechar">×</button>
      </div>`;

    // fitScaledFrame: renderiza o iframe às dimensões nativas de publicação
    // (1080×1350 carrossel, 1080×1920 story) e escala visualmente para caber
    // no contentor. Garante que a pré-visualização é pixel-idêntica ao produto final.
    if (this._fitCleanup) { this._fitCleanup(); this._fitCleanup = null; }
    if (!isReel && !isReelVideo && it.html_url) {
      const fmt = it.format || "carrossel";
      const [nw, nh] = dimsFor(fmt);
      const wrap = this.querySelector(".viewer-frame-wrap");
      if (wrap) this._fitCleanup = fitScaledFrame(wrap, nw, nh);
    }

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
      if (a === "close")  return this.close();
      if (a === "prev")   return this._step(-1);
      if (a === "next")   return this._step(+1);
      if (a === "approve-toggle") {
        // Toggle switch — força gravação de texto pendente antes de mudar estado.
        const cb = this.querySelector(".toggle-approve input[type=\"checkbox\"]");
        if (!cb || cb.disabled) return;
        const newStatus = cb.checked ? "approved" : "pending";
        this._flushPendingEdits().then(() => {
          import("../stores/approval-store.js").then(m => m.approvalStore.set(this._item.id, newStatus));
          this._refreshStatusLine();
        });
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
      // ── CONFIRMAÇÃO ANTES DE AGENDAR ──
      const ok = await this._confirmSchedule(v, this._item.hour || "12h00");
      if (!ok) { e.target.value = old || ""; return; }
      this._item.scheduled_for = v;
      try { await approvalStore.setDate(this._item.id, v); }
      catch { this._item.scheduled_for = old; e.target.value = old || ""; return; }
      this.dispatchEvent(new CustomEvent("item:date-changed", { bubbles: true, detail: { id: this._item.id, date: v, oldDate: old } }));
      this._showEditToast(`Data alterada para ${v} — item precisa de re-render`);
    });

    const hourInput = this.querySelector("input[data-edit-hour]");
    if (hourInput) hourInput.addEventListener("change", async (e) => {
      const v = e.target.value; if (!v || !this._item) return;
      const old = this._item.hour; if (v === old) return;
      // ── CONFIRMAÇÃO ANTES DE AGENDAR ──
      const ok = await this._confirmSchedule(this._item.scheduled_for || "?", v);
      if (!ok) { e.target.value = old || ""; return; }
      this._item.hour = v;
      try { await approvalStore.setHour(this._item.id, v); }
      catch { this._item.hour = old; e.target.value = old || ""; return; }
      this.dispatchEvent(new CustomEvent("item:hour-changed", { bubbles: true, detail: { id: this._item.id, hour: v, oldHour: old } }));
      this._showEditToast(`Hora alterada para ${v} — item precisa de re-render`);
    });
  }



  _highlightReelLine(n) {
    if (!this._isReel) return;
    this.querySelectorAll(".viewer-reel-script__line").forEach(li => {
      li.classList.toggle("is-active", String(li.dataset.reelLine) === String(n));
    });
    const active = this.querySelector(`.viewer-reel-script__line[data-reel-line="${n}"]`);
    if (active) active.scrollIntoView({ behavior: "smooth", block: "center" });
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

  // ── PASSO 5: Confirmação antes de agendar ──────────────────────────
  async _confirmSchedule(date, hour) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.style.cssText = "position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.55);display:grid;place-items:center;padding:16px;";
      backdrop.innerHTML = `
        <div style="background:#fff;color:#050505;width:min(420px,100%);border:4px solid #050505;box-shadow:10px 10px 0 0 #050505;padding:24px 22px;font-family:'JetBrains Mono',ui-monospace,monospace;">
          <h2 style="font:800 20px/1.1 'Arial Black',Impact,sans-serif;margin:0 0 8px;">Confirmar agendamento</h2>
          <p style="font-size:13px;line-height:1.5;color:rgba(5,5,5,0.7);margin:0 0 18px;">
            Confirmar publicação para <strong>${date}</strong> às <strong>${hour}</strong>?<br><br>
            O item precisará de ser re-renderizado antes de publicar.
          </p>
          <div style="display:flex;gap:12px;">
            <button type="button" id="confirmYes" style="flex:1;padding:12px;background:#050505;color:#fff;font:800 12px/1 'Arial Black',sans-serif;letter-spacing:0.06em;text-transform:uppercase;border:3px solid #050505;cursor:pointer;">Confirmar</button>
            <button type="button" id="confirmNo" style="flex:1;padding:12px;background:#fff;color:#050505;font:800 12px/1 'Arial Black',sans-serif;letter-spacing:0.06em;text-transform:uppercase;border:3px solid #050505;cursor:pointer;">Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);
      const yes = backdrop.querySelector("#confirmYes");
      const no = backdrop.querySelector("#confirmNo");
      yes.addEventListener("click", () => { backdrop.remove(); resolve(true); });
      no.addEventListener("click", () => { backdrop.remove(); resolve(false); });
      backdrop.addEventListener("click", (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(false); } });
    });
  }

  _showEditToast(msg) {
    const t = document.createElement("div");
    t.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);max-width:min(90vw,420px);background:#f69e1e;color:#050505;padding:13px 20px;font:700 12.5px/1.4 'JetBrains Mono',ui-monospace,monospace;border:3px solid #050505;box-shadow:5px 5px 0 0 #050505;z-index:10001;text-align:center;";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.transition = "opacity .25s,transform .25s";
      t.style.opacity = "0";
      t.style.transform = "translateX(-50%) translateY(8px)";
      setTimeout(() => t.remove(), 260);
    }, 3200);
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

  // Força gravação de todas as edições pendentes nos textboxes antes de
  // aprovar. Espera que todos os debounces pendentes terminem.
  async _flushPendingEdits() {
    const timers = this._editTimers || {};
    const keys = Object.keys(timers);
    if (!keys.length) return;
    // Disparar os callbacks pendentes imediatamente.
    for (const key of keys) {
      clearTimeout(timers[key]);
      const ta = key === "caption"
        ? this.querySelector("[data-edit-caption]")
        : this.querySelector(`[data-edit-slide="${key.replace("slide-", "")}"]`);
      if (!ta) continue;
      const val = ta.value.trim();
      if (!val) continue;
      if (key === "caption") {
        await approvalStore.setCaptionCopy(this._item.id, val);
        if (this._item) this._item.caption = val;
      } else {
        const n = parseInt(key.replace("slide-", ""), 10);
        await approvalStore.setSlideCopy(this._item.id, n, val);
        if (this._item && this._item.slides_text && this._item.slides_text[n - 1]) {
          const f = this._item.slides_text[n - 1].text_overlay != null ? "text_overlay" : "text";
          this._item.slides_text[n - 1][f] = val;
        }
      }
      const fb = this.querySelector(key === "caption" ? "[data-fb-caption]" : `[data-fb-slide="${key.replace("slide-", "")}"]`);
      if (fb) { fb.textContent = "✓"; setTimeout(() => { fb.textContent = ""; }, 1500); }
    }
    this._editTimers = {};
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
