// render.mjs — AI Render Agent endpoint
// Cloudflare Pages Function que orquestra render local.
//
// POST /api/render
// Body: { item_id, namespace, html_url, format, overrides, slides }
// Response: { status: "render_queued", detail: "...", render_instructions: {...} }
//
// NOTA: Sem imports externos — tudo coroutines nativas. O erro anterior
// (https:/esm.sh/@supabase/supabase-js@2) causou falha no deploy.

const SUPABASE_URL = "https://ojbigtskkhmnerrppdjq.supabase.co";
const EXPECTED_DIMS = {
  carrossel: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  reel: { w: 1080, h: 1920 },
};

async function upsertSupabase(env, namespace, itemId, note) {
  const key = env?.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) return;
  try {
    const body = JSON.stringify({
      namespace, item_id: itemId, status: "pending",
      note: JSON.stringify(note), updated_at: new Date().toISOString(),
    });
    await fetch(`${SUPABASE_URL}/rest/v1/approvals?on_conflict=namespace,item_id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", apikey: key,
        Authorization: `Bearer ${key}`, Prefer: "resolution=merge-duplicates",
      },
      body,
    });
  } catch { /* não-crítico */ }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const apiKey = request.headers.get("X-Render-Key") || "";
    const expectedKey = env?.RENDER_API_KEY || "";
    if (expectedKey && apiKey !== expectedKey)
      return json({ status: "error", detail: "API key inválida" }, 401);

    const body = await request.json();
    const { item_id, namespace, html_url, format, overrides } = body;
    if (!item_id || !namespace)
      return json({ status: "error", detail: "item_id e namespace obrigatórios" }, 400);

    await upsertSupabase(env, namespace, `${item_id}:render_status`, {
      render: "pending", timestamp: new Date().toISOString(),
    });

    const dims = EXPECTED_DIMS[format] || EXPECTED_DIMS.carrossel;
    const nSlides = body.slides || (format === "carrossel" ? 6 : 1);

    return json({
      status: "render_queued",
      detail: `Item ${item_id} marcado como pending_render. Disparar python3 scripts/render_agent.py --item-id ${item_id}`,
      render_instructions: {
        item_id, html_url, format,
        expected_dims: dims, n_slides: nSlides,
        overrides: overrides || {},
        command: `python3 scripts/render_agent.py --item-id ${item_id} --format ${format} --slides ${nSlides}`,
      },
    });
  } catch (e) {
    return json({ status: "render_error", detail: String(e.message || e) }, 500);
  }
}

export async function onRequestGet() {
  return json({ status: "ok", service: "render-agent" });
}