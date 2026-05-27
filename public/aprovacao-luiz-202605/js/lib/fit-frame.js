// fitScaledFrame — renderiza o iframe à dimensão EXACTA de publicação
// (1080×1350 carrossel, 1080×1920 story/reel) e escala-o visualmente para
// caber no contentor. Como os vw/vh do HTML resolvem sempre contra 1080×H, a
// pré-visualização, o "ver em grande" e a imagem publicada ficam pixel-idênticos.
//
// Faz "contain" (escala = min dos dois eixos) e centra, por isso funciona tanto
// num contentor com aspect-ratio exacto (cartões) como num que não bate certo
// ao pixel (ex.: o "ver em grande" partilha altura com a barra de navegação).
// O contentor (`wrap`) tem de ter position:relative + overflow:hidden.
// Devolve uma função de cleanup.

export const FRAME_DIMS = {
  carousel: [1080, 1350],
  carrossel: [1080, 1350],
  story: [1080, 1920],
  reel: [1080, 1920],
};

export function dimsFor(format) {
  return FRAME_DIMS[format] || FRAME_DIMS.carousel;
}

export function fitScaledFrame(wrap, nativeW, nativeH) {
  if (!wrap) return () => {};
  const iframe = wrap.querySelector("iframe");
  if (!iframe) return () => {};
  iframe.style.position = "absolute";
  iframe.style.width = nativeW + "px";
  iframe.style.height = nativeH + "px";
  iframe.style.transformOrigin = "top left";
  iframe.style.transform = "scale(0)"; // evita flash a 1080px antes do 1.º apply
  const apply = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;
    const scale = Math.min(w / nativeW, h / nativeH);
    const left = Math.max(0, (w - nativeW * scale) / 2);
    const top = Math.max(0, (h - nativeH * scale) / 2);
    iframe.style.left = left + "px";
    iframe.style.top = top + "px";
    iframe.style.transform = `scale(${scale})`;
  };
  apply();
  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(apply);
    ro.observe(wrap);
  } else {
    window.addEventListener("resize", apply);
  }
  return () => { if (ro) ro.disconnect(); else window.removeEventListener("resize", apply); };
}
