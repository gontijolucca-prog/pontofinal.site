// <post-tile> — cartão full-width de um story (9:16) com preview HTML AO VIVO.
// Escrever no texto muda a imagem letra a letra. Descrição editável, data/hora
// (pré-preenchida), Aprovar / Não publicar. Guarda automaticamente.

import { approvalStore } from "../stores/approval-store.js";
import { fitScaledFrame, dimsFor } from "../lib/fit-frame.js";
import { APP_VERSION } from "../config.js";
import { currentContentSig } from "../data-loader.js";
import { fmtToHtml, htmlToFmt } from "../lib/rich-text.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };
const REF_CODE = id => (id || "").split("-").pop();


function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toTimeInput(h) { if (!h) return ""; const m = String(h).match(/^(\d{1,2})[h:]?(\d{2})?/); return m ? `${m[1].padStart(2, "0")}:${m[2] || "00"}` : ""; }
function showToast(status) {
  const cfg = { approved: { icon: "✓", text: "Aprovado", color: "#2BB05F" }, rejected: { icon: "✕", text: "Não vai publicar", color: "#FF2A2A" }, pending: { icon: "↺", text: "Voltou a pendente", color: "#555" } }[status];
  if (!cfg) return;
  const t = document.createElement("div");
  t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${cfg.color};color:#fff;padding:14px 24px;font:900 14px/1 'Arial Black',sans-serif;letter-spacing:.06em;text-transform:uppercase;border:3px solid #050505;box-shadow:6px 6px 0 0 #050505;z-index:9999;display:flex;gap:10px;align-items:center;`;
  t.innerHTML = `<span style="font-size:18px">${cfg.icon}</span>${cfg.text}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity .2s,transform .2s"; t.style.opacity = "0"; t.style.transform = "translateX(-50%) translateY(10px)"; setTimeout(() => t.remove(), 220); }, 1300);
}

class PostTile extends HTMLElement {
  setItem(item) { this._item = item; this._saveTimers = {}; this.render(); this._mountStamp(); this._mountWhenSig(); window.addEventListener("approval:changed", this._onApprovalChange); }
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

  _slideValue() {
    const ov = approvalStore.getSlideCopy?.(this._item.id, 1);
    if (ov && ov.text) return ov.text;
    const s = (this._item.slides_text || [])[0];
    return s ? (s.text_overlay || s.text || "") : "";
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

  _previewFrame() { return this.querySelector(".card__preview iframe"); }
  _facade() { return this.querySelector(".card__preview [data-facade]"); }

  // FACADE → IFRAME: a página carrega com o PNG publicado (leve); o iframe ao
  // vivo nasce só na 1.ª edição de texto e substitui a imagem. Iframes eager
  // em todos os cartões matavam o load da página.
  _ensureFrame() {
    let f = this._previewFrame();
    if (f) return f;
    const wrap = this.querySelector(".card__preview");
    if (!wrap || !this._item.html_url) return null;
    f = document.createElement("iframe");
    f.title = "pré-visualização ao vivo";
    f.setAttribute("scrolling", "no");
    f.src = `${this._item.html_url}?v=${APP_VERSION}&c=${currentContentSig()}`;
    wrap.prepend(f);
    if (this._fitCleanup) this._fitCleanup();
    const [nw, nh] = dimsFor("story");
    this._fitCleanup = fitScaledFrame(wrap, nw, nh);
    f.addEventListener("load", () => {
      this._syncFrame();
      const fac = this._facade(); if (fac) fac.remove();
    });
    return f;
  }

  _headingEl() {
    const f = this._previewFrame(); if (!f) return null;
    try { const doc = f.contentDocument; if (!doc) return null; return doc.querySelector("#slide-1 h1, #slide-1 h2, #slide-1 blockquote, h1, h2, blockquote"); } catch { return null; }
  }
  // Aplica texto editável ao título do preview preservando formatação (<br>, <em>).
  _editFrameH1(text) { const t = this._headingEl(); if (t) t.innerHTML = fmtToHtml(text); }
  // Após o iframe carregar: se há edit guardado, reflecte-o já no preview (o que
  // se vê = o que vai publicado); senão, semeia o editor com a formatação original.
  _syncFrame() {
    const ta = this.querySelector("[data-slide]");
    // Se o utilizador está a escrever (o iframe nasce a meio da edição), o
    // valor vivo do editor ganha — senão perdia-se o que acabou de escrever.
    if (ta && document.activeElement === ta) { this._editFrameH1(ta.value); return; }
    const ov = approvalStore.getSlideCopy?.(this._item.id, 1);
    if (ov && ov.text) { this._editFrameH1(ov.text); if (ta) ta.value = ov.text; }
    else { const el = this._headingEl(); if (el && ta) ta.value = htmlToFmt(el); }
  }

  render() {
    const it = this._item;
    if (!it) return;
    const hasCaption = !!(it.caption && it.caption.trim());
    const titleText = esc(it.title || it.theme || "");
    this.innerHTML = `
      <article class="card card--story" data-item-id="${it.id}">
        <header class="card__head">
          <span class="card__brand">${BRAND_LABELS[it.brand] || it.brand}</span><span class="card__ref" title="Referência — usa este código para pedir alterações">${REF_CODE(it.id)}</span>
          <span class="card__type">Story</span>
          ${titleText ? `<span class="card__title-inline" title="${titleText}">${titleText}</span>` : ""}
        </header>
        <div class="card__main">
          <div class="card__left">
            <div class="card__preview card__preview--916">
              <img data-facade class="card__facade" loading="lazy" decoding="async" alt="Pré-visualização"
                src="${(it.html_url || "").replace(/\.html$/, ".jpg")}?v=${APP_VERSION}&c=${currentContentSig()}"
                onerror="this.onerror=null;this.src=this.src.replace('.jpg?','.png?')" />
              <button class="card__preview-open" data-zoom aria-label="Ver em grande" title="Ver em grande"></button>
            </div>
            <div class="card__slidebar"><button class="card__zoom" data-zoom title="Ver em grande">🔍 Ver em grande</button></div>
          </div>
          <div class="card__right">
            <div class="card__editor">
              <label class="card__label">Texto da imagem <span class="card__hint">escreve — muda já na imagem</span></label>
              <textarea class="card__text" data-slide rows="4">${esc(this._slideValue())}</textarea>
              <span class="card__fb" data-fb-slide></span>
            </div>
            ${hasCaption ? `
            <div class="card__field">
              <label class="card__label">Descrição (Instagram) <span class="card__hint">escreve para editar</span></label>
              <textarea class="card__text" data-caption rows="4">${esc(this._captionValue())}</textarea>
              <span class="card__fb" data-fb-caption></span>
            </div>` : ""}
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
    // Sem iframe no arranque: o preview é o PNG publicado (facade). O iframe
    // ao vivo (escalado a 1080×1920) nasce em _ensureFrame na 1.ª edição.
    if (this._fitCleanup) { this._fitCleanup(); this._fitCleanup = null; }
    this._bind();
  }

  _autosave(kind, fn) { clearTimeout(this._saveTimers[kind]); this._saveTimers[kind] = setTimeout(fn, 600); }

  _bind() {
    const it = this._item;
    const card = this.querySelector(".card");
    card.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-zoom]")) return this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
      if (t.closest("[data-approve]")) return this._decide("approved");
      if (t.closest("[data-reject]")) return this._decide("rejected");
    });
    const sl = this.querySelector("[data-slide]");
    if (sl) sl.addEventListener("focus", () => this._ensureFrame(), { once: true }); // aquece o iframe
    if (sl) sl.addEventListener("input", () => {
      this._ensureFrame();
      this._editFrameH1(sl.value);
      this._autosave("slide", async () => {
        await approvalStore.setSlideCopy(it.id, 1, sl.value.trim());
        const s = (it.slides_text || [])[0]; if (s) { const f = s.text_overlay != null ? "text_overlay" : "text"; s[f] = sl.value.trim(); }
        this._flash("[data-fb-slide]", "✓ guardado");
      });
    });
    const cap = this.querySelector("[data-caption]");
    if (cap) cap.addEventListener("input", () => this._autosave("caption", async () => {
      await approvalStore.setCaptionCopy(it.id, cap.value.trim()); it.caption = cap.value.trim(); this._flash("[data-fb-caption]", "✓ guardado");
    }));
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
      try { await approvalStore.setHour(it.id, v); } catch { it.hour = old; e.target.value = toTimeInput(old); return; }
      this.dispatchEvent(new CustomEvent("item:hour-changed", { bubbles: true, detail: { id: it.id, hour: v, oldHour: old } }));
    });
  }
}

customElements.define("post-tile", PostTile);
