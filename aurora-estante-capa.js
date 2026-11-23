/* A face frontal usa a capa desta edição e a mesma capa ilustrativa disponível no acervo. */
(() => {
  'use strict';
  const prepared = new WeakMap();

  function prepare(button) {
    const source = button.querySelector('.shelf-book-cover img')?.getAttribute('src') || '';
    const rawTitle = button.dataset.rawTitle || '';
    const title = window.AuroraTitles?.display(rawTitle) || button.querySelector('.spine-title')?.textContent || rawTitle || 'Livro';
    const author = button.dataset.author || '';
    const format = button.dataset.source || '';
    const last = prepared.get(button);
    if (last && last.source === source && last.title === title && last.author === author &&
        last.format === format && last.front.parentElement === button) return last.front;

    const front = document.createElement('span');
    front.className = 'personal-book-front';
    front.setAttribute('aria-hidden','true');
    const old = button.querySelector(':scope > .personal-book-front');
    if (old) old.replaceWith(front);
    else button.append(front);
    prepared.set(button,{source,title,author,format,front});

    function showLettering() {
      const name = document.createElement('strong');
      name.textContent = title;
      front.replaceChildren(name);
      if (author) {
        const byline = document.createElement('small');
        byline.textContent = author;
        front.append(byline);
      }
    }

    function showImage(url,onError) {
      const cover = new Image();
      cover.alt = '';
      cover.draggable = false;
      cover.decoding = 'async';
      cover.addEventListener('load',() => {
        if (front.isConnected) window.AuroraEstanteExemplares?.layout();
      },{once:true});
      cover.addEventListener('error',onError,{once:true});
      front.replaceChildren(cover);
      cover.src = url;
    }

    function showIllustration() {
      let url;
      try { url = window.AuroraFormats?.createDigitalCover(title,author,format); }
      catch { /* O título e o autor também podem ser compostos diretamente no papel. */ }
      if (url) showImage(url,showLettering);
      else showLettering();
    }

    if (source) showImage(source,showIllustration);
    else showIllustration();
    return front;
  }

  window.AuroraEstanteCapa = {prepare};
})();
