// Envia um email de notificação sempre que alguém preenche o formulário
// de contacto do site. Chamado em paralelo ao registo no Firestore
// (o Firestore continua a ser a fonte de verdade do back office; este
// email é best-effort para o Lucca não perder leads).
//
// Usa o Resend (https://resend.com). A API key é injectada server-side
// via variável de ambiente do projeto Cloudflare Pages — nunca chega ao
// cliente.
//
// Variáveis de ambiente (Cloudflare Pages → Settings → Environment variables):
//   RESEND_API_KEY  (obrigatória)   chave da conta Resend
//   NOTIFY_TO       (opcional)      destinatário; default geral@pontofinal.site
//   NOTIFY_FROM     (opcional)      remetente; default onboarding@resend.dev
//                                   (mudar para geral@pontofinal.site após verificar o domínio no Resend)

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "missing_resend_key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const to = env.NOTIFY_TO || "geral@pontofinal.site";
  const from = env.NOTIFY_FROM || "PontoFinal <onboarding@resend.dev>";

  const nome = data.nome_empresa || "(sem nome)";
  const plano = data.plano_interesse || "—";
  const metodo = data.contacto_metodo || "—";
  const contacto = data.contacto_valor || "—";
  const descricao = data.descricao || "—";
  const quando = new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" });

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 4px">Novo pedido no site 🔔</h2>
      <p style="color:#666;margin:0 0 16px">${esc(quando)}</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:8px 0;font-weight:bold;width:140px">Nome / Empresa</td><td style="padding:8px 0">${esc(nome)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold">Contacto (${esc(metodo)})</td><td style="padding:8px 0">${esc(contacto)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold">Interesse</td><td style="padding:8px 0">${esc(plano)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:bold;vertical-align:top">Projeto</td><td style="padding:8px 0">${esc(descricao)}</td></tr>
      </table>
      <p style="margin-top:20px"><a href="https://pontofinal.site/#/admin" style="background:#FF2A2A;color:#fff;padding:10px 18px;text-decoration:none;font-weight:bold">Ver no back office</a></p>
    </div>`;

  const text =
    `Novo pedido no site (${quando})\n\n` +
    `Nome/Empresa: ${nome}\n` +
    `Contacto (${metodo}): ${contacto}\n` +
    `Interesse: ${plano}\n` +
    `Projeto: ${descricao}\n\n` +
    `Back office: https://pontofinal.site/#/admin`;

  const replyTo = metodo === "email" && contacto.includes("@") ? contacto : undefined;

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Novo pedido: ${nome}`,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "resend_fetch_failed", detail: String(e) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ok = res.ok;
  const detail = await res.text();
  return new Response(JSON.stringify({ ok, detail }), {
    status: ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}
