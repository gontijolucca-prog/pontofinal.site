// <themes-catalog> — agrupa temas por marca + audience (B2C / B2B). Cada tema
// mostra theme_key, pilar, audience e descrição (título do primeiro item que
// usou o tema este mês — serve como exemplo do que cabe no tema).

const BRAND_LABEL = {
  techbody:     "TechBody",
  techbody_u:   "TechBody U",
  luiz_santana: "Luiz Santana",
};
const AUDIENCE_LABEL = { b2c: "B2C", b2b: "B2B" };

class ThemesCatalog extends HTMLElement {
  setData(themes) {
    this._themes = themes || [];
    this.render();
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

    const brands = Object.keys(byBrand).sort();
    this.innerHTML = brands.map(brand => {
      const audiences = byBrand[brand];
      const audKeys = Object.keys(audiences).sort();
      return `
        <section class="theme-brand">
          <h3 class="theme-brand__title">${BRAND_LABEL[brand] || brand}</h3>
          ${audKeys.map(aud => `
            <div class="theme-aud">
              <span class="theme-aud__chip theme-aud__chip--${aud}">${AUDIENCE_LABEL[aud] || aud.toUpperCase()}</span>
              <div class="theme-list">
                ${audiences[aud].map(t => `
                  <article class="theme-card">
                    <header>
                      <span class="theme-card__key">${this._escape(t.theme_key)}</span>
                      ${t.pilar ? `<span class="theme-card__pilar">${this._escape(t.pilar)}</span>` : ""}
                    </header>
                    ${t.description ? `<p class="theme-card__desc">${this._escape(t.description)}</p>` : ""}
                  </article>
                `).join("")}
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
