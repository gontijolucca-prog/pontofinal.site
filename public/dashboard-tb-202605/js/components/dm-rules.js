// <dm-rules> — CRUD básico das regras DM (tabela dm_rules no Supabase).
// Permite ao admin: ver, activar/desactivar, editar texto, criar nova regra.
//
// Schema dm_rules:
//   id (uuid), brand, trigger_kind, trigger_value, match_mode, case_sensitive,
//   action_kind, action_payload (jsonb {text?, link?}), active, notes

import { supabase } from "../lib/supabase-client.js?v=20260520b";
import { BRANDS } from "../config.js?v=20260520b";

const TRIGGER_KIND_LABEL = {
  comment_keyword: "Comentário com palavra-chave",
  dm_keyword:      "DM com palavra-chave",
  first_dm:        "Primeira DM (qualquer)",
  new_follower:    "Novo seguidor (não suportado)",
};

const ACTION_KIND_LABEL = {
  send_dm:           "Enviar DM",
  send_dm_with_link: "Enviar DM com link",
};

const BRAND_LABEL = {
  techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana", pontofinal: "PontoFinal",
};

class DmRules extends HTMLElement {
  connectedCallback() {
    this._rules = [];
    this._loading = true;
    this._editing = null;
    this.render();
    this._load();
  }

  async _load() {
    this._loading = true;
    this.render();
    if (!supabase) {
      this._rules = [];
      this._loading = false;
      this._error = "Sem ligação ao Supabase (modo dev).";
      this.render();
      return;
    }
    const { data, error } = await supabase
      .from("dm_rules")
      .select("*")
      .in("brand", BRANDS)
      .order("created_at", { ascending: false });
    if (error) {
      // Tabela ainda não existe (Phase 2 do roadmap Supabase) — degrade amistoso
      const msg = String(error.message || error);
      if (/not find the table|relation .* does not exist|column .* does not exist/i.test(msg)) {
        this._notReady = true;
        this._rules = [];
        this._loading = false;
        this._error = null;
        this.render();
        return;
      }
      this._error = msg;
      this._loading = false;
      this.render();
      return;
    }
    this._rules = data || [];
    this._error = null;
    this._loading = false;
    this.render();
  }

  async _toggleActive(rule) {
    const { error } = await supabase
      .from("dm_rules")
      .update({ active: !rule.active })
      .eq("id", rule.id);
    if (error) return alert("Erro: " + error.message);
    rule.active = !rule.active;
    this.render();
  }

  async _save(formData) {
    const payload = {
      brand: formData.brand,
      trigger_kind: formData.trigger_kind,
      trigger_value: formData.trigger_value || null,
      match_mode: formData.match_mode || "contains",
      case_sensitive: formData.case_sensitive === "on",
      action_kind: formData.action_kind,
      action_payload: { text: formData.action_text, link: formData.action_link || undefined },
      active: formData.active === "on",
      notes: formData.notes || null,
    };
    let op;
    if (this._editing?.id) {
      op = supabase.from("dm_rules").update(payload).eq("id", this._editing.id);
    } else {
      op = supabase.from("dm_rules").insert(payload);
    }
    const { error } = await op;
    if (error) return alert("Erro a guardar: " + error.message);
    this._editing = null;
    await this._load();
  }

  async _delete(rule) {
    if (!confirm(`Apagar regra "${rule.notes || rule.trigger_value || rule.id}"?`)) return;
    const { error } = await supabase.from("dm_rules").delete().eq("id", rule.id);
    if (error) return alert("Erro: " + error.message);
    await this._load();
  }

  _openEditor(rule) {
    this._editing = rule || { brand: BRANDS[0], trigger_kind: "comment_keyword", action_kind: "send_dm", active: false, action_payload: {} };
    this.render();
  }

