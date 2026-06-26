// Service Worker — garante que o HTML/JS/CSS são sempre carregados do
// servidor (network-first), nunca do cache do browser. Resolve o caso
// onde Chrome/Safari/Brave servem versão antiga mesmo com Cache-Control:
// no-store nos headers HTTP (browsers móveis frequentemente ignoram-no).
//
// Uma vez registado, este SW intercepta todos os fetches do seu scope
// (a pasta deste deploy de aprovação) e:
//   1. Tenta network first com `cache: 'no-store'`
//   2. Se network ok → serve directamente + actualiza cache local
//   3. Se network falha → fallback para cache (offline support)
//
// Resultado: a partir da segunda visita o user nunca mais vê versão
// antiga, mesmo sem clear cache manual.

const CACHE_NAME = 'pf-aprovacao-fallback-v33';

// Activa imediatamente sem esperar que tabs abertas fechem.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Limpa caches antigos (de versões anteriores do SW).
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Só interceptamos requests para o mesmo origin. /api/* e externos (CDN
  // de fontes, supabase directo) ficam fora do controlo do SW.
  if (url.origin !== self.location.origin) return;
  // O proxy Supabase (/api/*) NUNCA passa pelo SW — interceptado, o request
  // ficava pendurado para sempre em alguns tabs (página presa no loader).
  if (url.pathname.startsWith('/api/')) return;
  // Só GET requests — POSTs (writes) vão sempre directos para network.
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      // Network-first: pede sempre ao servidor, ignorando o cache HTTP do browser.
      const networkResponse = await fetch(req, { cache: 'no-store' });
      // Guarda no cache para fallback offline.
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        // .put() requer Response clonada — original ainda vai para o browser.
        cache.put(req, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    } catch (e) {
      // Sem rede — tenta servir do cache. Se também não há, retorna erro.
      const cached = await caches.match(req);
      if (cached) return cached;
      return new Response('Offline e sem cache.', { status: 503, statusText: 'Offline' });
    }
  })());
});

// Permite ao app pedir ao SW para se actualizar imediatamente.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
