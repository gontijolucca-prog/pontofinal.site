// <month-switcher> — chip group para filtrar dashboard por mês.
// Emite `month:change` com detail { month: "2026-05" | "all" }.

const MONTH_LABEL = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
  5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
  9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

export function monthShortLabel(yyyymm) {
  const [y, m] = yyyymm.split("-").map(s => parseInt(s, 10));
  if (!y || !m) return yyyymm;
  return `${MONTH_LABEL[m] || m} ${String(y).slice(2)}`;
}

class MonthSwitcher extends HTMLElement {
  connectedCallback() {
    this._months = [];
    this._current = "all";
    this.render();
  }

  setMonths(months, current) {
    this._months = months || [];
    this._current = current || "all";
    this.render();
  }

  render() {
    if (this._months.length <= 1) {
      this.innerHTML = "";
      return;
    }
    const chips = [
      { value: "all", label: "Todos", count: this._months.reduce((s, m) => s + (m.count || 0), 0) },
      ...this._months.map(m => ({ value: m.value, label: monthShortLabel(m.value), count: m.count })),
    ];
    this.innerHTML = `
      <div class="month-switcher" role="tablist" aria-label="Filtrar por mês">
        ${chips.map(c => `
          <button
            type="button"
            class="month-switcher__chip"
            role="tab"
            aria-selected="${c.value === this._current}"
            data-month="${c.value}">
            <span class="month-switcher__label">${c.label}</span>
            <span class="month-switcher__count">${c.count}</span>
          </button>
        `).join("")}
      </div>
    `;
    this.querySelectorAll(".month-switcher__chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const value = btn.dataset.month;
        if (value === this._current) return;
        this._current = value;
        this.render();
        this.dispatchEvent(new CustomEvent("month:change", {
          bubbles: true, detail: { month: value },
        }));
      });
    });
  }
}

customElements.define("month-switcher", MonthSwitcher);
