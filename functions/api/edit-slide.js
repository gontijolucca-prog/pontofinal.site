// CloudFlare Pages Function — salva edições de texto directamente no
// ficheiro HTML do post via GitHub API. Commit atómico no branch main,
// que triggers auto-deploy do CF Pages.
//
// POST /api/edit-slide
// Body: { filePath, htmlContent, message }
//   filePath    — path relativo no repo (ex: public/brands/techbody/output/2026-07/carrosseis/c01.html)
//   htmlContent — HTML completo já modificado (string)
//   message     — mensagem de commit (opcional, tem default)
//
// Env vars (Cloudflare Pages → Settings → Environment variables):
//   GH_TOKEN  (obrigatória)  — GitHub Personal Access Token com repo scope
//   GH_OWNER  (opcional)     — default: gontijolucca-prog
//   GH_REPO   (opcional)     — default: pontofinal.site
//   GH_BRANCH (opcional)     — default: main

const OWNER_DEFAULT = "gontijolucca-prog";
const REPO_DEFAULT = "pontofinal.site";
const BRANCH_DEFAULT = "main";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GH_TOKEN) {
    return json({ error: "missing_gh_token" }, 500);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { filePath, htmlContent, message } = data;
  if (!filePath || typeof filePath !== "string") {
    return json({ error: "missing_filePath" }, 400);
  }
  if (!htmlContent || typeof htmlContent !== "string") {
    return json({ error: "missing_htmlContent" }, 400);
  }

  // Security: só permitir editar ficheiros dentro de public/brands/
  if (!filePath.startsWith("public/brands/")) {
    return json({ error: "forbidden_path", detail: "Only public/brands/* allowed" }, 403);
  }

  const owner = env.GH_OWNER || OWNER_DEFAULT;
  const repo = env.GH_REPO || REPO_DEFAULT;
  const branch = env.GH_BRANCH || BRANCH_DEFAULT;
  const token = env.GH_TOKEN;
  const apiBase = "https://api.github.com";

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // 1. Get current file SHA (needed for update)
  let sha;
  try {
    const resp = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, { headers });
    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: "github_fetch_failed", status: resp.status, detail }, 502);
    }
    const fileData = await resp.json();
    sha = fileData.sha;
  } catch (e) {
    return json({ error: "github_fetch_error", detail: String(e) }, 502);
  }

  // 2. Update the file
  try {
    const content = btoa(unescape(encodeURIComponent(htmlContent)));
    const resp = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message || `edit: text update via approval page`,
        content,
        sha,
        branch,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: "github_update_failed", status: resp.status, detail }, 502);
    }

    const result = await resp.json();
    return json({ ok: true, commit: result.commit?.sha, html_url: result.commit?.html_url });
  } catch (e) {
    return json({ error: "github_update_error", detail: String(e) }, 502);
  }
}

// OPTIONS handler for CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}