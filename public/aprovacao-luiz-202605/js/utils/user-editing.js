// user-editing — devolve TRUE quando o foco está num campo de texto editável.
// Usado para nunca interromper uma escrita em curso (version-gate quando dispara
// reload nuclear, data-loader quando re-renderiza tiles, etc.). Centralizado
// para que o critério seja idêntico em todos os pontos.
//
// Considera-se "a editar" se o elemento activo é:
//   • <textarea>
//   • elemento com [contenteditable]
//   • <input> com type de texto ("text" / "email" / "search" / "url" / "tel"
//     / "number" / "password" / "" — o type vazio é tratado como "text" pelos
//     browsers)

export function userIsEditing(root = document) {
  const a = root.activeElement;
  if (!a) return false;
  if (a.tagName === "TEXTAREA" || a.isContentEditable) return true;
  if (a.tagName === "INPUT") {
    const t = (a.getAttribute("type") || "").toLowerCase();
    return /^(text|email|search|url|tel|number|password|)$/.test(t);
  }
  return false;
}

// Variação local: limita a verificação a uma subárvore do DOM. Útil para um
// componente perguntar "o foco está DENTRO de mim?" antes de se re-renderizar.
export function userIsEditingInside(node) {
  if (!node) return false;
  const a = document.activeElement;
  if (!a || !node.contains(a)) return false;
  return userIsEditing();
}