  _escape(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  render() {
    if (this._loading) {
      this.innerHTML = `<p class="dm-rules__state">A carregar regras…</p>`;
      return;
    }
    if (this._notReady) {
      this.innerHTML = `
        <div class="placeholder-card">
          <p class="placeholder-card__title">Em breve</p>
          <p class="placeholder-card__body">
            O bot de DM começa a operar assim que ligarmos a conta Instagram
            Business e o webhook Meta. As regras serão configuráveis a partir
            deste painel.
          </p>
        </div>`;
      return;
    }
    if (this._error) {
      this.innerHTML = `<p class="dm-rules__state dm-rules__state--err">Erro: ${this._escape(this._error)}</p>`;
      return;
    }

    const editorHTML = this._editing ? this._editorHTML() : "";
    const rows = this._rules.map(r => this._rowHTML(r)).join("");

    this.innerHTML = `
      <div class="dm-rules">
        <div class="dm-rules__toolbar">
          <button type="button" class="btn btn--primary" data-action="new">+ Nova regra</button>
          <span class="dm-rules__count">${this._rules.length} regras (${this._rules.filter(r => r.active).length} activas)</span>
        </div>
        ${this._rules.length === 0
          ? `<p class="dm-rules__empty">Sem regras configuradas. Cria a primeira para o bot saber como responder.</p>`
          : `<ul class="dm-rules__list">${rows}</ul>`}
        ${editorHTML}
      </div>
    `;

    this.querySelector("[data-action='new']")?.addEventListener("click", () => this._openEditor(null));
    this.querySelectorAll("[data-rule]").forEach(el => {
      const id = el.dataset.rule;
      const rule = this._rules.find(r => r.id === id);
      const action = el.dataset.action;
      el.addEventListener("click", () => {
        if (action === "toggle") this._toggleActive(rule);
        else if (action === "edit") this._openEditor(rule);
        else if (action === "delete") this._delete(rule);
      });
    });
    if (this._editing) {
      const form = this.querySelector("form.dm-rules__form");
      form?.addEventListener("submit", e => {
        e.preventDefault();
        const fd = Object.fromEntries(new FormData(form).entries());
        this._save(fd);
      });
      this.querySelector("[data-action='cancel']")?.addEventListener("click", () => {
        this._editing = null;
        this.render();
      });
    }
  }

  _rowHTML(r) {
    const trigger = r.trigger_value
      ? `${TRIGGER_KIND_LABEL[r.trigger_kind] || r.trigger_kind}: "${this._escape(r.trigger_value)}"`
      : (TRIGGER_KIND_LABEL[r.trigger_kind] || r.trigger_kind);
    const action = `${ACTION_KIND_LABEL[r.action_kind] || r.action_kind}`;
    const preview = r.action_payload?.text || r.action_payload?.link || "—";
    return `
      <li class="dm-rules__row" data-active="${r.active}">
        <div class="dm-rules__row-main">
          <div class="dm-rules__row-head">
            <span class="dm-rules__brand">${BRAND_LABEL[r.brand] || r.brand}</span>
            <span class="dm-rules__status">${r.active ? "ACTIVA" : "inactiva"}</span>
          </div>
          <p class="dm-rules__trigger">${this._escape(trigger)}</p>
          <p class="dm-rules__action">→ ${action}: <em>"${this._escape(preview)}"</em></p>
          ${r.notes ? `<p class="dm-rules__notes">${this._escape(r.notes)}</p>` : ""}
        </div>
        <div class="dm-rules__row-actions">
          <button class="btn btn--mini" data-rule="${r.id}" data-action="toggle">${r.active ? "Desactivar" : "Activar"}</button>
          <button class="btn btn--mini" data-rule="${r.id}" data-action="edit">Editar</button>
          <button class="btn btn--mini btn--danger" data-rule="${r.id}" data-action="delete">Apagar</button>
        </div>
      </li>
    `;
  }

  _editorHTML() {
    const r = this._editing;
    const isNew = !r.id;
    return `
      <form class="dm-rules__form">
        <h3>${isNew ? "Nova regra" : "Editar regra"}</h3>
        <label>Marca
          <select name="brand" required>
            ${BRANDS.map(b => `<option value="${b}" ${b === r.brand ? "selected" : ""}>${BRAND_LABEL[b] || b}</option>`).join("")}
          </select>
        </label>
        <label>Tipo de gatilho
          <select name="trigger_kind" required>
            ${Object.entries(TRIGGER_KIND_LABEL).filter(([k]) => k !== "new_follower").map(([k, lbl]) =>
              `<option value="${k}" ${k === r.trigger_kind ? "selected" : ""}>${lbl}</option>`).join("")}
          </select>
        </label>
        <label>Palavra-chave (ex: "preço", "EU")
          <input type="text" name="trigger_value" value="${this._escape(r.trigger_value || "")}" />
        </label>
        <label>Modo de match
          <select name="match_mode">
            <option value="contains" ${r.match_mode === "contains" ? "selected" : ""}>contém</option>
            <option value="exact" ${r.match_mode === "exact" ? "selected" : ""}>igual a</option>
            <option value="starts_with" ${r.match_mode === "starts_with" ? "selected" : ""}>começa por</option>
          </select>
        </label>
        <label class="dm-rules__checkbox">
          <input type="checkbox" name="case_sensitive" ${r.case_sensitive ? "checked" : ""} />
          Diferenciar maiúsculas/minúsculas
        </label>
        <label>Tipo de acção
          <select name="action_kind" required>
            ${Object.entries(ACTION_KIND_LABEL).map(([k, lbl]) =>
              `<option value="${k}" ${k === r.action_kind ? "selected" : ""}>${lbl}</option>`).join("")}
          </select>
        </label>
        <label>Texto da DM
          <textarea name="action_text" rows="3" required>${this._escape(r.action_payload?.text || "")}</textarea>
        </label>
        <label>Link (opcional)
          <input type="url" name="action_link" value="${this._escape(r.action_payload?.link || "")}" />
        </label>
        <label>Notas internas (não enviadas)
          <input type="text" name="notes" value="${this._escape(r.notes || "")}" />
        </label>
        <label class="dm-rules__checkbox">
          <input type="checkbox" name="active" ${r.active ? "checked" : ""} />
          Activar imediatamente
        </label>
        <div class="dm-rules__form-actions">
          <button type="button" class="btn btn--mini" data-action="cancel">Cancelar</button>
          <button type="submit" class="btn btn--primary">Guardar</button>
        </div>
      </form>
    `;
  }
}

customElements.define("dm-rules", DmRules);
