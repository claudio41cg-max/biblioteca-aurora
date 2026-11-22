/* As estantes pessoais guardam referências aos exemplares do acervo do aparelho. */
(() => {
  'use strict';
  const prefix = 'aurora-estante-exemplares-v1:';
  const formats = {demo:'Amostra', txt:'TXT', pdf:'PDF', epub:'EPUB', audio:'Audiolivro', online:'Online'};
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let active = null, picker = null, origin = null, frame = 0;

  function catalog() {
    const books = new Map();
    for (const button of document.querySelectorAll('#library .bookrow > .book-spine')) {
      const {source, bookId, rawTitle, author} = button.dataset;
      const key = (bookId && source !== 'online' ? 'arquivo' : source) + ':' + (bookId || rawTitle);
      const title = window.AuroraTitles?.display(rawTitle) || rawTitle;
      if (!title || !source) continue;
      const category = button.parentElement.id.slice('shelf-'.length);
      books.set(key, {key, title, author:author || '', category, source, button});
    }
    return books;
  }

  function read(key) {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
    if (!Array.isArray(saved)) return [];
    return saved.filter(item => item && typeof item.key === 'string' && Number.isInteger(item.section) && item.section >= 0);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function placeRow(row) {
    const section = row.parentElement;
    const bounds = section.getBoundingClientRect();
    if (!bounds.width) return;
    const areas = [...section.querySelectorAll('.shelf-object')].map(object => {
      const box = object.getBoundingClientRect();
      return [Math.max(0,box.left-bounds.left-5), Math.min(bounds.width,box.right-bounds.left+5)];
    }).sort((a,b) => a[0]-b[0]);
    let start = 0, bestStart = 0, bestWidth = 0;
    for (const [left,right] of [...areas,[bounds.width,bounds.width]]) {
      if (left-start > bestWidth) { bestStart=start; bestWidth=left-start; }
      start = Math.max(start,right);
    }
    // Mesmo uma prateleira totalmente decorada continua rolável para acessar os títulos.
    row.style.left = bestWidth >= 54 ? bestStart+'px' : '0';
    row.style.right = bestWidth >= 54 ? Math.max(0,bounds.width-bestStart-bestWidth)+'px' : '0';
  }

  function draw() {
    if (!active) return;
    const {scene, key} = active;
    const books = catalog();
    const sections = [...scene.querySelectorAll('.shelf-section')];
    if (!sections.length) return;
    const rows = sections.map(section => {
      let row = section.querySelector('.personal-book-row');
      if (!row) {
        row = element('div','personal-book-row');
        section.insertBefore(row,section.querySelector('.shelf-board'));
      }
      return row;
    });
    const contents = rows.map(() => document.createDocumentFragment());
    for (const item of read(key)) {
      const book = books.get(item.key);
      if (!book) continue;
      const copy = book.button.cloneNode(true);
      copy.dataset.personalBookKey = item.key;
      copy.disabled = false;
      copy.style.visibility = '';
      copy.classList.remove('selected-book');
      if (copy.dataset.lombada === 'pending') delete copy.dataset.lombada;
      copy.addEventListener('click', () => {
        const source = catalog().get(item.key)?.button;
        if (!source) { schedule(); return; }
        origin = {source, copy};
        source.click();
      });
      // Ao diminuir as seções no editor, os livros continuam acessíveis na última.
      contents[Math.min(item.section, sections.length-1)].append(copy);
    }
    rows.forEach((row,i) => {
      const offset = row.scrollLeft;
      row.replaceChildren(contents[i]);
      row.hidden = !row.childElementCount;
      if (row.hidden) return;
      placeRow(row);
      row.scrollLeft = offset;
      for (const copy of row.children) window.AuroraLombadas?.enhance?.(copy);
    });
  }

  function schedule() {
    if (!active || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
      if (picker?.dialog.open) updatePicker();
    });
  }

  function render(shelf,scene) {
    if (!shelf?.id || !scene) { clear(); return; }
    const key = prefix + encodeURIComponent(shelf.id);
    if (active?.key !== key || active.scene !== scene) clear();
    active = {shelf,scene,key};
    draw();
  }

  function clear() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (picker?.dialog.open) picker.dialog.close();
    active = null; origin = null;
  }

  function originFor(button) {
    if (origin?.source !== button || !origin.copy.isConnected) return null;
    const copy = origin.copy;
    origin = null;
    return copy;
  }

  function choose(label,name) {
    const control = element('label');
    control.append(element('span','',label));
    const select = element('select');
    select.name = name;
    control.append(select);
    return {control,select};
  }

  function makePicker() {
    const dialog = element('dialog','shelf-book-picker');
    dialog.id = 'shelfBookPicker';
    dialog.setAttribute('aria-labelledby','shelfBookPickerTitle');
    const header = element('header');
    const title = element('h2','','Adicionar livros');
    title.id = 'shelfBookPickerTitle';
    const close = element('button','shelf-picker-close','Fechar');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    header.append(title,close);
    const controls = element('div','shelf-picker-fields');
    const section = choose('Prateleira','section');
    const category = choose('Gênero','category');
    const searchLabel = element('label','shelf-picker-search');
    searchLabel.append(element('span','','Buscar no acervo'));
    const search = element('input');
    search.type = 'search'; search.placeholder = 'Título ou autor';
    searchLabel.append(search);
    controls.append(section.control,category.control,searchLabel);
    const list = element('ul','shelf-picker-books');
    const status = element('p','shelf-picker-status');
    status.setAttribute('role','status');
    dialog.append(header,controls,list,status);
    category.select.addEventListener('change',updatePicker);
    search.addEventListener('input',updatePicker);
    list.addEventListener('click', event => {
      const action = event.target.closest('button[data-book-key]');
      if (action) changeMembership(action.dataset.bookKey,action.dataset.add === 'true');
    });
    document.body.append(dialog);
    return {dialog,section:section.select,category:category.select,search,list,status};
  }

  function openPicker() {
    if (!active) return;
    if (!picker) picker = makePicker();
    if (picker.dialog.open) return;
    const sections = active.scene.querySelectorAll('.shelf-section');
    picker.section.replaceChildren(...Array.from(sections,(_,i) => new Option('Prateleira '+(i+1),String(i))));
    picker.category.replaceChildren(new Option('Todos os gêneros',''),
      ...(window.AuroraShelf?.categories || []).map(cat => new Option(cat.name,cat.id)));
    picker.search.value = '';
    picker.status.textContent = '';
    updatePicker();
    picker.dialog.showModal();
  }

  function updatePicker() {
    if (!active || !picker) return;
    const saved = new Map(read(active.key).map(item => [item.key,item.section]));
    const books = [...catalog().values()].filter(book => (!picker.category.value || picker.category.value === book.category) &&
      normalize(book.title+' '+book.author).includes(normalize(picker.search.value).trim()));
    books.sort((a,b) => a.title.localeCompare(b.title,'pt-BR'));
    const items = document.createDocumentFragment();
    const focusKey = document.activeElement?.dataset.bookKey;
    let focusAfter = null;
    const count = picker.section.options.length;
    for (const book of books) {
      const li = element('li');
      const label = element('div');
      const placed = saved.has(book.key);
      const details = [book.author,formats[book.source] || book.source];
      if (placed && count) details.push('Prateleira '+(Math.min(saved.get(book.key),count-1)+1));
      label.append(element('strong','',book.title),element('small','',details.filter(Boolean).join(' · ')));
      const action = element('button','shelf-picker-action',placed?'Retirar':'Adicionar');
      action.type = 'button';
      action.dataset.bookKey = book.key;
      action.dataset.add = String(!placed);
      action.disabled = !placed && !count;
      action.setAttribute('aria-label',placed?'Retirar '+book.title+' desta estante':'Adicionar '+book.title+' à estante');
      if (book.key === focusKey) focusAfter = action;
      li.append(label,action); items.append(li);
    }
    if (!books.length) items.append(element('li','shelf-picker-empty','Nenhum livro encontrado.'));
    picker.list.replaceChildren(items);
    if (!count) picker.status.textContent = 'Adicione uma prateleira no editor para colocar livros aqui.';
    focusAfter?.focus({preventScroll:true});
  }

  async function changeMembership(bookKey,add) {
    if (!active || !picker) return;
    const key = active.key;
    const section = Number(picker.section.value);
    const title = catalog().get(bookKey)?.title;
    if (!title || (add && !picker.section.options.length)) return;
    const save = () => {
      const saved = read(key);
      if (add) {
        if (saved.some(entry => entry.key === bookKey)) return;
        saved.push({key:bookKey,section});
        localStorage.setItem(key,JSON.stringify(saved));
      } else localStorage.setItem(key,JSON.stringify(saved.filter(entry => entry.key !== bookKey)));
    };
    try {
      if (navigator.locks) await navigator.locks.request(key,save);
      else save();
      if (active?.key !== key) return;
      draw();
      updatePicker();
      picker.status.textContent = add ? '“'+title+'” na prateleira '+(section+1)+'.' : '“'+title+'” retirado desta estante.';
    } catch {
      if (active?.key === key) picker.status.textContent = 'Não foi possível salvar a alteração neste aparelho.';
    }
  }

  window.addEventListener('resize', () => active?.scene.querySelectorAll('.personal-book-row:not([hidden])').forEach(placeRow));
  window.addEventListener('storage', event => { if (event.key === active?.key || event.key === null) schedule(); });
  for (const name of ['aurora:library-data','aurora:shelves-drawn','aurora:online-books-ready','aurora:book-cover-updated']) {
    document.addEventListener(name,schedule);
  }
  window.AuroraEstanteExemplares = {render,openPicker,clear,originFor};
})();
