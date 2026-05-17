// <month-calendar> — renders a single-month grid with chips on scheduled days.

const WEEKDAYS_FULL = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAYS_HEAD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const BRAND_SHORT = { techbody: "TB", techbody_u: "TBU", luiz_santana: "LS" };
const FMT_LABEL = { carrossel: "Carr", story: "Story", reel: "Reel" };
const MONTH_LABEL = {
  1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
  5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
  9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro",
};

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function firstWeekday(year, month) {
  // Return 0=Monday..6=Sunday for the 1st of the month.
  const d = new Date(year, month - 1, 1).getDay(); // 0=Sun..6=Sat
  return (d + 6) % 7;
}
function weekdayLabel(year, month, day) {
  return WEEKDAYS_FULL[new Date(year, month - 1, day).getDay()];
}

class MonthCalendar extends HTMLElement {
  connectedCallback() {
    this._items = [];
    this._year = 2026;
    this._month = 5;
    this.render();
  }

  setItems(items) {
    this._items = items;
    this.render();
  }

  setMonth(yyyymm) {
    // accepts "2026-05" or "2026-6"
    const [y, m] = yyyymm.split("-").map(s => parseInt(s, 10));
    if (!y || !m) return;
    this._year = y;
    this._month = m;
    this.render();
  }

  render() {
    const total = daysInMonth(this._year, this._month);
    const offset = firstWeekday(this._year, this._month);

    // Group items by day-of-month; sort within day so TechBody (09h) shows above TechBody U (18h).
    const byDay = new Map();
    for (const it of this._items) {
      if (!it.scheduled_for) continue;
      const day = parseInt(it.scheduled_for.split("-")[2], 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(it);
    }
    for (const list of byDay.values()) {
      list.sort((a, b) => (a.hour || "").localeCompare(b.hour || ""));
    }

    // Desktop: 7-col grid. Mobile: agenda (vertical list of days-with-content).
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push({ blank: true });
    for (let d = 1; d <= total; d++) {
      cells.push({ blank: false, day: d, items: byDay.get(d) || [] });
    }
    while (cells.length % 7 !== 0) cells.push({ blank: true });

    const agendaDays = Array.from(byDay.keys())
      .sort((a, b) => a - b)
      .map(d => ({ day: d, items: byDay.get(d) }));

    const title = `${MONTH_LABEL[this._month] || this._month} ${this._year}`;
    this.innerHTML = `
      <div class="calendar">
        <div class="calendar__head">
          <div class="calendar__title">${title}</div>
          <div class="calendar__legend">
            <span><i class="dot" style="background:#fff"></i>Carrossel</span>
            <span><i class="dot" style="background:#FF2A2A"></i>Story</span>
            <span><i class="dot" style="background:#050505"></i>Reel</span>
          </div>
        </div>
        <div class="cal-grid">
          ${WEEKDAYS_HEAD.map(w => `<div class="cal-grid__weekday">${w}</div>`).join("")}
          ${cells.map(c => this._cellHTML(c)).join("")}
        </div>
        <ol class="cal-agenda" aria-label="Agenda do mês">
          ${agendaDays.map(({ day, items }) => this._agendaRowHTML(day, items)).join("")}
        </ol>
      </div>
    `;

    // Wire chip clicks (grid + agenda).
    this.querySelectorAll("[data-item-id]").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.itemId;
        this.dispatchEvent(new CustomEvent("calendar:item-click", {
          bubbles: true, detail: { id },
        }));
      });
    });
  }

  _cellHTML(c) {
    if (c.blank) return `<div class="cal-day cal-day--blank"></div>`;
    const chips = c.items.map(it => `
      <span class="cal-chip" data-format="${it.format}" data-brand="${it.brand}" data-item-id="${it.id}" title="${it.title || it.theme}">
        <span class="cal-chip__brand">${BRAND_SHORT[it.brand] || it.brand}</span>
        <span class="cal-chip__fmt">${FMT_LABEL[it.format] || it.format}</span>
        <span class="cal-chip__hour">${it.hour || ""}</span>
      </span>
    `).join("");
    return `
      <div class="cal-day">
        <span class="cal-day__num">${c.day}</span>
        <div class="cal-day__chips">${chips}</div>
      </div>
    `;
  }

  _agendaRowHTML(day, items) {
    const weekday = weekdayLabel(this._year, this._month, day);
    const rows = items.map(it => `
      <li class="agenda-item" data-item-id="${it.id}" data-format="${it.format}" data-brand="${it.brand}">
        <span class="agenda-item__hour">${it.hour || ""}</span>
        <span class="agenda-item__brand">${BRAND_SHORT[it.brand] || it.brand}</span>
        <span class="agenda-item__fmt">${FMT_LABEL[it.format] || it.format}</span>
        <span class="agenda-item__title">${it.title || it.theme}</span>
      </li>
    `).join("");
    return `
      <li class="agenda-day">
        <div class="agenda-day__head">
          <span class="agenda-day__num">${String(day).padStart(2, "0")}</span>
          <span class="agenda-day__wd">${weekday}</span>
        </div>
        <ol class="agenda-day__items">${rows}</ol>
      </li>
    `;
  }
}

customElements.define("month-calendar", MonthCalendar);
