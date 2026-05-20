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

      ${this._renderActivity(items, apr)}
    `;
  }

  _renderActivity(items, apr) {
    // Junta todas as approval rows que pertencem a items deste período +
    // anotações (chaves "{id}#note_...") cujo prefixo bate com algum item.
    // Cada row tem author + updatedAt. Mostra as últimas 5.
    const itemIds = new Set(items.map(i => i.id));
    const events = [];
    for (const [key, v] of Object.entries(apr)) {
      if (!v.updatedAt) continue;
      // chave de item exacta (aprovação/rejeição) ou chave derivada (note/caption/date/hour)
      const baseId = key.split("#")[0].split(":")[0];
      if (!itemIds.has(baseId)) continue;
      const kind = key.includes("#note_")
        ? "anotou"
        : key.endsWith(":caption")
        ? `caption ${v.status === "approved" ? "aprovada" : v.status === "rejected" ? "rejeitada" : "actualizada"}`
        : key.endsWith(":date") || key.endsWith(":hour")
        ? "reagendou"
        : v.status === "approved" ? "aprovou"
        : v.status === "rejected" ? "rejeitou"
        : "tocou em";
      events.push({
        author: v.author || "anónimo",
        kind,
        target: this._shortenId(baseId),
        when: new Date(v.updatedAt),
      });
    }
    events.sort((a, b) => b.when - a.when);
    const recent = events.slice(0, 5);
    if (recent.length === 0) {
      return `<h3 class="block-title">Actividade recente</h3>
        <p class="muted">Sem alterações registadas neste período.</p>`;
    }
    // Contribuidores únicos (top 4 por nº de acções)
    const byAuthor = {};
    for (const e of events) byAuthor[e.author] = (byAuthor[e.author] || 0) + 1;
    const contribs = Object.entries(byAuthor).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const fmt = (d) => {
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return "agora";
      if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
      return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
    };
    return `
      <h3 class="block-title">Actividade recente</h3>
      <ul class="activity-list">
        ${recent.map(e => `
          <li class="activity-row">
            <span class="activity-row__author">${this._escape(e.author)}</span>
            <span class="activity-row__verb">${e.kind}</span>
            <span class="activity-row__target">${this._escape(e.target)}</span>
            <span class="activity-row__when">${fmt(e.when)}</span>
          </li>`).join("")}
      </ul>
      <h3 class="block-title">Contribuidores</h3>
      <div class="contribs-row">
        ${contribs.map(([name, n]) => `
          <div class="contrib-card">
            <span class="contrib-card__name">${this._escape(name)}</span>
            <span class="contrib-card__count">${n} ${n === 1 ? "acção" : "acções"}</span>
          </div>`).join("")}
      </div>
    `;
  }

  _shortenId(id) {
    // techbody-2026-05-c01 → c01 · TechBody
    const parts = id.split("-");
    const code = parts[parts.length - 1];
    return code;
  }

  _escape(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
}

customElements.define("approval-stats", ApprovalStats);
