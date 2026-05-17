// <help-overlay> — overlay com lista de atalhos teclado. Aberto/fechado
// via ? (Shift+/) ou via botão de ajuda no header. Esc fecha.

const SHORTCUTS = [
  { keys: ["A"],            label: "Aprovar item visível e ir para o próximo" },
  { keys: ["R"],            label: "Rejeitar item visível e ir para o próximo" },
  { keys: ["J", "↓"],       label: "Próximo item" },
  { keys: ["K", "↑"],       label: "Item anterior" },
  { keys: ["←", "→"],       label: "Slide anterior / próximo (carrossel)" },
  { keys: ["Esc"],          label: "Fechar preview" },
  { keys: ["?"],            label: "Mostrar/esconder esta ajuda" },
];

class HelpOverlay extends HTMLElement {
  connectedCallback() {
    this.setAttribute("aria-hidden", "true");
    this.classList.add("help-overlay");
    this.addEventListener("click", e => { if (e.target === this) this.close(); });
    this.render();

    document.addEventListener("keydown", e => {
      // Ignorar se utilizador escreve.
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (typing) return;
      if (e.key === "?") {
        e.preventDefault();
        this.toggle();
      } else if (e.key === "Escape" && this.getAttribute("aria-hidden") === "false") {
        e.preventDefault();
        this.close();
      }
    });
  }

  open()   { this.setAttribute("aria-hidden", "false"); }
  close()  { this.setAttribute("aria-hidden", "true"); }
  toggle() { this.getAttribute("aria-hidden") === "true" ? this.open() : this.close(); }

  render() {
    this.innerHTML = `
      <div class="help-overlay__panel" role="dialog" aria-label="Atalhos do teclado">
        <header class="help-overlay__head">
          <h2>Atalhos</h2>
          <button type="button" class="help-overlay__close" aria-label="Fechar">×</button>
        </header>
        <ul class="help-overlay__list">
          ${SHORTCUTS.map(s => `
            <li class="help-overlay__item">
              <span class="help-overlay__keys">
                ${s.keys.map(k => `<kbd>${k}</kbd>`).join(" / ")}
              </span>
              <span class="help-overlay__label">${s.label}</span>
            </li>
          `).join("")}
        </ul>
        <footer class="help-overlay__foot">
          Pressiona <kbd>?</kbd> para abrir/fechar.
        </footer>
      </div>
    `;
    this.querySelector(".help-overlay__close").addEventListener("click", () => this.close());
  }
}

customElements.define("help-overlay", HelpOverlay);
