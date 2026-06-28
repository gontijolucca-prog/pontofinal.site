// <themes-catalog> — agrupa temas por marca + audience (B2C / B2B). Cada tema
// mostra theme_key, pilar, audience e descrição (título do primeiro item que
// usou o tema).
//
// Color coding por recência (quando currentMonth não é "all"):
//   verde  = tema usado no mês seleccionado
//   amarelo = tema usado em meses anteriores mas NÃO no mês seleccionado
//   default = tema só em meses futuros

const BRAND_LABEL = {
  techbody:     "TechBody",
  techbody_u:   "TechBody U",
  luiz_santana: "Luiz Santana",
};
const AUDIENCE_LABEL = { b2c: "B2C", b2b: "B2B" };

class ThemesCatalog extends HTMLElement {
  setData(themes, allItems, currentMonth) {
    this._themes = themes || [];
    this._allItems = allItems || [];
    this._currentMonth = currentMonth || "all";
    this.render();
  }

  // Determina o estado de um tema face ao mês seleccionado:
  //   "active"  — tem items no mês actual
  //   "past"    — tem items só em meses anteriores
  //   "future"  — tem items só em meses futuros
  //   "unknown" — sem items com mês (fallback)
  _themeStatus(theme) {
    const cm = this._currentMonth;
    if (cm === "all") return "active";

    const items = this._allItems.filter(it =>
      it.theme === theme.theme_key && it.brand === theme.brand
    );

    const months = new Set();
    for (const it of items) {
      const m = it.month || (it.scheduled_for || "").slice(0, 7);
      if (m && /^\d{4}-\d{2}$/.test(m)) months.add(m);
    }

    if (months.has(cm)) return "active";

    for (const m of months) {
      if (m < cm) return "past";
    }

    return months.size > 0 ? "future" : "unknown";
  }

  _legendHTML() {
    if (this._currentMonth === "all") return "";
    return `
      <div class="themes-legend" role="note">
        <span class="themes-legend__item themes-legend__item--active">
          <span class="themes-legend__dot"></span> Usado este mês
        </span>
        <span class="themes-legend__item themes-legend__item--past">
          <span class="themes-legend__dot"></span> Usado em meses anteriores
        </span>
        <span class="themes-legend__item themes-legend__item--future">
          <span class="themes-legend__dot"></span> Só em meses futuros
        </span>
      </div>
    `;
  }

  render() {
    const themes = this._themes;
    if (!themes.length) {
      this.innerHTML = `<p class="muted">Sem temas registados.</p>`;
      return;
    }

    // group: brand → audience → [themes]
    const byBrand = {};
    for (const t of themes) {
      const b = t.brand;
      const a = t.audience || "b2c";
      byBrand[b] ??= {};
      byBrand[b][a] ??= [];
      byBrand[b][a].push(t);
    }

    const legend = this._legendHTML();
    const brands = Object.keys(byBrand).sort();
    this.innerHTML = legend + brands.map(brand => {
      const audiences = byBrand[brand];
      const audKeys = Object.keys(audiences).sort();
      return `
        <section class="theme-brand">
          <h3 class="theme-brand__title">${BRAND_LABEL[brand] || brand}</h3>
          ${audKeys.map(aud => `
            <div class="theme-aud">
              <span class="theme-aud__chip theme-aud__chip--${aud}">${AUDIENCE_LABEL[aud] || aud.toUpperCase()}</span>
              <div class="theme-list">
                ${audiences[aud].map(t => {
                  const status = this._themeStatus(t);
                  const pilar = t.pilar ? `<span class="theme-card__pilar">${this._escape(t.pilar)}</span>` : "";
                  const desc = t.description ? `<p class="theme-card__desc">${this._escape(t.description)}</p>` : "";
                  return `
                    <article class="theme-card theme-card--${status}">
                      <header>
                        <span class="theme-card__key">${this._escape(t.theme_key)}</span>
                        ${pilar}
                      </header>
                      ${desc}
                    </article>
                  `;
                }).join("")}
              </div>
            </div>
          `).join("")}
        </section>
      `;
    }).join("");
  }

  _escape(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
}

customElements.define("themes-catalog", ThemesCatalog);
