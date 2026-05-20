// <user-menu> — chip discreto no canto que mostra o email do utilizador
// autenticado e dá um botão de sair. Esconde-se sozinho se não houver sessão.

import { supabase } from "../lib/supabase-client.js?v=20260520b";

class UserMenu extends HTMLElement {
  connectedCallback() {
    this.classList.add("user-menu");
    this.setAttribute("aria-hidden", "true");
    this._email = null;
    this.render();
  }

  setSession(session) {
    this._email = session?.user?.email || null;
    if (this._email) {
      this.setAttribute("aria-hidden", "false");
    } else {
      this.setAttribute("aria-hidden", "true");
    }
    this.render();
  }

  render() {
    if (!this._email) {
      this.innerHTML = "";
      return;
    }
    this.innerHTML = `
      <span class="user-menu__email" title="${this._email}">${this._email}</span>
      <button class="user-menu__logout" type="button" data-logout aria-label="Sair">Sair</button>
    `;
    this.querySelector("[data-logout]").addEventListener("click", async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.reload();
      }
    });
  }
}

customElements.define("user-menu", UserMenu);
