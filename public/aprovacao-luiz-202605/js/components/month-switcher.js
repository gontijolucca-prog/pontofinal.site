// <month-switcher> — navegador infinito de meses. Prev/Next arrows + label.
// Emite `month:change` com detail { month: "2026-05" } sempre que muda.
//
// API pública:
//   setMonth(yyyymm)             → muda mês actual (sem emitir evento)
//   setActiveMonths([yyyymm,...]) → marca quais meses têm conteúdo (highlight)
//   getMonth()                    → mês actual

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

function shiftMonth(yyyymm, delta) {
  const [y, m] = yyyymm.split("-").map(s => parseInt(s, 10));
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

class MonthSwitcher extends HTMLElement {
  connectedCallback() {
    this._current = todayMonth();
    this._activeMonths = new Set();
    this.render();
  }

  // API antiga compat — recebe months[] e current; converte para activeMonths.
  // O current vem como string "2026-05" ou "all". Se "all" cai-se no mês actual.
  setMonths(months, current) {
    this._activeMonths = new Set((months || []).map(m => m.value).filter(Boolean));
    if (current && current !== "all") this._current = current;
    else this._current = todayMonth();
    this.render();
  }

  setMonth(yyyymm) {
    if (!/^\d{4}-\d{2}$/.test(yyyymm)) return;
    this._current = yyyymm;
    this.render();
  }

  setActiveMonths(months) {
    this._activeMonths = new Set(months || []);
    this.render();
  }

  getMonth() { return this._current; }

  _emit() {
    this.dispatchEvent(new CustomEvent("month:change", {
      bubbles: true, detail: { month: this._current },
    }));
  }

  _jumpToToday() {
    const t = todayMonth();
    if (t === this._current) return;
    this._current = t;
    this.render();
    this._emit();
  }

  _step(delta) {
    this._current = shiftMonth(this._current, delta);
    this.render();
    this._emit();
  }

  render() {
    const prev = shiftMonth(this._current, -1);
    const next = shiftMonth(this._current, +1);
    const isToday = this._current === todayMonth();
    const hasContent = this._activeMonths.has(this._current);

    this.innerHTML = `
      <div class="month-nav" role="group" aria-label="Navegar meses">
        <button type="button" class="month-nav__arrow" data-action="prev" aria-label="Mês anterior" title="${monthLongLabel(prev)}">‹</button>
        <div class="month-nav__center">
          <span class="month-nav__label" data-content="${hasContent ? 'yes' : 'no'}">${monthLongLabel(this._current)}</span>
          <span class="month-nav__sub">${hasContent ? "Conteúdo disponível" : "Sem conteúdo ainda"}</span>
        </div>
        <button type="button" class="month-nav__arrow" data-action="next" aria-label="Próximo mês" title="${monthLongLabel(next)}">›</button>
        ${isToday ? "" : `<button type="button" class="month-nav__today" data-action="today" title="Voltar ao mês actual">Hoje</button>`}
      </div>
    `;

    this.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "prev") this._step(-1);
        else if (action === "next") this._step(+1);
        else if (action === "today") this._jumpToToday();
      });
    });
  }
}

customElements.define("month-switcher", MonthSwitcher);
