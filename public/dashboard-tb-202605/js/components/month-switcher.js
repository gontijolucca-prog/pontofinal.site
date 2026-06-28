// <month-switcher> — dropdown para filtrar dashboard por mês.
// Emite `month:change` com detail { month: "2026-05" | "all" }.
//
// Comportamento:
//   - Click no trigger → abre/fecha dropdown
//   - Click num item → selecciona + emite
//   - Click fora ou Escape → fecha
//   - ArrowDown/Up dentro do menu → navega items
//   - Enter → selecciona item focado

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

function monthLongLabel(yyyymm) {
  const [y, m] = yyyymm.split("-").map(s => parseInt(s, 10));
  if (!y || !m) return yyyymm;
  return `${MONTH_LABEL[m] || m} ${y}`;
}

class MonthSwitcher extends HTMLElement {
  connectedCallback() {
    this._months = [];
    this._current = "all";
    this._open = false;
    this._focusIndex = -1;
    this.render();
    this._wireOutsideClick();
    this._wireKeydown();
  }

  setMonths(months, current) {
    this._months = months || [];
    this._current = current || "all";
    this._open = false;
    this.render();
  }

  _triggerLabel() {
    if (this._current === "all") return "Todos os meses";
    return monthLongLabel(this._current);
  }

  _triggerCount() {
    if (this._current === "all") {
      return this._months.reduce((s, m) => s + (m.count || 0), 0);
    }
    const found = this._months.find(m => m.value === this._current);
    return found ? found.count : 0;
  }

  _options() {
    return [
      { value: "all", label: "Todos os meses", count: this._months.reduce((s, m) => s + (m.count || 0), 0) },
      ...this._months.map(m => ({ value: m.value, label: monthLongLabel(m.value), count: m.count })),
    ];
  }

  _toggle() {
    this._open = !this._open;
    if (this._open) this._focusIndex = this._options().findIndex(o => o.value === this._current);
    this.render();
  }

  _close() {
    if (!this._open) return;
    this._open = false;
    this.render();
  }

  _select(value) {
    if (value === this._current) {
      this._close();
      return;
    }
    this._current = value;
    this._open = false;
    this.render();
    this.dispatchEvent(new CustomEvent("month:change", {
      bubbles: true, detail: { month: value },
    }));
  }

  _focusItem(idx) {
    const opts = this._options();
    if (idx < 0) idx = opts.length - 1;
    if (idx >= opts.length) idx = 0;
    this._focusIndex = idx;
    const items = this.querySelectorAll(".month-dropdown__item");
    items.forEach((el, i) => {
      el.setAttribute("aria-selected", i === idx ? "true" : "false");
      if (i === idx) el.scrollIntoView({ block: "nearest" });
    });
  }

  _wireOutsideClick() {
    document.addEventListener("click", (e) => {
      if (!this._open) return;
      if (!this.contains(e.target)) this._close();
    });
  }

  _wireKeydown() {
    this.addEventListener("keydown", (e) => {
      if (!this._open) {
        // Trigger focado + Enter/Space/ArrowDown → abre
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          if (e.target.classList.contains("month-dropdown__trigger")) {
            e.preventDefault();
            this._toggle();
          }
        }
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); this._close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); this._focusItem(this._focusIndex + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this._focusItem(this._focusIndex - 1); }
      else if (e.key === "Home") { e.preventDefault(); this._focusItem(0); }
      else if (e.key === "End") { e.preventDefault(); this._focusItem(this._options().length - 1); }
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opts = this._options();
        const target = this._focusIndex >= 0 ? opts[this._focusIndex] : opts.find(o => o.value === this._current);
        if (target) this._select(target.value);
      }
    });
  }

  render() {
    if (this._months.length <= 1) {
      this.innerHTML = "";
      return;
    }
    const options = this._options();
    const triggerLabel = this._triggerLabel();
    const triggerCount = this._triggerCount();
    this.innerHTML = `
      <div class="month-dropdown${this._open ? " month-dropdown--open" : ""}">
        <button
          type="button"
          class="month-dropdown__trigger"
          aria-haspopup="listbox"
          aria-expanded="${this._open}"
          aria-label="Filtrar por mês (actual: ${triggerLabel})">
          <span class="month-dropdown__label">${triggerLabel}</span>
          <span class="month-dropdown__count">${triggerCount}</span>
          <span class="month-dropdown__arrow" aria-hidden="true">▾</span>
        </button>
        ${this._open ? `
          <ul class="month-dropdown__menu" role="listbox" aria-label="Meses disponíveis">
            ${options.map((o, i) => `
              <li
                class="month-dropdown__item${o.value === this._current ? " is-current" : ""}${i === this._focusIndex ? " is-focused" : ""}"
                role="option"
                aria-selected="${o.value === this._current}"
                data-month="${o.value}"
                tabindex="-1">
                <span class="month-dropdown__item-label">${o.label}</span>
                <span class="month-dropdown__item-count">${o.count}</span>
              </li>
            `).join("")}
          </ul>
        ` : ""}
      </div>
    `;
    const trigger = this.querySelector(".month-dropdown__trigger");
    if (trigger) trigger.addEventListener("click", (e) => { e.stopPropagation(); this._toggle(); });
    this.querySelectorAll(".month-dropdown__item").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this._select(el.dataset.month);
      });
    });
  }
}

customElements.define("month-switcher", MonthSwitcher);
