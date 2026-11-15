/* Exibe o título literário sem anúncios, ISBN, editoras ou códigos do arquivo.
   O nome original permanece guardado no registro para não perder metadados. */
(() => {
  'use strict';
  function display(raw){
    const original=String(raw||'').trim();
    if(!original)return 'Livro sem título';
    let title=original.replace(/\.(?:pdf|epub|pages|mobi|azw3|txt|mp3|m4a|m4b)$/i,'')
      .replace(/[_]+/g,' ').replace(/\s+/g,' ').trim();
    const noisyTail=/(?:\s*[\[(]?\s*)(?:sucesso\s+(?:do|no|de)\s+tiktok|portuguese\s+edition|edi[cç][aã]o\s+portuguesa|anna'?s?\s+archive|isbn\s*[:\-]?|editora\s+[a-záàâãéêíóôõúüç]|\b978\d{10}\b|\b[0-9a-f]{24,}\b)/i;
    const match=title.search(noisyTail);
    if(match>2)title=title.slice(0,match);
    title=title.replace(/[\s,;:_\-()[\]]+$/g,'').trim();
    if(/^a hipotese do amor$/i.test(title))return 'A hipótese do amor';
    return title.length>1?title:original;
  }
  window.AuroraTitles={display};
})();
