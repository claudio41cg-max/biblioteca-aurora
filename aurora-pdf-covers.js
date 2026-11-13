/* Reconhece uma possível contracapa REAL quando ela consta no fim do PDF.
   Não usa a última página de texto de um romance como se fosse uma contracapa. */
(() => {
  'use strict';
  async function extractBack(pdf,renderImage) {
    if (!pdf || pdf.numPages < 2 || !window.pdfjsLib?.OPS) return '';
    const last = await pdf.getPage(pdf.numPages);
    const previous = await pdf.getPage(pdf.numPages-1);
    const [lastText,previousText,operators] = await Promise.all([
      last.getTextContent(),previous.getTextContent(),last.getOperatorList()
    ]);
    const textLength = data => (data.items||[]).map(item=>item.str||'').join(' ').trim().length;
    const length = textLength(lastText);
    const previousLength = textLength(previousText);
    // PDFs digitalizados com todas as páginas em imagem não permitem determinar
    // automaticamente se a página final é uma contracapa ou o fim do texto.
    if (pdf.numPages > 3 && previousLength < 25) return '';
    if (length > 950 || (previousLength > 100 && length > previousLength * .8)) return '';
    const ops = window.pdfjsLib.OPS;
    const imageOps = [ops.paintImageXObject,ops.paintInlineImageXObject,
      ops.paintJpegXObject,ops.paintImageXObjectRepeat,ops.paintInlineImageXObjectGroup];
    if (!operators.fnArray.some(operator=>imageOps.includes(operator))) return '';
    const first = await pdf.getPage(1);
    const firstSize = first.getViewport({scale:1});
    const lastSize = last.getViewport({scale:1});
    const ratioDifference=Math.abs(firstSize.width/firstSize.height-lastSize.width/lastSize.height);
    if (ratioDifference > .12) return '';
    return renderImage(pdf,pdf.numPages,950);
  }
  window.AuroraPDFCovers={extractBack};
})();
