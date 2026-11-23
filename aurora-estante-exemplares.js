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

  const isMember = item => item && typeof item.key === 'string' && Number.isInteger(item.section) && item.section >= 0;

  function storedRecords(key) {
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(records)) throw new Error('Lista de exemplares inválida.');
    return records;
  }

  function read(key) {
    try { return storedRecords(key).filter(isMember); } catch { return []; }
  }

  function updateMembership(key,edit) {
    const commit = () => {
      const records = storedRecords(key);
      const updated = edit(records);
      if (updated) localStorage.setItem(key,JSON.stringify(updated));
      return (updated || records).filter(isMember);
    };
    return navigator.locks ? navigator.locks.request(key,commit) : commit();
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
    if (row.classList.contains('editor-book-row')) row.tabIndex = row.scrollWidth > row.clientWidth ? 0 : -1;
  }

  function bookRow(section,index,editor) {
    let row = section.querySelector('.personal-book-row');
    if (!row) {
      row = element('div','personal-book-row');
      if (editor) {
        row.classList.add('editor-book-row');
        row.setAttribute('role','group');
        row.setAttribute('aria-label','Livros da prateleira '+(index+1));
      }
      section.insertBefore(row,section.querySelector('.shelf-board'));
    }
    return row;
  }

  function makeCopy(book,key,editor) {
    if (editor) {
      const copy = window.AuroraEditorAcervo.makeSpine(book);
      copy.setAttribute('aria-label','Ajustar medidas de '+(window.AuroraTitles?.display(book.title) || book.title));
      copy.setAttribute('aria-haspopup','dialog');
      copy.removeAttribute('title');
      return copy;
    }
    const copy = book.button.cloneNode(true);
    copy.disabled = false;
    copy.style.visibility = '';
    copy.classList.remove('selected-book');
    if (copy.dataset.lombada === 'pending') delete copy.dataset.lombada;
    copy.addEventListener('click', () => {
      const source = catalog().get(key)?.button;
      if (!source) { schedule(); return; }
      origin = {source, copy};
      source.click();
    });
    return copy;
  }

  const heights = new Set(['original','bolso','brochura','capa-dura','grande']);
  const widths = new Set(['original','fino','medio','grande']);
  const validSize = size => heights.has(size?.height) && widths.has(size?.width);

  function sizeOf(member) {
    return {
      height:heights.has(member.height) ? member.height : 'original',
      width:widths.has(member.width) ? member.width : 'original'
    };
  }

  function getSize(key) {
    const member = active?.members.find(entry => entry.key === key);
    return member ? sizeOf(member) : null;
  }

  function applySize(copy,size) {
    if ((copy.dataset.shelfHeight || 'original') === size.height &&
        (copy.dataset.shelfWidth || 'original') === size.width) return;
    if (size.height === 'original') delete copy.dataset.shelfHeight;
    else copy.dataset.shelfHeight = size.height;
    if (size.width === 'original') delete copy.dataset.shelfWidth;
    else copy.dataset.shelfWidth = size.width;
    // Recalcula só a tipografia/textura deste exemplar nas novas proporções.
    const title = copy.querySelector('.spine-title');
    if (title) title.style.fontSize = '';
    delete copy.dataset.lombada;
    if (copy.isConnected) window.AuroraLombadas?.enhance(copy);
  }

  function cancelSize(key) {
    if (active?.preview?.key !== key) return;
    const {row,scrollLeft} = active.preview;
    active.preview = null;
    const copy = active.copies.get(key)?.copy, size = getSize(key);
    if (copy && size) {
      applySize(copy,size);
      if (copy.parentElement === row) row.scrollLeft = scrollLeft;
      layout();
    }
  }

  function previewSize(key,size) {
    const copy = active?.copies.get(key)?.copy;
    if (!active?.editor || !copy?.isConnected || !validSize(size)) return false;
    if (active.preview && active.preview.key !== key) cancelSize(active.preview.key);
    const row = copy.parentElement;
    const scrollLeft = active.preview?.row === row ? active.preview.scrollLeft : row.scrollLeft;
    active.preview = {key,height:size.height,width:size.width,row,scrollLeft};
    applySize(copy,size);
    row.scrollLeft = scrollLeft;
    layout();
    return true;
  }

  async function saveSize(key,size) {
    const view = active;
    if (!view?.editor || !validSize(size)) throw new Error('Medidas de livro inválidas.');
    const {height,width} = size;
    const members = await updateMembership(view.key,records => {
      const member = records.find(entry => isMember(entry) && entry.key === key);
      if (active !== view || !member) throw new Error('Este exemplar saiu da estante.');
      if (height === 'original') delete member.height;
      else member.height = height;
      if (width === 'original') delete member.width;
      else member.width = width;
      return records;
    });
    if (active !== view) return;
    view.members = members;
    if (view.preview?.key === key) view.preview = null;
    draw();
  }

  const visualFields = ['title','author','source','cover','spine','coverSource','total','ratio','spineAspect','bookmarked'];
  function draw() {
    const {scene,editor,members,books,copies} = active;
    const rows = [...scene.querySelectorAll('.shelf-section')].map((section,i) => bookRow(section,i,editor));
    if (!rows.length) { copies.clear(); return; }
    const contents = rows.map(() => []);
    const keys = new Set();
    for (const member of members) {
      const {key,section} = member;
      const book = books.get(key);
      if (!book || keys.has(key)) continue;
      keys.add(key);
      let entry = copies.get(key);
      const reuse = entry && (entry.book === book || (editor && visualFields.every(field => book[field] === entry.book[field])));
      if (!reuse) {
        const copy = makeCopy(book,key,editor);
        copy.dataset.personalBookKey = key;
        entry = {copy,book};
        copies.set(key,entry);
      } else entry.book = book;
      applySize(entry.copy,active.preview?.key === key ? active.preview : sizeOf(member));
      // Uma seção removida pode ser recuperada ao desfazer. O vínculo original é preservado.
      contents[Math.min(section,rows.length-1)].push(entry.copy);
    }
    for (const key of copies.keys()) if (!keys.has(key)) copies.delete(key);
    rows.forEach((row,i) => {
      const children = contents[i];
      children.forEach((copy,index) => {
        const atIndex = row.children[index];
        if (atIndex !== copy) row.insertBefore(copy,atIndex || null);
      });
      while (row.childElementCount > children.length) row.lastElementChild.remove();
      row.hidden = children.length === 0;
      if (!row.hidden) {
        placeRow(row);
        if (!editor) children.forEach(copy => window.AuroraLombadas?.enhance?.(copy));
      }
    });
  }

  async function refresh() {
    const view = active;
    view.members = read(view.key);
    if (view.preview && !view.members.some(member => member.key === view.preview.key)) view.preview = null;
    if (view.editor) {
      const request = ++view.request;
      if (view.members.length) {
        const current = () => active === view && view.request === request;
        const progress = view.books.size ? undefined : partial => {
          if (!current()) return;
          view.books = partial;
          draw();
        };
        try {
          const books = await window.AuroraEditorAcervo.load(view.members.map(item => item.key),progress,view.books);
          if (!current()) return;
          view.books = books;
        } catch (error) {
          if (!current()) return;
          console.warn('Não foi possível atualizar os livros da estante.',error);
        }
      } else view.books.clear();
    } else view.books = catalog();
    draw();
    if (picker?.dialog.open) updatePicker();
  }

  function schedule() {
    if (!active || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      void refresh();
    });
  }

  // Mover um enfeite altera apenas o espaço livre. Mantém cada lombada e sua textura no DOM.
  let layoutFrame = 0;
  function layout() {
    if (!active || layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      active.scene.querySelectorAll('.personal-book-row:not([hidden])').forEach(placeRow);
    });
  }

  function render(shelf,scene,{editor = false} = {}) {
    if (!shelf?.id || !scene) { clear(); return; }
    const key = prefix + encodeURIComponent(shelf.id);
    if (active?.key === key && active.scene === scene && active.editor === editor) {
      draw();
      return;
    }
    clear();
    active = {scene,key,editor,members:[],books:new Map(),copies:new Map(),request:0};
    void refresh();
  }

  function clear() {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(layoutFrame);
    frame = layoutFrame = 0;
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
    try {
      await updateMembership(key,saved => {
        if (!add) return saved.filter(entry => entry?.key !== bookKey);
        if (saved.some(entry => isMember(entry) && entry.key === bookKey)) return;
        saved.push({key:bookKey,section});
        return saved;
      });
      if (active?.key !== key) return;
      await refresh();
      if (active?.key !== key) return;
      picker.status.textContent = add ? '“'+title+'” na prateleira '+(section+1)+'.' : '“'+title+'” retirado desta estante.';
    } catch {
      if (active?.key === key) picker.status.textContent = 'Não foi possível salvar a alteração neste aparelho.';
    }
  }

  window.addEventListener('resize',layout);
  const storageKeys = new Set(['aurora-books','aurora-txt-categories','aurora-hidden-books','aurora-online-books-v1']);
  window.addEventListener('storage', event => {
    if (event.key === null || event.key === active?.key || (active?.editor && storageKeys.has(event.key))) schedule();
  });
  // IndexedDB não emite storage quando uma edição é importada ou retirada em outra aba.
  window.addEventListener('focus', () => { if (active?.editor) schedule(); });
  window.addEventListener('pageshow', event => { if (event.persisted && active?.editor) schedule(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && active?.editor) schedule(); });
  for (const name of ['aurora:library-data','aurora:shelves-drawn','aurora:online-books-ready','aurora:book-cover-updated']) {
    document.addEventListener(name,schedule);
  }
  window.AuroraEstanteExemplares = {render,layout,openPicker,clear,originFor,getSize,previewSize,saveSize,cancelSize};
})();
