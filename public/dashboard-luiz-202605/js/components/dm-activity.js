// <dm-activity> — view read-only de dm_events + dm_outbound (últimos 30
// eventos). Vazio até o bot arrancar. Realtime via Supabase channel.

import { supabase } from "../lib/supabase-client.js?v=20260520b";
import { BRANDS } from "../config.js?v=20260520b";

const EVENT_LABEL = {
  message: "DM recebida",
  comment: "Comentário",
  follow:  "Novo seguidor",
  reaction: "Reacção",
};

const BRAND_LABEL = {
  techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana", pontofinal: "PontoFinal",
};

class DmActivity extends HTMLElement {
  connectedCallback() {
    this._events = [];
    this._outbound = [];
    this._loading = true;
    this.render();
    this._load();
    if (!supabase) return;
    this._sub = supabase.channel("dm-activity")
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_events" }, () => this._load())
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_outbound" }, () => this._load())
      .subscribe();
  }

  disconnectedCallback() {
    if (this._sub && supabase) supabase.removeChannel(this._sub);
  }

  async _load() {
    if (!supabase) {
      this._loading = false;
      this.render();
      return;
    }
    const [evRes, outRes] = await Promise.all([
      supabase.from("dm_events").select("*").in("brand", BRANDS).order("received_at", { ascending: false }).limit(30),
      supabase.from("dm_outbound").select("*").in("brand", BRANDS).order("sent_at", { ascending: false }).limit(30),
    ]);
    const featureNotReady = (err) =>
      err && /not find the table|relation .* does not exist|column .* does not exist/i.test(String(err.message || err));
    if (featureNotReady(evRes.error) || featureNotReady(outRes.error)) {
      this._notReady = true;
      this._events = [];
      this._outbound = [];
      this._loading = false;
      this.render();
      return;
    }
    this._events = evRes.data || [];
    this._outbound = outRes.data || [];
    this._loading = false;
    this.render();
  }

  _escape(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  _fmt(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
  }

  render() {
    if (this._loading) {
      this.innerHTML = `<p class="dm-activity__state">A carregar actividade…</p>`;
      return;
    }
    if (this._notReady) {
      this.innerHTML = `
        <div class="placeholder-card">
          <p class="placeholder-card__title">Em breve</p>
          <p class="placeholder-card__body">
            O registo de eventos e DMs enviadas começa assim que o webhook Meta
            estiver ligado.
          </p>
        </div>`;
      return;
    }
    const ev = this._events.length;
    const out = this._outbound.length;
    const sent = this._outbound.filter(o => o.status === "sent").length;
    const failed = this._outbound.filter(o => o.status === "failed").length;

    this.innerHTML = `
      <div class="dm-activity">
        <div class="dm-activity__metrics">
          <div class="dm-activity__metric"><span class="dm-activity__metric-n">${ev}</span><span class="dm-activity__metric-lbl">eventos recebidos</span></div>
          <div class="dm-activity__metric"><span class="dm-activity__metric-n">${sent}</span><span class="dm-activity__metric-lbl">DM enviadas</span></div>
          <div class="dm-activity__metric dm-activity__metric--err"><span class="dm-activity__metric-n">${failed}</span><span class="dm-activity__metric-lbl">falhas</span></div>
        </div>
        ${ev === 0 && out === 0
          ? `<p class="dm-activity__empty">Sem actividade ainda. O bot começa a registar assim que o webhook Meta estiver ligado.</p>`
          : this._tablesHTML()}
      </div>
    `;
  }

  _tablesHTML() {
    const eventsHTML = this._events.map(e => `
      <tr>
        <td>${this._fmt(e.received_at)}</td>
        <td>${BRAND_LABEL[e.brand] || e.brand || "—"}</td>
        <td>${EVENT_LABEL[e.event_kind] || e.event_kind}</td>
        <td>${this._escape(e.ig_username || e.ig_user_id || "—")}</td>
        <td>${e.processed ? "✓" : "—"}</td>
      </tr>
    `).join("");
    const outboundHTML = this._outbound.map(o => `
      <tr>
        <td>${this._fmt(o.sent_at)}</td>
        <td>${BRAND_LABEL[o.brand] || o.brand}</td>
        <td>${this._escape(o.to_user_id || "—")}</td>
        <td>${this._escape((o.message || "").slice(0, 60))}${(o.message || "").length > 60 ? "…" : ""}</td>
        <td><span class="dm-activity__status dm-activity__status--${o.status}">${o.status}</span></td>
      </tr>
    `).join("");
    return `
      <details class="dm-activity__details" open>
        <summary>Eventos recebidos (${this._events.length})</summary>
        <div class="dm-activity__table-wrap">
          <table class="dm-activity__table">
            <thead><tr><th>Quando</th><th>Marca</th><th>Tipo</th><th>Utilizador</th><th>Processado</th></tr></thead>
            <tbody>${eventsHTML || `<tr><td colspan="5" class="dm-activity__empty">—</td></tr>`}</tbody>
          </table>
        </div>
      </details>
      <details class="dm-activity__details">
        <summary>DM enviadas (${this._outbound.length})</summary>
        <div class="dm-activity__table-wrap">
          <table class="dm-activity__table">
            <thead><tr><th>Quando</th><th>Marca</th><th>Para</th><th>Mensagem</th><th>Estado</th></tr></thead>
            <tbody>${outboundHTML || `<tr><td colspan="5" class="dm-activity__empty">—</td></tr>`}</tbody>
          </table>
        </div>
      </details>
    `;
  }
}

customElements.define("dm-activity", DmActivity);
