// render.mjs — AI Render Agent endpoint
// Cloudflare Pages Function que recebe edições e renderiza PNGs novos.
//
// POST /api/render
// Body: { item_id, namespace, html_url, overrides: { slide_texts: {...}, caption: "..." } }
// Response: { status: "render_done" | "render_error", detail: "..." }
//
// O agente:
//   1. Carrega o HTML do item com os overrides aplicados
//   2. Renderiza cada slide como PNG (1080×1350 para carrosséis)
//   3. Valida dimensões
//   4. Se válido → atualiza os PNGs nos _shots/ + marca render_done
//   5. Se inválido → marca render_error + retorna detalhes
//
// FALLBACK: se este endpoint falhar, o item fica pending_render no Supabase
// e NÃO é publicado. Melhor não publicar que publicar errado.
//
// NOTA: Em Cloudflare Pages Functions não temos Playwright/browser. Este
// endpoint actua como orquestrador:
//   - Marca o item como pending_render no Supabase
//   - Retorna instruções para o cliente disparar o render localmente
//   - O render real acontece no Mac via script local (render_agent.py)
//   - Quando o render acaba, o script local marca render_done no Supabase
//
// Para uma versão futura com render na cloud, ver note no fim.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ojbigtskkhmnerrppdjq.supabase.co";
const RENDER_SECRET = "RENDER_API_KEY"; // definido no Cloudflare env

// Dimensões canónicas
const EXPECTED_DIMS = {
  carrossel: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  reel: { w: 1080, h: 1920 },
};

export async function onRequestPost({ request, env }) {
  try {
    // Validar API key
    const apiKey = request.headers.get("X-Render-Key") || "";
    const expectedKey = env?.[RENDER_SECRET] || "";
    if (!expectedKey || apiKey !== expectedKey) {
      return json({ status: "error", detail: "API key inválida" }, 401);
    }

    const body = await request.json();
    const { item_id, namespace, html_url, format, overrides } = body;

    if (!item_id || !namespace) {
      return json({ status: "error", detail: "item_id e namespace obrigatórios" }, 400);
    }

    // Marcar item como pending_render no Supabase
    const supabase = createClient(SUPABASE_URL, env?.SUPABASE_SERVICE_ROLE_KEY || "");
    const serviceKey = env?.SUPABASE_SERVICE_ROLE_KEY || "";

    if (serviceKey) {
      // Usar REST API directa com service role key
      await fetch(`${SUPABASE_URL}/rest/v1/approvals?on_conflict=namespace,item_id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          namespace,
          item_id: `${item_id}:render_status`,
          status: "pending",
          note: JSON.stringify({ render: "pending", timestamp: new Date().toISOString() }),
          updated_at: new Date().toISOString(),
        }),
      });
    }

    // Determinar o que precisa de ser renderizado
    const dims = EXPECTED_DIMS[format] || EXPECTED_DIMS.carrossel;
    const nSlides = body.slides || (format === "carrossel" ? 6 : 1);

    // Retornar instruções de render
    // O cliente (Mac) vai disparar o render localmente
    return json({
      status: "render_queued",
      detail: `Item ${item_id} marcado como pending_render. Disparar render local.`,
      render_instructions: {
        item_id,
        html_url,
        format,
        expected_dims: dims,
        n_slides: nSlides,
        overrides: overrides || {},
        output_dir: `${html_url?.replace(/\.html$/, "_shots")}`,
        command: `python3 scripts/render_agent.py --item-id ${item_id} --format ${format} --slides ${nSlides}`,
      },
    }, 200);

  } catch (e) {
    return json({ status: "render_error", detail: String(e.message || e) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// GET — health check
export async function onRequestGet({ env }) {
  return json({ status: "ok", service: "render-agent" });
}