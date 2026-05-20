// <publish-queue> — view de publish_queue + publish_history.
// Mostra o que está agendado/publicado/falhou, com botões manuais para
// publicar-agora ou cancelar uma queued.

import { supabase } from "../lib/supabase-client.js?v=20260520c";
import { BRANDS } from "../config.js?v=20260520c";

const BRAND_LABEL = {
  techbody: "TechBody", techbody_u: "TechBody U", luiz_santana: "Luiz Santana", pontofinal: "PontoFinal",
};
const KIND_LABEL  = { carousel: "Carrossel", story: "Story", reel: "Reel" };
const STATUS_LABEL = {
  queued: "Agendado", publishing: "A publicar", published: "Publicado", failed: "Falhou",
};

class PublishQueue extends HTMLElement {
  connectedCallback() {
    this._queue = [];
    this._history = [];
    this._loading = true;
    this.render();
    this._load();
    if (!supabase) return;
    this._sub = supabase.channel("publish-queue-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "publish_queue" }, () => this._load())
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
    const [qRes, hRes] = await Promise.all([
      supabase.from("publish_queue").select("*").in("brand", BRANDS).order("scheduled_for"),
      supabase.from("publish_history").select("*").in("brand", BRANDS).order("created_at", { ascending: false }).limit(20),
    ]);
    // Feature ainda não está pronta no Supabase: tabela em falta OU schema
    // diferente do esperado (coluna não existe). Trata os dois casos.
    const featureNotReady = (err) =>
      err && /not find the table|relation .* does not exist|column .* does not exist/i.test(String(err.message || err));
    if (featureNotReady(qRes.error) || featureNotReady(hRes.error)) {
      this._notReady = true;
      this._queue = [];
      this._history = [];
      this._loading = false;
      this.render();
      return;
    }
    this._queue = qRes.data || [];
    this._history = hRes.data || [];
    this._loading = false;
    this.render();
  }

  async _cancel(row) {
    if (!confirm(`Cancelar publicação de "${row.item_id}"?`)) return;
    const { error } = await supabase.from("publish_queue").update({ status: "failed", error: "cancelled by user" }).eq("id", row.id);
    if (error) return alert("Erro: " + error.message);
    await this._load();
  }

  async _publishNow(row) {
    if (!confirm(`Publicar "${row.item_id}" agora? (precisa de tokens Meta configurados)`)) return;
    // Apenas marca scheduled_for para "agora" — o cron-trigger Edge Function
    // apanha na próxima passagem (≤5min).
    const { error } = await supabase.from("publish_queue")
      .update({ scheduled_for: new Date().toISOString(), attempts: 0, status: "queued", error: null })
      .eq("id", row.id);
    if (error) return alert("Erro: " + error.message);
    alert("Agendado para a próxima passagem do cron (~5 min).");
    await this._load();
  }

  _escape(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  _fmt(iso) {
    return iso ? new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—";
  }

  render() {
    if (this._loading) {
      this.innerHTML = `<p class="publish-queue__state">A carregar fila…</p>`;
      return;
    }
    if (this._notReady) {
      this.innerHTML = `
        <div class="placeholder-card">
          <p class="placeholder-card__title">Em breve</p>
          <p class="placeholder-card__body">
            Os items aprovados com data agendada entram aqui automaticamente
            quando ligarmos a fila de publicação Instagram à pipeline.
          </p>
        </div>`;
      return;
    }

    const counts = {
      queued:     this._queue.filter(r => r.status === "queued").length,
      publishing: this._queue.filter(r => r.status === "publishing").length,
      published:  this._queue.filter(r => r.status === "published").length,
      failed:     this._queue.filter(r => r.status === "failed").length,
    };

    if (this._queue.length === 0 && this._history.length === 0) {
      this.innerHTML = `
        <div class="publish-queue">
          <p class="publish-queue__empty">
            Sem itens na fila ainda. Cada item aprovado com data agendada entra
            automaticamente aqui assim que tu definires o trigger.
          </p>
        </div>
      `;
      return;
    }

    const rows = this._queue.map(r => this._rowHTML(r)).join("");
    const historyRows = this._history.map(h => `
      <tr>
        <td>${this._fmt(h.created_at)}</td>
        <td>${BRAND_LABEL[h.brand] || h.brand}</td>
        <td>${KIND_LABEL[h.kind] || h.kind}</td>
        <td>${h.status === "success" ? "✓" : "✗"} ${h.status}</td>
        <td>${this._escape(h.ig_post_id || h.error || "")}</td>
      </tr>
    `).join("");

    this.innerHTML = `
      <div class="publish-queue">
        <div class="publish-queue__metrics">
          <div class="pq-metric"><span class="pq-metric__n">${counts.queued}</span><span class="pq-metric__lbl">Agendados</span></div>
          <div class="pq-metric pq-metric--in"><span class="pq-metric__n">${counts.publishing}</span><span class="pq-metric__lbl">A publicar</span></div>
          <div class="pq-metric pq-metric--ok"><span class="pq-metric__n">${counts.published}</span><span class="pq-metric__lbl">Publicados</span></div>
          <div class="pq-metric pq-metric--err"><span class="pq-metric__n">${counts.failed}</span><span class="pq-metric__lbl">Falhas</span></div>
        </div>
        ${this._queue.length === 0
          ? `<p class="publish-queue__empty">Sem items agendados de momento.</p>`
          : `<ul class="publish-queue__list">${rows}</ul>`}
        ${this._history.length > 0 ? `
        <details class="publish-queue__details">
          <summary>Histórico (últimos ${this._history.length})</summary>
          <div class="publish-queue__table-wrap">
            <table class="publish-queue__table">
              <thead><tr><th>Quando</th><th>Marca</th><th>Formato</th><th>Resultado</th><th>Detalhe</th></tr></thead>
              <tbody>${historyRows}</tbody>
            </table>
          </div>
        </details>` : ""}
      </div>
    `;

    this.querySelectorAll("[data-row]").forEach(el => {
      const id = el.dataset.row;
      const row = this._queue.find(r => r.id === id);
      const action = el.dataset.action;
      el.addEventListener("click", () => {
        if (action === "cancel")      this._cancel(row);
        else if (action === "publish") this._publishNow(row);
      });
    });
  }

  _rowHTML(r) {
    return `
      <li class="publish-queue__row" data-status="${r.status}">
        <div class="publish-queue__row-main">
          <div class="publish-queue__row-head">
            <span class="publish-queue__brand">${BRAND_LABEL[r.brand] || r.brand}</span>
            <span class="publish-queue__kind">${KIND_LABEL[r.kind] || r.kind}</span>
            <span class="publish-queue__status publish-queue__status--${r.status}">${STATUS_LABEL[r.status] || r.status}</span>
          </div>
          <p class="publish-queue__item-id">${this._escape(r.item_id)}</p>
          <p class="publish-queue__meta">
            Agendado: ${this._fmt(r.scheduled_for)}
            ${r.published_at ? ` · Publicado: ${this._fmt(r.published_at)}` : ""}
            ${r.attempts > 0 ? ` · Tentativas: ${r.attempts}` : ""}
          </p>
          ${r.error ? `<p class="publish-queue__error">⚠ ${this._escape(r.error)}</p>` : ""}
        </div>
        ${r.status === "queued" ? `
          <div class="publish-queue__row-actions">
            <button class="btn btn--mini" data-row="${r.id}" data-action="publish">Publicar agora</button>
            <button class="btn btn--mini btn--danger" data-row="${r.id}" data-action="cancel">Cancelar</button>
          </div>` : ""}
      </li>
    `;
  }
}

customElements.define("publish-queue", PublishQueue);
