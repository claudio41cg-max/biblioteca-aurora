/* Biblioteca Aurora: mostra PDFs locais diretamente na estante principal. */
(() => {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const dbRequest = indexedDB.open('aurora-pdf-library', 2);
  dbRequest.onupgradeneeded = () => {
    const database = dbRequest.result;
    if (!database.objectStoreNames.contains('books')) database.createObjectStore('books', {keyPath: 'id'});
    if (!database.objectStoreNames.contains('progress')) database.createObjectStore('progress', {keyPath: 'id'});
  };
  dbRequest.onerror = () => console.warn('A estante não conseguiu consultar os PDFs deste aparelho.');
  dbRequest.onsuccess = () => {
    const database = dbRequest.result;
    const readAll = store => new Promise(resolve => {
      const request = database.transaction(store, 'readonly').objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
    Promise.all([readAll('books'), readAll('progress')]).then(([books, progress]) => {
      database.close();
      if (!books.length) return;
      const lastPages = new Map(progress.map(p => [p.id, p]));
      const imported = books.map(b => ({
        id: b.id, name: b.name || 'Livro sem título', cover: b.cover || '',
        page: lastPages.get(b.id)?.page ?? b.page ?? 0,
        bookmarked: Number.isInteger(lastPages.get(b.id)?.bookmark),
        created: b.created || 0
      })).sort((a, b) => a.created - b.created);
      const matched = new Set();
      const makeSpine = b => {
        const button = document.createElement('button');
        button.className = 'aurora-pdf-spine';
        button.setAttribute('aria-label', 'Retirar da estante: ' + b.name);
        button.title = b.name + ' • toque para retirar o livro';
        if (b.cover) {
          const art = document.createElement('span');
          art.className = 'aurora-pdf-spine-art';
          art.style.backgroundImage = 'url(' + JSON.stringify(b.cover) + ')';
          button.append(art);
        }
        const title = document.createElement('span');
        title.className = 'aurora-pdf-spine-title';
        title.textContent = b.name.replace(/[-_]+/g, ' ');
        button.append(title);
        if (b.bookmarked) {
          const ribbon = document.createElement('span');
          ribbon.className = 'aurora-pdf-ribbon';
          ribbon.setAttribute('aria-label', 'Tem marcador de página');
          ribbon.textContent = '◆';
          button.append(ribbon);
        }
        button.onclick = () => location.href = './meus-livros.html?livro=' + encodeURIComponent(b.id);
        return button;
      };
      // Substitui os volumes demonstrativos quando o mesmo título já foi importado.
      document.querySelectorAll('.cover').forEach(button => {
        const demoTitle = button.querySelector('.cover-title')?.textContent;
        const match = imported.find(b => !matched.has(b.id) && normalize(b.name) === normalize(demoTitle));
        if (match) {
          matched.add(match.id);
          button.replaceWith(makeSpine(match));
        }
      });
      const rest = imported.filter(b => !matched.has(b.id));
      if (rest.length) {
        const library = document.getElementById('library');
        const heading = document.createElement('h2');
        heading.className = 'section-title';
        heading.textContent = 'Meus livros em PDF';
        const cabinet = document.createElement('div');
        cabinet.className = 'cabinet';
        const row = document.createElement('div');
        row.className = 'bookrow aurora-pdf-row';
        rest.forEach(book => row.append(makeSpine(book)));
        const plank = document.createElement('div');
        plank.className = 'plank';
        cabinet.append(row, plank);
        const note = library.querySelector('.note');
        library.insertBefore(heading, note);
        library.insertBefore(cabinet, note);
      }
      const note = document.querySelector('#library > .note');
      if (note) note.textContent = 'Seus PDFs estão guardados nesta estante. Toque na lombada para pegar o livro e abrir sua capa original em 3D.';
    }).catch(error => console.warn('Falha ao carregar PDFs da estante', error));
  };
})();
