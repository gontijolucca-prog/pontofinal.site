// <filter-bar> — chip groups para filtrar items por marca e formato.
// Emite `filter:change` com detail { brand, format }.
//
// Default: { brand: "all", format: "all" }.
// Aceita setOptions({ brands, formats }, current) — esconde os groups que só
// têm 1 opção (e portanto não vale a pena oferecer).

const BRAND_LABEL = {
  techbody:     "TechBody",
  techbody_u:   "TechBody U",
  luiz_santana: "Luiz Santana",
};

const FMT_LABEL = {
  carrossel: "Carrossel",
  story:     "Story",
  reel:      "Reel",
};

class FilterBar extends HTMLElement {
  connectedCallback() {
    this._brands  = [];
    this._formats = [];
    this._current = { brand: "all", format: "all" };
    this.render();
  }

  setOptions({ brands, formats }, current) {
    this._brands  = brands  || [];
    this._formats = formats || [];
    this._current = { brand: "all", format: "all", ...(current || {}) };
    this.render();
  }

  setCurrent(current) {
    this._current = { ...this._current, ...current };
    this.render();
  }

  render() {
    const brandGroupVisible  = this._brands.length  > 1;
    const formatGroupVisible = this._formats.length > 1;

    if (!brandGroupVisible && !formatGroupVisible) {
      this.innerHTML = "";
      return;
    }

    const brandChips = [
      { value: "all", label: "Todas", count: this._brands.reduce((s, b) => s + (b.count || 0), 0) },
      ...this._brands.map(b => ({ value: b.value, label: BRAND_LABEL[b.value] || b.value, count: b.count })),
    ];
    const formatChips = [
      { value: "all", label: "Todos", count: this._formats.reduce((s, f) => s + (f.count || 0), 0) },
      ...this._formats.map(f => ({ value: f.value, label: FMT_LABEL[f.value] || f.value, count: f.count })),
    ];

    const groupHTML = (axis, chips, current) => `
      <div class="filter-bar__group" data-axis="${axis}" role="tablist" aria-label="${axis === 'brand' ? 'Marca' : 'Formato'}">
        <span class="filter-bar__label">${axis === 'brand' ? 'Marca' : 'Formato'}</span>
        <div class="filter-bar__chips">
          ${chips.map(c => `
            <button
              type="button"
              class="filter-bar__chip"
              role="tab"
              aria-selected="${c.value === current}"
              data-value="${c.value}"
              data-axis="${axis}">
              <span class="filter-bar__chip-label">${c.label}</span>
              <span class="filter-bar__chip-count">${c.count}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;

    this.innerHTML = `
      <div class="filter-bar">
        ${brandGroupVisible  ? groupHTML("brand",  brandChips,  this._current.brand)  : ""}
        ${formatGroupVisible ? groupHTML("format", formatChips, this._current.format) : ""}
      </div>
    `;

    this.querySelectorAll(".filter-bar__chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const axis  = btn.dataset.axis;
        const value = btn.dataset.value;
        if (this._current[axis] === value) return;
        this._current = { ...this._current, [axis]: value };
        this.render();
        this.dispatchEvent(new CustomEvent("filter:change", {
          bubbles: true, detail: { ...this._current },
        }));
      });
    });
  }
}

customElements.define("filter-bar", FilterBar);
