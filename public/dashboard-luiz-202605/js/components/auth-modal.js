// <auth-modal> — duas inputs de email (têm de bater), checkbox "lembrar-me",
// submit envia magic link via Supabase. Estado pós-envio dá-te a chance de
// corrigir o email se te enganaste.
//
// Eventos:
//   - 'auth:link-sent'  (após signInWithOtp bem-sucedido)
//   - 'auth:back'       (utilizador volta atrás depois de enviar)
//
// Não tem estado próprio fora do DOM; quem o monta controla quando desaparece
// (em main.js: após detectar sessão, simplesmente esconde-se).

import { supabase, setStoragePref } from "../lib/supabase-client.js?v=20260520b";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AuthModal extends HTMLElement {
  connectedCallback() {
    this.classList.add("auth-modal");
    this.setAttribute("aria-hidden", "true");
    this._stage = "form"; // 'form' | 'sent'
    this._email = "";
    this.render();
  }

  open() {
    this.setAttribute("aria-hidden", "false");
    this._stage = "form";
    this.render();
    // Focar primeiro input após render.
    requestAnimationFrame(() => this.querySelector("input[name=email]")?.focus());
  }

  close() {
    this.setAttribute("aria-hidden", "true");
  }

  render() {
    if (this._stage === "sent") {
      this._renderSent();
    } else {
      this._renderForm();
    }
  }

  _renderForm() {
    this.innerHTML = `
      <div class="auth-modal__backdrop"></div>
      <article class="auth-modal__card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <header class="auth-modal__head">
          <h2 id="authTitle">Aprovação</h2>
          <p>Para aprovar conteúdo precisas de entrar com o teu email.</p>
        </header>
        <form class="auth-modal__form" novalidate>
          <label class="auth-modal__field">
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" required spellcheck="false" />
          </label>
          <label class="auth-modal__field">
            <span>Confirma o email</span>
            <input name="confirm" type="email" autocomplete="off" required spellcheck="false" />
          </label>
          <p class="auth-modal__error" data-error aria-live="polite"></p>
          <label class="auth-modal__remember">
            <input name="remember" type="checkbox" />
            <span>Lembrar-me neste dispositivo</span>
          </label>
          <button class="auth-modal__submit" type="submit" disabled>
            <span data-label>Enviar link</span>
          </button>
          <p class="auth-modal__small">
            Recebes um link no email. Clicas, voltas a esta página e ficas
            autenticado.
          </p>
        </form>
      </article>
    `;
    this._bindForm();
  }

  _renderSent() {
    this.innerHTML = `
      <div class="auth-modal__backdrop"></div>
      <article class="auth-modal__card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <header class="auth-modal__head">
          <h2 id="authTitle">Verifica o email</h2>
          <p>Enviámos um link de acesso para</p>
          <p class="auth-modal__email">${this._escape(this._email)}</p>
        </header>
        <div class="auth-modal__actions">
          <button type="button" data-back class="auth-modal__back">Email errado? Voltar</button>
        </div>
        <p class="auth-modal__small">
          O link expira em 1 hora. Se não chegar em 2-3 min, verifica a pasta
          de spam.
        </p>
      </article>
    `;
    this.querySelector("[data-back]").addEventListener("click", () => {
      this._stage = "form";
      this.render();
      this.dispatchEvent(new CustomEvent("auth:back", { bubbles: true }));
    });
  }

  _bindForm() {
    const form    = this.querySelector("form");
    const email   = form.querySelector("input[name=email]");
    const confirm = form.querySelector("input[name=confirm]");
    const submit  = form.querySelector("button[type=submit]");
    const errorEl = form.querySelector("[data-error]");
    const label   = submit.querySelector("[data-label]");

    const validate = () => {
      const a = email.value.trim().toLowerCase();
      const b = confirm.value.trim().toLowerCase();
      let err = "";
      if (a && !RE_EMAIL.test(a)) err = "Email não parece válido.";
      else if (a && b && a !== b) err = "Os dois emails têm de ser iguais.";
      errorEl.textContent = err;
      submit.disabled = !(RE_EMAIL.test(a) && a === b);
    };

    [email, confirm].forEach(el => el.addEventListener("input", validate));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = email.value.trim().toLowerCase();
      if (!RE_EMAIL.test(value)) return;
      const remember = form.querySelector("input[name=remember]").checked;
      setStoragePref(remember ? "local" : "session");

      submit.disabled = true;
      label.textContent = "A enviar…";
      errorEl.textContent = "";

      try {
        const { error } = await supabase.auth.signInWithOtp({
          email: value,
          options: { emailRedirectTo: window.location.href },
        });
        if (error) throw error;
        this._email = value;
        this._stage = "sent";
        this.render();
        this.dispatchEvent(new CustomEvent("auth:link-sent", { bubbles: true, detail: { email: value } }));
      } catch (err) {
        errorEl.textContent = err?.message || "Não foi possível enviar o link. Tenta de novo.";
        submit.disabled = false;
        label.textContent = "Enviar link";
      }
    });
  }

  _escape(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
}

customElements.define("auth-modal", AuthModal);
