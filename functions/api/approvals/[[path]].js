// Same-origin proxy para o Supabase REST. Resolve o problema de
// browsers (Brave Shields, Safari content blockers, extensões ad-block)
// que bloqueiam fetches directos para supabase.co como se fossem
// trackers de terceiros. Ao passar pelo mesmo domínio do site, o
// pedido é tratado como first-party e não é filtrado.
//
// Rotas:
//   GET  /api/approvals?namespace=...     → SELECT
//   POST /api/approvals                   → INSERT/UPSERT (com Prefer header)
//   PATCH/DELETE também são proxied.
//
// O anon key é injectado SERVER-SIDE. O cliente nunca precisa de
// saber as credenciais — só fala com /api/approvals.

const SUPABASE_URL = "https://ojbigtskkhmnerrppdjq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qYmlndHNra2htbmVycnBwZGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjk1MDksImV4cCI6MjA5NDYwNTUwOX0.gFcdOh19siLqTzTsmoYDs2ZjA4l3uykRs01sRebkdZQ";

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);

  // Reconstrói o sub-path depois de /api/approvals/
  const subpath = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  const target = `${SUPABASE_URL}/rest/v1/approvals${subpath ? "/" + subpath : ""}${url.search}`;

  // Headers a reencaminhar — descartamos os que confundem o backend.
  const fwdHeaders = new Headers();
  for (const [k, v] of request.headers) {
    const lk = k.toLowerCase();
    if (lk === "host" || lk === "origin" || lk === "referer" ||
        lk === "cf-connecting-ip" || lk === "x-forwarded-for" ||
        lk.startsWith("cf-") || lk === "true-client-ip") continue;
    fwdHeaders.set(k, v);
  }
  // Credenciais sempre injectadas server-side.
  fwdHeaders.set("apikey", SUPABASE_ANON_KEY);
  fwdHeaders.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: fwdHeaders,
      body,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "proxy_fetch_failed", detail: String(e) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Mantém o status + corpo do upstream. Tira headers de set-cookie /
  // CF-specific e força CORS *.
  const respHeaders = new Headers();
  for (const [k, v] of upstream.headers) {
    const lk = k.toLowerCase();
    if (lk === "set-cookie" || lk.startsWith("cf-") || lk === "server") continue;
    respHeaders.set(k, v);
  }
  respHeaders.set("Access-Control-Allow-Origin", "*");
  respHeaders.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  respHeaders.set("Access-Control-Allow-Headers", "*");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}
