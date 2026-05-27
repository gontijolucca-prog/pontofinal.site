// version-gate — bloqueia o uso da página quando NÃO está na versão ao vivo:
//   • offline (sem internet), ou
//   • versão antiga em cache (a app carregada não bate com a do servidor).
// Mostra um aviso GRANDE a pedir refresh, para a ferramenta só ser usada na
// versão live/atual. Some sozinho quando voltar a estar online + atualizada.
// Auto-contido (não depende de config.js) — funciona em qualquer deploy que
// tenha version.txt + <meta name="app-version">.

const META_VERSION = (document.querySelector('meta[name="app-version"]')
  ?.getAttribute('content') || '').trim();

let _gateEl = null;
let _failStreak = 0;

function buildGate() {
  const el = document.createElement('div');
  el.id = 'version-gate';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-live', 'assertive');
  el.setAttribute('aria-label', 'Atualização necessária');
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10000', 'display:none',
    'place-items:center', 'padding:24px', 'text-align:center',
    'background:rgba(5,5,5,0.94)', 'backdrop-filter:blur(6px)',
    "font-family:'JetBrains Mono',ui-monospace,monospace", 'color:#fff',
  ].join(';');
  el.innerHTML = `
    <div style="max-width:460px;display:grid;gap:18px;justify-items:center;">
      <div id="vg-icon" style="font-size:54px;line-height:1;">🔄</div>
      <h2 id="vg-title" style="font-weight:800;font-size:26px;margin:0;line-height:1.15;"></h2>
      <p id="vg-msg" style="font-weight:300;font-size:16px;margin:0;opacity:.92;line-height:1.5;"></p>
      <button id="vg-btn" type="button" style="cursor:pointer;font:800 15px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.04em;padding:15px 26px;border:0;background:#fff;color:#050505;">↻ Atualizar agora</button>
      <p id="vg-sub" style="font-size:12px;opacity:.6;margin:0;line-height:1.4;"></p>
    </div>`;
  el.querySelector('#vg-btn').addEventListener('click', hardReload);
  document.body.appendChild(el);
  return el;
}

async function hardReload() {
  // "Atualizar agora" NUCLEAR: remove o Service Worker e limpa TODAS as caches
  // antes de recarregar. Garante escapar de um SW antigo preso — que servia
  // ficheiros velhos mesmo com Cmd+Shift+R (hard-reload não desfaz o SW).
  const btn = _gateEl && _gateEl.querySelector('#vg-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'A atualizar…'; }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
    if (self.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
  } catch {}
  try { sessionStorage.removeItem('pf-bust-v'); } catch {}
  window.location.replace(window.location.pathname + '?_=' + Date.now());
}

function showGate(kind, serverV) {
  const el = _gateEl || (_gateEl = buildGate());
  const $ = (s) => el.querySelector(s);
  if (kind === 'offline') {
    $('#vg-icon').textContent = '📡';
    $('#vg-title').textContent = 'Sem ligação à internet';
    $('#vg-msg').innerHTML = 'Esta página só funciona na versão ao vivo. Liga-te à internet e atualiza (refresh) até voltar a ficar <strong>ao vivo</strong>.';
    $('#vg-sub').textContent = 'A página volta sozinha assim que a ligação regressar.';
  } else {
    $('#vg-icon').textContent = '🔄';
    $('#vg-title').textContent = 'Versão desatualizada';
    $('#vg-msg').innerHTML = 'Estás a ver uma versão antiga (em cache). Atualiza a página para carregar a <strong>versão ao vivo</strong> — é a única que deves usar para rever e aprovar.';
    $('#vg-sub').textContent = serverV ? `A tua: ${META_VERSION} · Ao vivo: ${serverV}` : '';
  }
  el.style.display = 'grid';
  document.documentElement.style.overflow = 'hidden'; // trava scroll por baixo
  // O bloqueio tem prioridade — esconde o guia "como usar" se estiver aberto.
  try { document.getElementById('helpOverlay')?.close?.(); } catch {}
}

function hideGate() {
  if (_gateEl) _gateEl.style.display = 'none';
  document.documentElement.style.overflow = '';
}

// True se o utilizador está a editar um campo de texto AGORA — para não
// interromper uma escrita em curso com um reload de atualização de versão.
function userIsEditing() {
  const a = document.activeElement;
  if (!a) return false;
  if (a.tagName === 'TEXTAREA' || a.isContentEditable) return true;
  if (a.tagName === 'INPUT') return /^(text|email|search|url|tel|number|password|)$/i.test(a.getAttribute('type') || '');
  return false;
}

async function check() {
  // 1) Offline declarado pelo browser → bloqueia já.
  if (!navigator.onLine) { showGate('offline'); return; }
  // 2) Versão: fetch fresco (cache-bust + no-store) do version.txt do servidor.
  try {
    const r = await fetch('version.txt?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('http ' + r.status);
    const server = (await r.text()).trim();
    _failStreak = 0;
    if (server && META_VERSION && server !== META_VERSION) {
      // NÃO interromper quem está a escrever: se um campo de texto está focado,
      // adia a atualização para o próximo ciclo. As edições já vão sendo gravadas
      // no servidor — só evitamos o reload forçado a meio de uma escrita, para
      // nunca apagar/perder o que o cliente está a alterar nesse momento.
      if (userIsEditing()) return;
      // AUTO-CURA: 1x por cada versão nova do servidor faz reload nuclear
      // (limpa SW + caches) SOZINHO — o user não precisa de fazer nada.
      // Se mesmo assim continuar dessincronizado, mostra o aviso + botão manual.
      const healKey = 'pf-autoheal-' + server;
      let healed = true;
      try { healed = sessionStorage.getItem(healKey) === '1'; } catch {}
      if (!healed) {
        try { sessionStorage.setItem(healKey, '1'); } catch {}
        hardReload();
        return;
      }
      showGate('stale', server);
    } else hideGate();
  } catch {
    // Falha de rede: só bloqueia como offline se o browser confirmar offline,
    // ou após 3 falhas seguidas — evita falso-positivo numa falha pontual.
    _failStreak++;
    if (!navigator.onLine || _failStreak >= 3) showGate('offline');
  }
}

function start() {
  check();
  window.addEventListener('online', check);
  window.addEventListener('offline', () => showGate('offline'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(() => { if (!document.hidden) check(); }, 20000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
