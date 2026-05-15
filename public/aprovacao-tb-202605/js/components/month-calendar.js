// <month-calendar> — renders a single-month grid with chips on scheduled days.

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const BRAND_SHORT = { techbody: "TB", techbody_u: "TBU" };
const FMT_LABEL = { carrossel: "Carr", story: "Story", reel: "Reel" };

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }
function firstWeekday(year, month) {
  // Return 0=Monday..6=Sunday for the 1st of the month.
  const d = new Date(year, month - 1, 1).getDay(); // 0=Sun..6=Sat
  return (d + 6) % 7;
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

    const cells = [];
    for (let i = 0; i < offset; i++) cells.push({ blank: true });
    for (let d = 1; d <= total; d++) {
      cells.push({ blank: false, day: d, items: byDay.get(d) || [] });
    }
    while (cells.length % 7 !== 0) cells.push({ blank: true });

    this.innerHTML = `
      <div class="calendar">
        <div class="calendar__head">
          <div class="calendar__title">Maio 2026</div>
          <div class="calendar__legend">
            <span><i class="dot" style="background:#fff"></i>Carrossel</span>
            <span><i class="dot" style="background:#FF2A2A"></i>Story</span>
            <span><i class="dot" style="background:#050505"></i>Reel</span>
          </div>
        </div>
        <div class="cal-grid">
          ${WEEKDAYS.map(w => `<div class="cal-grid__weekday">${w}</div>`).join("")}
          ${cells.map(c => this._cellHTML(c)).join("")}
        </div>
      </div>
    `;

    // Wire chip clicks
    this.querySelectorAll(".cal-chip[data-item-id]").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.itemId;
        this.dispatchEvent(new CustomEvent("calendar:item-click", {
          bubbles: true,
          detail: { id },
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
}

customElements.define("month-calendar", MonthCalendar);
