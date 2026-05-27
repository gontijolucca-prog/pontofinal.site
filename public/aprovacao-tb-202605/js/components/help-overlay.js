// <help-overlay> — guia "Como usar esta página" em linguagem simples + atalhos.
// Abre via botão ? no header, tecla ? (Shift+/), e automaticamente na 1ª visita.
// Esc fecha. Pensado para quem não está à vontade com informática.

const GUIDE = [
  { icon: "👀", title: "O que é isto",
    text: "São os conteúdos deste mês. Vê cada um com calma e diz-nos se pode ir para as redes." },
  { icon: "✅", title: "Gostas? Aprova",
    text: "Carrega no botão verde <strong>✓ Aprovar</strong> por baixo do conteúdo." },
  { icon: "✏️", title: "Queres mudar o texto?",
    text: "Carrega no texto e escreve por cima. Guarda sozinho — aparece <strong>✓ guardado</strong>." },
  { icon: "🚫", title: "Não queres este?",
    text: "Carrega em <strong>Não publicar</strong>. Podes voltar atrás quando quiseres." },
  { icon: "🔍", title: "Ver em grande",
    text: "Carrega na imagem para a abrires em tamanho real. Fecha com o ×." },
  { icon: "💾", title: "Fica tudo guardado",
    text: "Não tens de gravar nada à mão. Podes fechar e voltar mais tarde — as tuas escolhas ficam." },
];

const SHORTCUTS = [
  { keys: ["A"],            label: "Aprovar item visível e ir para o próximo" },
  { keys: ["R"],            label: "Rejeitar item visível e ir para o próximo" },
  { keys: ["J", "↓"],       label: "Próximo item" },
  { keys: ["K", "↑"],       label: "Item anterior" },
  { keys: ["←", "→"],       label: "Slide anterior / próximo (carrossel)" },
  { keys: ["Esc"],          label: "Fechar preview" },
  { keys: ["?"],            label: "Mostrar/esconder esta ajuda" },
];

const SEEN_KEY = "pf_guia_visto_v1";

class HelpOverlay extends HTMLElement {
  connectedCallback() {
    this.setAttribute("aria-hidden", "true");
    this.classList.add("help-overlay");
    this.addEventListener("click", e => { if (e.target === this) this.close(); });
    this.render();

    document.addEventListener("keydown", e => {
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

    // 1ª visita: abre o guia sozinho, mas só depois de um eventual modal de
    // nome/login fechar (não empilhar dois diálogos).
    this._maybeAutoOpen();
  }

  _maybeAutoOpen() {
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch {}
    if (seen) return;
    const tryOpen = () => {
      const auth = document.querySelector("auth-modal");
      const authOpen = auth && auth.getAttribute("aria-hidden") === "false";
      if (authOpen) { setTimeout(tryOpen, 1000); return; }
      this.open();
      try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    };
    setTimeout(tryOpen, 1100);
  }

  open()   { this.setAttribute("aria-hidden", "false"); }
  close()  {
    this.setAttribute("aria-hidden", "true");
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
  }
  toggle() { this.getAttribute("aria-hidden") === "true" ? this.open() : this.close(); }

  render() {
    this.innerHTML = `
      <style>
        .help-overlay .help-guide { display:grid; gap:14px; margin:4px 0 6px; }
        .help-overlay .help-guide__step { display:flex; gap:13px; align-items:flex-start; }
        .help-overlay .help-guide__icon { flex:0 0 auto; width:30px; text-align:center; font-size:21px; line-height:1.25; }
        .help-overlay .help-guide__body { min-width:0; }
        .help-overlay .help-guide__title { font-weight:800; margin:0 0 1px; }
        .help-overlay .help-guide__text { margin:0; opacity:.82; font-weight:300; line-height:1.4; }
        .help-overlay .help-guide__text strong { font-weight:700; opacity:1; }
        .help-overlay .help-divider { margin:18px 0 10px; border:0; border-top:1px solid currentColor; opacity:.14; }
        .help-overlay .help-sub { font-size:.74em; letter-spacing:.08em; text-transform:uppercase; opacity:.55; font-weight:700; margin:0 0 8px; }
        .help-overlay .help-overlay__list { margin:0; }
      </style>
      <div class="help-overlay__panel" role="dialog" aria-label="Como usar esta página" aria-modal="true">
        <header class="help-overlay__head">
          <h2>Como usar esta página</h2>
          <button type="button" class="help-overlay__close" aria-label="Fechar">×</button>
        </header>

        <div class="help-guide">
          ${GUIDE.map(g => `
            <div class="help-guide__step">
              <span class="help-guide__icon" aria-hidden="true">${g.icon}</span>
              <div class="help-guide__body">
                <p class="help-guide__title">${g.title}</p>
                <p class="help-guide__text">${g.text}</p>
              </div>
            </div>
          `).join("")}
        </div>

        <hr class="help-divider" />
        <p class="help-sub">Atalhos de teclado <span style="text-transform:none;letter-spacing:0;font-weight:300;">(opcional)</span></p>
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
          Carrega em <kbd>?</kbd> no topo a qualquer momento para reabrir este guia.
        </footer>
      </div>
    `;
    this.querySelector(".help-overlay__close").addEventListener("click", () => this.close());
  }
}

customElements.define("help-overlay", HelpOverlay);
