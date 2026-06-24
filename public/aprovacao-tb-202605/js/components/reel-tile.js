// <reel-tile> — cartão full-width de um reel (vídeo). Sem imagem: script linha
// a linha (editável, guarda automático), descrição, data/hora (pré-preenchida),
// Aprovar / Não publicar. "Ver tudo" abre o zoom com o script completo.

import { approvalStore } from "../stores/approval-store.js";
import { APP_VERSION } from "../config.js";
import { currentContentSig } from "../data-loader.js";

const BRAND_LABELS = { techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana" };
const REF_CODE = id => (id || "").split("-").pop();

const ROLE_LABELS = { hook: "Hook", demo: "Desenvolvimento", proof: "Prova", development: "Desenvolvimento", cta: "CTA", outro: "Fecho", intro: "Intro" };

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

class ReelTile extends HTMLElement {
  setItem(item) { this._item = item; this._sel = 0; this._saveTimers = {}; this.render(); this._mountStamp(); this._mountWhenSig(); window.addEventListener("approval:changed", this._onApprovalChange); }
  disconnectedCallback() { window.removeEventListener("approval:changed", this._onApprovalChange); }
  _onApprovalChange = () => { this._mountStamp(); this._mountWhenSig(); };

  // Mostra a assinatura da última alteração de data/hora (autor), por baixo dos
  // campos de data/hora. Atualiza em tempo real.
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

  _lineCount() { return (this._item.slides_text || []).length || 1; }
  _lineValue(n) {
    const ov = approvalStore.getSlideCopy?.(this._item.id, n);
    if (ov && ov.text) return ov.text;
    const s = (this._item.slides_text || [])[n - 1];
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
    this._mountPublished();
  }
  _mountPublished() {
    const article = this.querySelector(".card"); if (!article) return;
    const isPublished = this._item && this._item.status === "published";
    article.toggleAttribute("data-published", isPublished);
    let overlay = article.querySelector(":scope > .published-overlay");
    if (isPublished) {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "published-overlay";
        const stamp = document.createElement("span");
        stamp.className = "published-overlay__stamp";
        stamp.textContent = "PUBLICADO";
        overlay.appendChild(stamp);
        article.appendChild(overlay);
      }
    } else {
      if (overlay) overlay.remove();
    }
  }

  render() {
    const it = this._item;
    if (!it) return;
    if (it.video_url) return this._renderVideo();
    const total = this._lineCount();
    const hasCaption = !!(it.caption && it.caption.trim());
    const titleText = esc(it.title || it.theme || "");
    this.innerHTML = `
      <article class="card card--reel" data-item-id="${it.id}">
        <header class="card__head">
          <span class="card__brand">${BRAND_LABELS[it.brand] || it.brand}</span><span class="card__ref" title="Referência — usa este código para pedir alterações">${REF_CODE(it.id)}</span>
          <span class="card__type">Reel ${it.slides || 15}s · script</span>
          ${titleText ? `<span class="card__title-inline" title="${titleText}">${titleText}</span>` : ""}
        </header>
        <div class="card__slidebar">
          <button class="card__nav" data-prev aria-label="Linha anterior">‹</button>
          <span class="card__slidecount" data-linecount>Linha ${this._sel + 1} / ${total}</span>
          <button class="card__nav" data-next aria-label="Próxima linha">›</button>
          <button class="card__zoom" data-zoom title="Ver script completo">🔍 Ver tudo</button>
        </div>
        <div class="card__editor" data-line-editor></div>
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
      </article>`;
    this._renderLineEditor();
    this._bind();
  }

  // Cartão de reel com VÍDEO renderizado (9:16) à esquerda, descrição + data/hora
  // + decisão à direita. O "Ver em grande" abre o zoom com o vídeo.
  _renderVideo() {
    const it = this._item;
    const hasCaption = !!(it.caption && it.caption.trim());
    const bust = `?v=${APP_VERSION}&c=${currentContentSig()}`;
    const poster = it.video_url.replace(/\.mp4$/, ".jpg") + bust;
    const titleText = esc(it.title || it.theme || "");
    this.innerHTML = `
      <article class="card card--reel" data-item-id="${it.id}">
        <header class="card__head">
          <span class="card__brand">${BRAND_LABELS[it.brand] || it.brand}</span><span class="card__ref" title="Referência — usa este código para pedir alterações">${REF_CODE(it.id)}</span>
          <span class="card__type">Reel ${it.slides || 15}s · vídeo</span>
          ${titleText ? `<span class="card__title-inline" title="${titleText}">${titleText}</span>` : ""}
        </header>
        <div class="card__main">
          <div class="card__left">
            <div class="card__preview card__preview--916">
              <video src="${it.video_url}${bust}" poster="${poster}" controls loop playsinline preload="none"></video>
            </div>
            <div class="card__slidebar"><button class="card__zoom" data-zoom title="Ver em grande">🔍 Ver em grande</button></div>
          </div>
          <div class="card__right">
            ${hasCaption ? `
            <div class="card__field">
              <label class="card__label">Descrição (Instagram) <span class="card__hint">escreve para editar</span></label>
              <textarea class="card__text" data-caption rows="5">${esc(this._captionValue())}</textarea>
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
    const card = this.querySelector(".card");
    card.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-zoom]")) return this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
      if (t.closest("[data-approve]")) return this._decide("approved");
      if (t.closest("[data-reject]")) return this._decide("rejected");
    });
    const cap = this.querySelector("[data-caption]");
    if (cap) cap.addEventListener("input", () => this._autosave("caption", async () => {
      await approvalStore.setCaptionCopy(it.id, cap.value.trim()); it.caption = cap.value.trim(); this._flash("[data-fb-caption]", "✓ guardado");
    }));
    this._bindDateHour();
  }

  _renderLineEditor() {
    const host = this.querySelector("[data-line-editor]"); if (!host) return;
    const n = this._sel + 1;
    const role = (this._item.slides_text || [])[n - 1]?.role;
    host.innerHTML = `
      <label class="card__label">Linha ${String(n).padStart(2, "0")}${role ? ` · ${esc(ROLE_LABELS[role] || role)}` : ""} <span class="card__hint">escreve para editar</span></label>
      <textarea class="card__text" data-line rows="3">${esc(this._lineValue(n))}</textarea>
      <span class="card__fb" data-fb-line></span>`;
    const lc = this.querySelector("[data-linecount]"); if (lc) lc.textContent = `Linha ${n} / ${this._lineCount()}`;
    const ta = host.querySelector("[data-line]");
    ta.addEventListener("input", () => this._autosave("line", async () => {
      await approvalStore.setSlideCopy(this._item.id, n, ta.value.trim());
      const s = (this._item.slides_text || [])[n - 1]; if (s) { const f = s.text_overlay != null ? "text_overlay" : "text"; s[f] = ta.value.trim(); }
      this._flash("[data-fb-line]", "✓ guardado");
    }));
  }

  _selectLine(i) {
    const total = this._lineCount();
    const next = Math.max(0, Math.min(total - 1, i));
    if (next === this._sel) return;
    this._sel = next; this._renderLineEditor();
  }

  _autosave(kind, fn) { clearTimeout(this._saveTimers[kind]); this._saveTimers[kind] = setTimeout(fn, 600); }

  _bind() {
    const it = this._item;
    const card = this.querySelector(".card");
    card.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-zoom]")) return this.dispatchEvent(new CustomEvent("item:open", { bubbles: true, detail: { id: it.id } }));
      if (t.closest("[data-prev]")) return this._selectLine(this._sel - 1);
      if (t.closest("[data-next]")) return this._selectLine(this._sel + 1);
      if (t.closest("[data-approve]")) return this._decide("approved");
      if (t.closest("[data-reject]")) return this._decide("rejected");
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

customElements.define("reel-tile", ReelTile);
