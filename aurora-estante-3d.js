/* Prévia da estante com as artes dos exemplares guardados neste aparelho. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('previa') !== 'estante-3d') return;

  const poses = {
    envelope: {yaw:1.36, pitch:.055, roll:0},
    jane: {yaw:1.23, pitch:.07, roll:-.045}
  };
  function identify(title) {
    const name = window.AuroraTitles.display(title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    if (/^(?:o )?envelope sobre a mesa(?:$|\s*[-–—:(\[]|\s+anderson abreu\b)/.test(name)) return 'envelope';
    if (/^jane eyre(?:$|\s*[-–—:(\[]|\s+charlotte bronte\b)/.test(name)) return 'jane';
    return '';
  }

  let running = false, pending = false;
  async function render(button, book, pose) {
    const front = button.querySelector('.shelf-book-cover img');
    const current = () => button.isConnected && button.querySelector('.shelf-book-cover img') === front;
    if (!front || !book.cover) return;
    button.dataset.shelfPose = pose;
    if (button.dataset.shelfPreview === 'ready' && button.querySelector('.shelf-3d-preview-image')) return;
    button.dataset.shelfPreview = 'css';
    if (!window.Aurora3D?.renderShelfPreview || window.__auroraSelectedBook) return;
    const src = await window.Aurora3D.renderShelfPreview(book, {
      view:'volume',width:360,height:780,...poses[pose]
    });
    if (!src || !current()) return;
    const image = new Image();
    image.className = 'shelf-3d-preview-image';
    image.alt = '';
    image.decoding = 'async';
    image.src = src;
    await image.decode();
    if (!current()) return;
    button.style.setProperty('--preview-aspect', String(image.naturalWidth / image.naturalHeight));
    button.append(image);
    button.dataset.shelfPreview = 'ready';
  }

  let firstPosition = location.hash === '#previa';
  async function refresh() {
    pending = true;
    if (running) return;
    running = true;
    try {
      while (pending) {
        pending = false;
        const books = new Map((window.AuroraImportedBooks || []).map(book => [String(book.id),book]));
        for (const button of document.querySelectorAll('#library .book-spine[data-book-id]')) {
          const book = books.get(button.dataset.bookId);
          if (!book) continue;
          const pose = identify(book.title) || identify(book.name);
          if (!pose) continue;
          if (firstPosition) {
            firstPosition = false;
            button.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
          }
          try { await render(button,book,pose); }
          catch (error) { console.warn('Prévia do exemplar mantida em CSS:',error); }
        }
      }
    } finally { running = false; }
  }

  document.addEventListener('aurora:library-data',refresh);
  document.addEventListener('aurora:book-cover-updated',refresh);
  window.addEventListener('aurora:3d-ready',refresh);
  window.addEventListener('aurora:book-closed',() => queueMicrotask(refresh));
  void refresh();
})();
