// <approval-stats> — agrega items + approvals e mostra:
//   1) Totais (aprovados / rejeitados / pendentes / taxa)
//   2) Breakdown por formato (carousel/story/reel)
//   3) Barra de % aprovação por pilar editorial

const FORMAT_LABEL = { carousel: "Carrosséis", story: "Stories", reel: "Reels" };
const FORMAT_ORDER = ["carousel", "story", "reel"];

class ApprovalStats extends HTMLElement {
  setData(items, approvals) {
    this._items = items || [];
    this._approvals = approvals || {};
    this.render();
  }

  render() {
    const items = this._items;
    const apr = this._approvals;
    if (!items.length) {
      this.innerHTML = `<p class="muted">Sem items neste período.</p>`;
      return;
    }

    // Totais
    let approved = 0, rejected = 0, pending = 0;
    for (const it of items) {
      const s = apr[it.id]?.status || "pending";
      if (s === "approved") approved++;
      else if (s === "rejected") rejected++;
      else pending++;
    }
    const decided = approved + rejected;
    const rate = decided ? Math.round((approved / decided) * 100) : 0;

    // Por formato
    const byKind = {};
    for (const k of FORMAT_ORDER) byKind[k] = { total: 0, approved: 0, rejected: 0 };
    for (const it of items) {
      const k = it.kind;
      if (!byKind[k]) continue;
      byKind[k].total++;
      const s = apr[it.id]?.status;
      if (s === "approved") byKind[k].approved++;
      else if (s === "rejected") byKind[k].rejected++;
    }

    // Por pilar
    const byPilar = {};
    for (const it of items) {
      const p = it.pilar || "(sem pilar)";
      if (!byPilar[p]) byPilar[p] = { total: 0, approved: 0 };
      byPilar[p].total++;
      if (apr[it.id]?.status === "approved") byPilar[p].approved++;
    }
    const pilars = Object.entries(byPilar).sort((a, b) => b[1].total - a[1].total);

    this.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card stat-card--approved">
          <span class="stat-card__big">${approved}</span>
          <span class="stat-card__label">Aprovados</span>
        </div>
        <div class="stat-card stat-card--rejected">
          <span class="stat-card__big">${rejected}</span>
          <span class="stat-card__label">Rejeitados</span>
        </div>
        <div class="stat-card stat-card--pending">
          <span class="stat-card__big">${pending}</span>
          <span class="stat-card__label">Pendentes</span>
        </div>
        <div class="stat-card stat-card--rate">
          <span class="stat-card__big">${rate}%</span>
          <span class="stat-card__label">Taxa de aprovação</span>
        </div>
      </div>

      <h3 class="block-title">Por formato</h3>
      <div class="format-row">
        ${FORMAT_ORDER.map(k => {
          const b = byKind[k];
          const pct = b.total ? Math.round((b.approved / b.total) * 100) : 0;
          return `
            <div class="format-card">
              <span class="format-card__name">${FORMAT_LABEL[k]}</span>
              <span class="format-card__count">${b.approved} / ${b.total}</span>
              <div class="format-card__bar"><span style="width:${pct}%"></span></div>
              <span class="format-card__pct">${pct}% aprovado</span>
            </div>
          `;
        }).join("")}
      </div>

      <h3 class="block-title">Por pilar editorial</h3>
      <div class="pilar-list">
        ${pilars.map(([name, b]) => {
          const pct = b.total ? Math.round((b.approved / b.total) * 100) : 0;
          return `
            <div class="pilar-row">
              <span class="pilar-row__name">${this._escape(name)}</span>
              <div class="pilar-row__bar"><span style="width:${pct}%"></span></div>
              <span class="pilar-row__count">${b.approved} / ${b.total}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  _escape(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
}

customElements.define("approval-stats", ApprovalStats);
