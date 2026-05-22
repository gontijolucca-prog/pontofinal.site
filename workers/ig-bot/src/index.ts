/**
 * PontoFinal IG Bot — Cloudflare Worker entry point.
 *
 * Endpoints:
 *   GET  /api/ig-webhook  → Meta webhook verification handshake
 *   POST /api/ig-webhook  → Meta webhook events (messages, comments, mentions)
 *
 * Flow:
 *   1. Verify Meta signature (x-hub-signature-256)
 *   2. Parse event → find user_id + message text
 *   3. Load conversation history from Supabase (last 12 msgs)
 *   4. Call OpenRouter with MANIFESTO + history → get reply
 *   5. Quality check + retry once if fails
 *   6. Send reply via Meta Graph API
 *   7. Append both msgs to Supabase
 */

import { MANIFESTO } from "./manifesto";

export interface Env {
  META_APP_SECRET: string;
  META_VERIFY_TOKEN: string;
  META_ACCESS_TOKEN: string;
  META_IG_USER_ID: string;
  OPENROUTER_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

const SAFE_FALLBACK =
  "Desculpa, deixa-me só pensar melhor na resposta. Volto a ti num instante.";

// ─── Worker entry ────────────────────────────────────────────────────────
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/ig-webhook" && req.method === "GET") {
      return handleVerification(url, env);
    }
    if (url.pathname === "/api/ig-webhook" && req.method === "POST") {
      return handleEvent(req, env, ctx);
    }
    return new Response("not found", { status: 404 });
  },
};

// ─── Meta webhook verification (handshake) ───────────────────────────────
function handleVerification(url: URL, env: Env): Response {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === env.META_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

// ─── Meta event handler ──────────────────────────────────────────────────
async function handleEvent(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  if (!(await verifySignature(raw, sig, env.META_APP_SECRET))) {
    return new Response("bad signature", { status: 403 });
  }
  const body = JSON.parse(raw);

  // Process in background — respond 200 immediately to Meta
  ctx.waitUntil(processEvent(body, env));
  return new Response("ok", { status: 200 });
}

async function processEvent(body: any, env: Env): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const m of entry.messaging ?? []) {
      const senderId = m.sender?.id;
      const text = m.message?.text;
      if (!senderId || !text) continue;
      if (senderId === env.META_IG_USER_ID) continue; // ignore echo
      try {
        await respondToMessage(senderId, text, env);
      } catch (e) {
        console.error("respond failed", e);
      }
    }
    // TODO: handle entry.changes for comments/mentions
  }
}

// ─── Conversation core ───────────────────────────────────────────────────
async function respondToMessage(senderId: string, userText: string, env: Env): Promise<void> {
  // ALWAYS log incoming msg (even in shadow mode)
  await appendHistory(senderId, [{ role: "user", content: userText }], env);

  // Check operator controls (enabled / shadow / allowlist / blocklist / cap)
  const canRespond = await checkBotCanRespond(senderId, env);
  if (!canRespond) {
    console.log(`[bot] not responding to ${senderId} (disabled / shadow / blocked / cap / not-allowlisted)`);
    return;
  }

  const history = await loadHistory(senderId, env, 12);
  const messages = [
    { role: "system", content: MANIFESTO },
    ...history,
  ];

  let reply = await callOpenRouter(messages, env);
  if (!passesQualityCheck(reply, userText)) {
    console.warn("[bot] 1st reply failed checks, retrying");
    reply = await callOpenRouter(messages, env);
    if (!passesQualityCheck(reply, userText)) {
      console.error("[bot] 2nd reply also failed — using SAFE_FALLBACK");
      reply = SAFE_FALLBACK;
    }
  }

  await sendDM(senderId, reply, env);
  await appendHistory(senderId, [{ role: "assistant", content: reply }], env);
}

async function checkBotCanRespond(senderId: string, env: Env): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/rpc/ig_bot_can_respond`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_sender_id: senderId }),
  });
  if (!r.ok) return false;
  return await r.json() as boolean;
}

// ─── OpenRouter call ─────────────────────────────────────────────────────
async function callOpenRouter(messages: any[], env: Env): Promise<string> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://pontofinal.site",
      "X-Title": "PontoFinal IG Bot",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      reasoning: { effort: "minimal" },
      messages,
      max_tokens: 320,
      temperature: 0.7,
    }),
  });
  if (!r.ok) {
    console.error("openrouter error", r.status, await r.text());
    return "";
  }
  const d: any = await r.json();
  return d.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Quality checks (defensive — openrouter/free can hit bad models) ─────
function passesQualityCheck(reply: string, userText: string): boolean {
  if (!reply || reply.length < 4) return false;
  if (reply.length > 600) return false;

  const low = reply.toLowerCase();

  // Reasoning leak
  const reasoningTokens = ["okay,", "first,", "let me ", "i should", "i'm", "the user", "<think>", "</think>"];
  if (reasoningTokens.some(t => low.includes(t))) return false;

  // Bot self-disclosure
  const botTokens = ["sou um bot", "sou uma ia", "sou uma inteligência artificial", "language model", "ai assistant", "modelo de linguagem"];
  if (botTokens.some(t => low.includes(t))) return false;

  // PT-BR markers (case sensitive for "você" because "você" never appears in PT-PT)
  const ptBr = ["você ", "gerenciamento", "gerenciar", "usuário", "celular", " tela ", " arquivo ", "ônibus", "trem ", "banheiro", "geladeira"];
  if (ptBr.some(t => low.includes(t))) return false;

  // Letter-format leak (writing email to third party)
  if (reply.includes("---") && reply.length > 200) return false;
  if (/^(olá|prezado|estimado|caro)\s+[A-Z][a-z]+,/m.test(reply)) return false;
  if (low.includes("atenciosamente") || low.includes("cumprimentos,")) return false;

  return true;
}

// ─── Instagram Graph API (send DM) ───────────────────────────────────────
// IG Business Login API uses graph.instagram.com/me/messages.
async function sendDM(recipientId: string, text: string, env: Env): Promise<void> {
  const url = `https://graph.instagram.com/v23.0/me/messages`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: env.META_ACCESS_TOKEN,
    }),
  });
  if (!r.ok) {
    console.error("sendDM error", r.status, await r.text());
  }
}

// ─── Supabase (conversation history) ─────────────────────────────────────
async function loadHistory(senderId: string, env: Env, limit: number): Promise<any[]> {
  const url = `${env.SUPABASE_URL}/rest/v1/ig_messages?sender_id=eq.${senderId}&order=created_at.desc&limit=${limit}`;
  const r = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!r.ok) return [];
  const rows: any[] = await r.json();
  return rows.reverse().map(r => ({ role: r.role, content: r.content }));
}

async function appendHistory(senderId: string, msgs: any[], env: Env): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/ig_messages`;
  const rows = msgs.map(m => ({ sender_id: senderId, role: m.role, content: m.content }));
  await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
}

// ─── HMAC verification ───────────────────────────────────────────────────
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature.startsWith("sha256=")) return false;
  const expected = signature.slice(7);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(hex, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
