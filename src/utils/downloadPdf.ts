import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function downloadAsPdf(containerId: string, filename: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const pageEls = container.querySelectorAll<HTMLElement>('.a4-page');
  if (pageEls.length === 0) return;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  let first = true;

  for (const el of pageEls) {
    // Force A4 dimensions and desktop padding for capture
    const origOverflow = document.body.style.overflow;
    const origInlineWidth = el.style.width;
    const origInlineMaxWidth = el.style.maxWidth;
    const origInlinePadding = el.style.padding;
    const origBoxSizing = el.style.boxSizing;

    document.body.style.overflow = 'hidden';
    el.style.width = '210mm';
    el.style.maxWidth = '210mm';
    el.style.padding = '15mm 20mm';
    el.style.boxSizing = 'border-box';

    el.classList.add('pdf-capture');

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      allowTaint: false,
      width: 794, // ~210mm at 96dpi
    });

    el.classList.remove('pdf-capture');

    // Restore original styles
    document.body.style.overflow = origOverflow;
    el.style.width = origInlineWidth;
    el.style.maxWidth = origInlineMaxWidth;
    el.style.padding = origInlinePadding;
    el.style.boxSizing = origBoxSizing;

    const data = canvas.toDataURL('image/png');
    const imgW = pdfW;
    const imgH = (canvas.height * pdfW) / canvas.width;

    if (!first) pdf.addPage();
    first = false;

    if (imgH <= pdfH) {
      pdf.addImage(data, 'PNG', 0, 0, imgW, imgH, undefined, 'FAST');
    } else {
      const ratio = canvas.width / pdfW;
      let remainingH = canvas.height;
      let srcY = 0;
      let pageNum = 0;

      while (remainingH > 0) {
        if (pageNum > 0) pdf.addPage();

        const slicePx = Math.min(remainingH, pdfH * ratio);
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width;
        tmp.height = slicePx;
        const ctx = tmp.getContext('2d')!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

        pdf.addImage(tmp.toDataURL('image/png'), 'PNG', 0, 0, imgW, slicePx / ratio, undefined, 'FAST');

        srcY += slicePx;
        remainingH -= slicePx;
        pageNum++;
      }
    }
  }

  pdf.save(filename);
}
