// top-tabs.js — Top tab bar (neo-brutalist, no emojis).
//
// Cada botão é um dropdown: clica → abre menu com marcas.
// Seleccionar marca muda de secção + filtra por marca.
// Se só há 1 marca, clica directamente (sem dropdown).

import { BRANDS_FILTER } from "../config.js";

const BRAND_LABELS = {
  techbody: "TechBody",
  techbody_u: "TechBody U",
  luiz_santana: "Luiz Santana",
};

const TABS = [
  { id: "calendar", label: "Calendário" },
  { id: "gallery",   label: "Galeria" },
  { id: "queue",     label: "Fila de Publicação" },
];

class TopTabs extends HTMLElement {
  connectedCallback() {
    this.classList.add("top-tabs");
    this._activeTab = "home"; // default: menu inicial
    this._brand = "all";
    this._openMenu = null;
    this.render();
  }

  render() {
    const brands = BRANDS_FILTER || [];
    const hasDropdown = brands.length > 1;

    // Home view (menu inicial com 3 cards grandes)
    const homeHTML = `
      <div class="top-tabs__home" id="topTabsHome">
        <div class="top-tabs__home-cards">
          <button type="button" class="top-tabs__home-card" data-tab="calendar">
            <span class="top-tabs__home-label">Calendário</span>
            <span class="top-tabs__home-sub">Toda a publicação agendada</span>
          </button>
          <button type="button" class="top-tabs__home-card" data-tab="gallery">
            <span class="top-tabs__home-label">Galeria</span>
            <span class="top-tabs__home-sub">Conteúdos para rever e aprovar</span>
          </button>
          <button type="button" class="top-tabs__home-card" data-tab="queue">
            <span class="top-tabs__home-label">Fila de Publicação</span>
            <span class="top-tabs__home-sub">Próximas publicações no Instagram</span>
          </button>
        </div>
      </div>
    `;

    const tabsHTML = TABS.map(t => {
      const isActive = t.id === this._activeTab;
      const brandLabel = this._brand !== "all" ? (BRAND_LABELS[this._brand] || this._brand) : "";
      const label = brandLabel && isActive ? `${t.label} · ${brandLabel}` : t.label;

      if (hasDropdown) {
        return `
          <div class="top-tabs__tab-wrap ${isActive ? "is-active" : ""}" data-tab="${t.id}">
            <button type="button" class="top-tabs__tab" data-tab="${t.id}">
              ${label}
              <svg class="top-tabs__arrow" width="8" height="5" viewBox="0 0 8 5"><path d="M1 1l3 3 3-3" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>
            </button>
            <div class="top-tabs__menu" data-tab="${t.id}">
              <button type="button" class="top-tabs__menu-item ${this._brand === 'all' ? 'is-selected' : ''}" data-brand="all" data-tab="${t.id}">Todas as marcas</button>
              ${brands.map(b => `
                <button type="button" class="top-tabs__menu-item ${this._brand === b ? 'is-selected' : ''}" data-brand="${b}" data-tab="${t.id}">${BRAND_LABELS[b] || b}</button>
              `).join("")}
            </div>
          </div>
        `;
      } else {
        return `
          <div class="top-tabs__tab-wrap ${isActive ? "is-active" : ""}" data-tab="${t.id}">
            <button type="button" class="top-tabs__tab" data-tab="${t.id}">${label}</button>
          </div>
        `;
      }
    }).join("");

    this.innerHTML = `
      <div class="top-tabs__inner">
        <div class="top-tabs__tabs" role="tablist">${tabsHTML}</div>
      </div>
    `;

    // Inserir home view no main, centrado
    let homeEl = document.getElementById("topTabsHome");
    if (homeEl) homeEl.remove();
    const main = document.getElementById("main");
    if (main) {
      main.insertAdjacentHTML("afterbegin", homeHTML);
      homeEl = document.getElementById("topTabsHome");
      if (homeEl) {
        homeEl.querySelectorAll(".top-tabs__home-card").forEach(card => {
          card.addEventListener("click", () => this._select(card.dataset.tab, this._brand));
        });
      }
    }

    // Wire tab clicks
    this.querySelectorAll(".top-tabs__tab").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tabId = btn.dataset.tab;
        if (hasDropdown) {
          this._toggleMenu(tabId);
        } else {
          this._select(tabId, "all");
        }
      });
    });

    // Wire menu items
    this.querySelectorAll(".top-tabs__menu-item").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._select(btn.dataset.tab, btn.dataset.brand);
      });
    });

    // Close on outside click
    this._docClickHandler = (e) => {
      if (!this.contains(e.target)) this._closeMenus();
    };
    document.addEventListener("click", this._docClickHandler);

    // Wire logo click → voltar ao home
    const logo = document.getElementById("brandLogo");
    if (logo) {
      logo.style.cursor = "pointer";
      logo.addEventListener("click", () => this._goHome(), { signal: undefined });
    }

    this._showSection();
  }

  _goHome() {
    this._activeTab = "home";
    this.querySelectorAll(".top-tabs__tab-wrap").forEach(w => w.classList.remove("is-active"));
    this._showSection();
    this._dispatch();
  }

  _select(tab, brand) {
    this._activeTab = tab;
    this._brand = brand;
    this._closeMenus();
    this.render();
    this._showSection();
    this._dispatch();
  }

  _toggleMenu(tabId) {
    const menu = this.querySelector(`.top-tabs__menu[data-tab="${tabId}"]`);
    if (!menu) return;
    const isOpen = menu.classList.contains("is-open");
    this._closeMenus();
    if (!isOpen) menu.classList.add("is-open");
  }

  _closeMenus() {
    this.querySelectorAll(".top-tabs__menu.is-open").forEach(m => m.classList.remove("is-open"));
  }

  _showSection() {
    const calendar = document.getElementById("calendarSection");
    const gallery = document.getElementById("gallerySection");
    const pubQueue = document.getElementById("pubQueueSection");
    const published = document.getElementById("publishedSection");
    const filterBar = document.getElementById("filterBar");
    const home = document.getElementById("topTabsHome");
    const heroAction = document.getElementById("heroAction");

    if (calendar) calendar.style.display = "none";
    if (gallery) gallery.style.display = "none";
    if (pubQueue) pubQueue.style.display = "none";
    if (published) published.style.display = "none";
    if (filterBar) filterBar.style.display = "none";
    if (heroAction) heroAction.style.display = "none";

    if (this._activeTab === "home") {
      if (home) home.style.display = "";
      return;
    }
    if (home) home.style.display = "none";
    if (heroAction) heroAction.style.display = "";

    if (this._activeTab === "calendar") {
      if (calendar) calendar.style.display = "";
      if (published) published.style.display = "";
    } else if (this._activeTab === "gallery") {
      if (gallery) gallery.style.display = "";
      if (published) published.style.display = "";
    } else if (this._activeTab === "queue") {
      if (pubQueue) pubQueue.style.display = "";
    }
  }

  _dispatch() {
    this.dispatchEvent(new CustomEvent("tab:change", {
      bubbles: true,
      detail: { tab: this._activeTab, brand: this._brand }
    }));
  }

  get activeTab() { return this._activeTab; }
  get brand() { return this._brand; }
}

customElements.define("top-tabs", TopTabs);