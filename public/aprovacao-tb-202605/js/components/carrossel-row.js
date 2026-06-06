// <carrossel-row> — cartão full-width com preview HTML AO VIVO. Escrever no
// texto muda a imagem letra a letra (iframe same-origin). Tira de miniaturas
// para saltar entre slides; descrição editável; data/hora; Aprovar / Não
// publicar. Guarda automaticamente (sem botão). Zoom só em último caso.

import { approvalStore } from "../stores/approval-store.js";
import { APP_VERSION } from "../config.js";
import { currentContentSig } from "../data-loader.js";
import { fitScaledFrame, dimsFor } from "../lib/fit-frame.js";
import { fmtToHtml, htmlToFmt } from "../lib/rich-text.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };
const REF_CODE = id => (id || "").split("-").pop();


function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// "09h" / "17h" / "9h30" → "09:00" / "17:00" / "09:30" (formato do input time).
function toTimeInput(h) {
  if (!h) return "";
  const m = String(h).match(/^(\d{1,2})[h:]?(\d{2})?/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2] || "00"}`;
}
function showToast(status) {
  const cfg = { approved: { icon: "✓", text: "Aprovado", color: "#2BB05F" }, rejected: { icon: "✕", text: "Não vai publicar", color: "#FF2A2A" }, pending: { icon: "↺", text: "Voltou a pendente", color: "#555" } }[status];
  if (!cfg) return;
  const t = document.createElement("div");
  t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${cfg.color};color:#fff;padding:14px 24px;font:900 14px/1 'Arial Black',sans-serif;letter-spacing:.06em;text-transform:uppercase;border:3px solid #050505;box-shadow:6px 6px 0 0 #050505;z-index:9999;display:flex;gap:10px;align-items:center;`;
  t.innerHTML = `<span style="font-size:18px">${cfg.icon}</span>${cfg.text}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity .2s,transform .2s"; t.style.opacity = "0"; t.style.transform = "translateX(-50%) translateY(10px)"; setTimeout(() => t.remove(), 220); }, 1300);
}

class CarrosselRow extends HTMLElement {
  setItem(item) {
    this._item = item;
    this._sel = 0;
    this._saveTimers = {};
    this.render();
    this._mountStamp();
    this._mountWhenSig();
    window.addEventListener("approval:changed", this._onApprovalChange);
  }
  disconnectedCallback() { window.removeEventListener("approval:changed", this._onApprovalChange); if (this._fitCleanup) this._fitCleanup(); }
  _onApprovalChange = () => { this._mountStamp(); this._mountWhenSig(); };

  _mountWhenSig() {
    const when = this.querySelector(".card__when"); if (!when) return;
    const existing = this.querySelector(".card__when-sig");
    const m = approvalStore.getWhenMeta?.(this._item.id);
    if (!m || !m.author) { if (existing) existing.remove(); return; }
    const sig = existing || document.createElement("span");
    sig.className = "card__when-sig";
    sig.textContent = `🕒 reagendado por ${m.author}`;
    if (!existing) when.after(sig);
  }

  _slideCount() { const it = this._item; return (it.slides_text && it.slides_text.length) || it.slides || 6; }
  _slideValue(n) {
    const ov = approvalStore.getSlideCopy?.(this._item.id, n);
    if (ov && ov.text) return ov.text;
    const s = (this._item.slides_text || [])[n - 1];
    return s ? (s.text_overlay || s.text || "") : "";
  }
  // Valor do texto secundário: override guardado, senão o texto vivo do
  // elemento .slide__hook (o items.json não guarda este texto — vive no HTML).
  _hookValue(n) {
    const ov = approvalStore.getSlideHookCopy?.(this._item.id, n);
    if (ov && ov.text) return ov.text;
    const el = this._hookEl(n);
    return el ? htmlToFmt(el) : "";
  }
  _captionValue() {
    const ov = approvalStore.getCaptionCopy?.(this._item.id);
    if (ov && ov.text) return ov.text;
    return this._item.caption || "";
  }

  _mountStamp() {
    if (!this._item) return;
    const article = this.querySelector(".card"); if (!article) return;
    const state = approvalStore.get(this._item.id);
    let stamp = article.querySelector(":scope > .status-stamp");
    if (state.status === "pending") { if (stamp) stamp.remove(); article.removeAttribute("data-status"); }
    else {
      article.setAttribute("data-status", state.status);
      const label = state.status === "approved" ? "Aprovado" : "Não publicar";
      if (!stamp) { stamp = document.createElement("span"); article.prepend(stamp); }
      stamp.textContent = label; stamp.className = `status-stamp status-stamp--${state.status}`;
      if (state.author) { stamp.setAttribute("data-author", `${label} por ${state.author}`); stamp.setAttribute("tabindex", "0"); }
    }
    const ap = article.querySelector('[data-approve]'); const rj = article.querySelector('[data-reject]');
    if (ap) ap.setAttribute("aria-pressed", state.status === "approved" ? "true" : "false");
    if (rj) rj.setAttribute("aria-pressed", state.status === "rejected" ? "true" : "false");
  }

  // Iframe de preview ao vivo do slide seleccionado.
  _previewFrame() { return this.querySelector(".card__preview iframe"); }
  _headingEl(n) {
    const f = this._previewFrame(); if (!f) return null;
    try {
      const doc = f.contentDocument; if (!doc) return null;
      let t = doc.querySelector(`#slide-${n} h1, #slide-${n} h2, #slide-${n} blockquote`);
      if (!t && n === 1) t = doc.querySelector("h1, h2, blockquote");
      return t;
    } catch { return null; }
  }
  // Aplica texto editável ao título do slide preservando formatação (<br>, <em>).
  _editFrameH1(n, text) { const t = this._headingEl(n); if (t) t.innerHTML = fmtToHtml(text); }
  // Texto SECUNDÁRIO do slide (.slide__hook) — a linha pequena por baixo do
  // título. Só existe em alguns slides (ex.: slide 1 do Luiz). null se não há.
  _hookEl(n) {
    const f = this._previewFrame(); if (!f) return null;
    try { const doc = f.contentDocument; return doc ? doc.querySelector(`#slide-${n} .slide__hook`) : null; }
    catch { return null; }
  }
  _editFrameHook(n, text) { const t = this._hookEl(n); if (t) t.innerHTML = fmtToHtml(text); }
  _scrollFrameTo(n) {
    const f = this._previewFrame(); if (!f) return;
    try {
      const doc = f.contentDocument; const el = doc && doc.getElementById(`slide-${n}`);
      // NÃO usar scrollIntoView aqui: propaga aos ancestors same-origin e
      // scrollava a página principal até ao tile em cada load de iframe
      // (página "fugia" do calendário no refresh). O scroller real é a div
      // .carousel (overflow-x) — scrollTo nela não propaga ao parent. A janela
      // do iframe não scrolla (scrollBy nela era no-op: setas "mortas").
      if (el) {
        const sc = doc.querySelector(".carousel");
        if (sc) sc.scrollTo({ left: el.offsetLeft, top: 0 });
        else f.contentWindow.scrollTo(el.offsetLeft, el.offsetTop);
      }
    } catch {}
  }
  // Após load/navegação: se há edit guardado, reflecte-o no preview; senão NÃO
  // toca no título original (preserva a formatação de origem) e semeia o editor
  // com essa formatação (marcadores) para edições futuras a manterem.
  _applyCurrentToFrame() {
    const n = this._sel + 1;
    this._scrollFrameTo(n);
    const ov = approvalStore.getSlideCopy?.(this._item.id, n);
    const ta = this.querySelector("[data-slide]");
    if (ov && ov.text) { this._editFrameH1(n, ov.text); if (ta) ta.value = ov.text; }
    else { const el = this._headingEl(n); if (el && ta) ta.value = htmlToFmt(el); }
    // Texto secundário (.slide__hook): o iframe pode só agora ter carregado, por
    // isso o campo pode ainda não existir — re-render do editor se a presença mudou.
    const hookEl = this._hookEl(n);
    if (!!hookEl !== !!this.querySelector("[data-slide-hook]")) this._renderSlideEditor();
    if (hookEl) {
      const hov = approvalStore.getSlideHookCopy?.(this._item.id, n);
      const th = this.querySelector("[data-slide-hook]");
      if (hov && hov.text) { this._editFrameHook(n, hov.text); if (th) th.value = hov.text; }
      else if (th) { th.value = htmlToFmt(hookEl); }
    }
  }

  render() {
    const it = this._item;
    if (!it) return;
    const total = this._slideCount();
    const shotBase = (it.html_url || "").replace(/\.html$/, "");
    const thumbs = Array.from({ length: total }).map((_, i) => {
      const n = String(i + 1).padStart(2, "0");
      const png = `${shotBase}_shots/slide_${n}.png?v=${APP_VERSION}&c=${currentContentSig()}`;
      const jpg = `${shotBase}_shots/slide_${n}.jpg?v=${APP_VERSION}&c=${currentContentSig()}`;
      return `<button class="card-thumb${i === this._sel ? " is-sel" : ""}" data-thumb="${i}" aria-label="Slide ${i + 1}">
        <img loading="lazy" decoding="async" src="${png}" alt="Slide ${i + 1}" onerror="this.onerror=null;this.src='${jpg}'" /><span class="card-thumb__n">${i + 1}</span>
      </button>`;
    }).join("");

    this.innerHTML = `
      <article class="card card--carousel" data-item-id="${it.id}">
        <header class="card__head">
          <span class="card__brand">${BRAND_LABELS[it.brand] || it.brand}</span><span class="card__ref" title="Referência — usa este código para pedir alterações">${REF_CODE(it.id)}</span>
          <span class="card__type">Carrossel · ${total} slides</span>
          ${it.audience ? `<span class="tag tag--solid">${String(it.audience).toUpperCase()}</span>` : ""}
        </header>
        <div class="card__main">
          <div class="card__left">
            <div class="card__preview card__preview--45">
              <iframe loading="lazy" src="${it.html_url}?v=${APP_VERSION}&c=${currentContentSig()}" title="pré-visualização ao vivo" scrolling="no"></iframe>
              <button class="card__preview-open" data-zoom aria-label="Ver em grande" title="Ver em grande"></button>
            </div>
            <div class="card__slidebar">
              <button class="card__nav" data-prev aria-label="Slide anterior">‹</button>
              <span class="card__slidecount" data-slidecount>Slide ${this._sel + 1} / ${total}</span>
              <button class="card__nav" data-next aria-label="Próximo slide">›</button>
              <button class="card__zoom" data-zoom title="Ver em grande">🔍</button>
            </div>
            <div class="card__thumbs">${thumbs}</div>
          </div>
          <div class="card__right">
            <div class="card__editor" data-slide-editor></div>
            <div class="card__field">
              <label class="card__label">Descrição (Instagram) <span class="card__hint">escreve para editar</span></label>
              <textarea class="card__text" data-caption rows="5">${esc(this._captionValue())}</textarea>
              ${it.hashtags ? `<pre class="card__hashtags">${esc(it.hashtags)}</pre>` : ""}
              <span class="card__fb" data-fb-caption></span>
            </div>
            <div class="card__when">
              <label class="card__when-item">📅 <input type="date" data-edit-date value="${it.scheduled_for || ""}" /></label>
              <label class="card__when-item">🕒 <input type="time" data-edit-hour value="${toTimeInput(it.hour)}" /></label>
            </div>
            <div class="card__decide">
              <button class="btn btn--approve card__approve" data-approve>✓ Aprovar</button>
              <button class="card__reject" data-reject>Não publicar</button>
            </div>
          </div>
        </div>
      </article>`;

    // Preview ao vivo: escala o iframe à dimensão exacta de publicação
    // (1080×1350) para que vw/vh batam certo com a imagem final.
    if (this._fitCleanup) this._fitCleanup();
    const wrap = this.querySelector(".card__preview");
    const [nw, nh] = dimsFor("carousel");
    if (wrap) this._fitCleanup = fitScaledFrame(wrap, nw, nh);
    const f = this._previewFrame();
    if (f) f.addEventListener("load", () => this._applyCurrentToFrame(), { once: false });

    this._renderSlideEditor();
    this._bind();
  }

  _renderSlideEditor() {
    const host = this.querySelector("[data-slide-editor]");
    if (!host) return;
    const n = this._sel + 1;
    const hasHook = !!this._hookEl(n);
    const mainLabel = hasHook ? `Texto principal do slide ${String(n).padStart(2, "0")}` : `Texto do slide ${String(n).padStart(2, "0")}`;
    const mainHint = hasHook ? "o texto grande" : "escreve — muda já na imagem";
    host.innerHTML = `
      <label class="card__label">${mainLabel} <span class="card__hint">${mainHint}</span></label>
      <textarea class="card__text" data-slide rows="4">${esc(this._slideValue(n))}</textarea>
      <span class="card__fb" data-fb-slide></span>` +
      (hasHook ? `
      <label class="card__label">Texto secundário <span class="card__hint">a linha mais pequena, por baixo</span></label>
      <textarea class="card__text" data-slide-hook rows="3">${esc(this._hookValue(n))}</textarea>
      <span class="card__fb" data-fb-hook></span>` : ``);
    const sc = this.querySelector("[data-slidecount]"); if (sc) sc.textContent = `Slide ${n} / ${this._slideCount()}`;
    this.querySelectorAll(".card-thumb").forEach((b, i) => b.classList.toggle("is-sel", i === this._sel));
    const ta = host.querySelector("[data-slide]");
    ta.addEventListener("input", () => {
      this._editFrameH1(n, ta.value);                       // live: muda a imagem letra a letra
      this._autosave("slide", () => this._saveSlide(n, ta.value));
    });
    const th = host.querySelector("[data-slide-hook]");
    if (th) th.addEventListener("input", () => {
      this._editFrameHook(n, th.value);                     // live: muda o texto pequeno
      this._autosave("hook", () => this._saveSlideHook(n, th.value));
    });
  }

  _selectSlide(i) {
    const total = this._slideCount();
    const next = Math.max(0, Math.min(total - 1, i));
    if (next === this._sel) return;
    this._sel = next;
    this._renderSlideEditor();
    this._applyCurrentToFrame();
  }

  _autosave(kind, fn) {
    clearTimeout(this._saveTimers[kind]);
    this._saveTimers[kind] = setTimeout(fn, 600);
  }
  async _saveSlide(n, text) {
    await approvalStore.setSlideCopy(this._item.id, n, text.trim());
    const idx = n - 1; const s = (this._item.slides_text || [])[idx];
    if (s) { const f = s.text_overlay != null ? "text_overlay" : "text"; s[f] = text.trim(); }
    this._flash("[data-fb-slide]", "✓ guardado");
  }
  async _saveSlideHook(n, text) {
    // O texto secundário não tem campo no items.json (vive no HTML) — guarda-se
    // só como override no store; o produtor aplica-o ao HTML no re-render.
    await approvalStore.setSlideHookCopy(this._item.id, n, text.trim());
    this._flash("[data-fb-hook]", "✓ guardado");
  }
  async _saveCaption(text) {
    await approvalStore.setCaptionCopy(this._item.id, text.trim());
    this._item.caption = text.trim();
    this._flash("[data-fb-caption]", "✓ guardado");
  }

  _bind() {
    const it = this._item;
    const card = this.querySelector(".card");
    card.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-zoom]")) return this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
      const thumb = t.closest("[data-thumb]"); if (thumb) return this._selectSlide(parseInt(thumb.dataset.thumb, 10));
      if (t.closest("[data-prev]")) return this._selectSlide(this._sel - 1);
      if (t.closest("[data-next]")) return this._selectSlide(this._sel + 1);
      if (t.closest("[data-approve]")) return this._decide("approved");
      if (t.closest("[data-reject]")) return this._decide("rejected");
    });
    const cap = this.querySelector("[data-caption]");
    if (cap) cap.addEventListener("input", () => this._autosave("caption", () => this._saveCaption(cap.value)));
    this._bindDateHour();
  }

  _flash(sel, msg) { const el = this.querySelector(sel); if (!el) return; el.textContent = msg; el.classList.add("is-ok"); clearTimeout(this._fbT); this._fbT = setTimeout(() => { el.textContent = ""; el.classList.remove("is-ok"); }, 2000); }

  async _decide(desired) {
    const current = approvalStore.get(this._item.id).status;
    const final = current === desired ? "pending" : desired;
    await approvalStore.set(this._item.id, final);
    showToast(final); this._mountStamp();
  }

  _bindDateHour() {
    const it = this._item;
    const di = this.querySelector("input[data-edit-date]");
    if (di) di.addEventListener("change", async (e) => {
      const v = e.target.value; if (!v || v === it.scheduled_for) return; const old = it.scheduled_for; it.scheduled_for = v;
      try { await approvalStore.setDate(it.id, v); } catch { it.scheduled_for = old; e.target.value = old || ""; return; }
      this.dispatchEvent(new CustomEvent("item:date-changed", { bubbles: true, detail: { id: it.id, date: v, oldDate: old } }));
    });
    const hi = this.querySelector("input[data-edit-hour]");
    if (hi) hi.addEventListener("change", async (e) => {
      const v = e.target.value; if (!v || v === it.hour) return; const old = it.hour; it.hour = v;
      try { await approvalStore.setHour(it.id, v); } catch { it.hour = old; e.target.value = old || ""; return; }
      this.dispatchEvent(new CustomEvent("item:hour-changed", { bubbles: true, detail: { id: it.id, hour: v, oldHour: old } }));
    });
  }
}

customElements.define("carrossel-row", CarrosselRow);
