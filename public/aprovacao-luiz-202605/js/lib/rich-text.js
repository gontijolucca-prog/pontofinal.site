// rich-text.js — preserva a formatação ao editar o texto das imagens.
// O texto editável usa uma convenção leve, legível para o cliente:
//   • quebras de linha reais (Enter no textarea) → <br>
//   • *palavra* → <em>palavra</em>  (palavra-acento)
// Assim, editar o texto de um slide/story nunca perde as quebras de linha nem
// o destaque, e o texto guardado (override) é o mesmo que vai à publicação.

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Texto editável → HTML seguro (para injectar no h1/h2/blockquote do preview).
export function fmtToHtml(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");   // *acento* → <em>
  out = out.replace(/\r?\n/g, "<br>");                  // quebras de linha
  return out;
}

// HTML do elemento → texto editável (round-trip), para semear o textarea
// mantendo a formatação original visível como marcadores.
export function htmlToFmt(elOrHtml) {
  let html = typeof elOrHtml === "string" ? elOrHtml : (elOrHtml ? elOrHtml.innerHTML : "");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*");
  html = html.replace(/<\/?(strong|b|i)>/gi, "");        // outras tags inline: ignora marcador
  html = html.replace(/<[^>]+>/g, "");                   // remove restantes tags
  const tmp = document.createElement("textarea");
  tmp.innerHTML = html;                                  // de-escapa entidades (&amp; etc.)
  return tmp.value.replace(/ /g, " ").trim();
}
