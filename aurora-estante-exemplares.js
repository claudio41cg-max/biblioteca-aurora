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
    layoutPoses(row);
    for (const layer of section.querySelectorAll('[data-placement]')) {
      if (layer.childElementCount) layoutPoses(layer);
      else layer.remove();
    }
    row.classList.toggle('books-behind',Boolean(section.querySelector('[data-placement="back"]')));
    if (row.classList.contains('editor-book-row')) row.tabIndex = row.scrollWidth > row.clientWidth ? 0 : -1;
  }

  function bookRow(section,index,editor) {
    let row = section.querySelector('.personal-book-row:not([data-placement])');
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
      if (laneOf(copy) === row) row.scrollLeft = scrollLeft;
      layout();
    }
  }

  function previewSize(key,size) {
    const copy = active?.copies.get(key)?.copy;
    if (!active?.editor || !copy?.isConnected || !validSize(size)) return false;
    if (active.preview && active.preview.key !== key) cancelSize(active.preview.key);
    const row = laneOf(copy);
    const scrollLeft = active.preview?.row === row ? active.preview.scrollLeft : row.scrollLeft;
    active.preview = {key,height:size.height,width:size.width,row,scrollLeft};
    applySize(copy,size);
    row.scrollLeft = scrollLeft;
    layout();
    return true;
  }

  const defaults = Object.freeze({scale:1,angle:0,orientation:'vertical',face:'spine',x:null,y:null,layer:0});
  const defaultPose = () => ({...defaults});
  const limit = (value,min,max) => Math.min(max,Math.max(min,value));
  const poses = new WeakMap();
  const slots = new WeakMap();
  const laneOf = copy => slots.get(copy)?.parentElement || copy.parentElement;

  function moveToLayer(copy,row) {
    const pose = poses.get(copy);
    let slot = slots.get(copy);
    if (pose?.x == null && pose?.y == null && !pose?.layer) {
      if (slot) {
        slot.replaceWith(copy);
        slots.delete(copy);
        copy.style.removeProperty('--placed-spine-width');
      }
      return;
    }
    const section = row.parentElement;
    const side = pose.layer < 0 ? 'back' : 'front';
    let layer = section.querySelector('[data-placement="'+side+'"]');
    if (!layer) {
      layer = element('div',row.classList.contains('editor-book-row') ? 'personal-book-row editor-book-row' : 'personal-book-row');
      layer.dataset.placement = side;
      section.append(layer);
    }
    if (!slot) {
      // Reserve o lugar no corredor rolável. A única lombada passa à camada da tábua inteira.
      slot = element('span','book-placement-slot');
      slot.setAttribute('aria-hidden','true');
      const originalWidth = copy.offsetWidth;
      const adjusted = pose.angle || pose.scale !== 1 || pose.orientation === 'horizontal' || pose.face === 'cover';
      const width = originalWidth + (adjusted ? parseFloat(copy.style.getPropertyValue('--pose-space')) || 0 : 0);
      slot.style.flexBasis = width+'px';
      if (pose.face === 'spine' && !copy.dataset.shelfWidth) copy.style.setProperty('--placed-spine-width',originalWidth+'px');
      copy.before(slot);
      slots.set(copy,slot);
    }
    if (copy.parentElement !== layer) layer.append(copy);
  }

  function poseOf(data) {
    const pose = data || {};
    const fraction = n => Number.isFinite(n) ? limit(n,0,1) : null;
    const angle = Number.isFinite(pose.angle) ? Math.round(pose.angle / 5) * 5 % 360 : 0;
    return {
      scale:Number.isFinite(pose.scale) ? limit(Math.round(pose.scale*10)/10,.5,1.5) : 1,
      angle:angle > 180 ? angle-360 : angle < -180 ? angle+360 : angle,
      orientation:pose.orientation === 'horizontal' ? 'horizontal' : 'vertical',
      face:pose.face === 'cover' ? 'cover' : 'spine',
      x:fraction(pose.x),y:fraction(pose.y),
      layer:Number.isSafeInteger(pose.layer) ? limit(pose.layer,-1000000,1000000) : 0
    };
  }

  function getPose(key) {
    const member = active?.members.find(entry => entry.key === key);
    return member ? poseOf(member.pose) : null;
  }

  function applyPose(copy,pose) {
    if (Object.keys(defaults).every(field => pose[field] === defaults[field])) {
      if (!poses.delete(copy)) return;
      delete copy.dataset.shelfPosed;
      delete copy.dataset.shelfFace;
      delete copy.dataset.shelfOrientation;
      for (const name of ['angle','scale','dx','dy','space','cover-width','layer']) copy.style.removeProperty('--pose-'+name);
      return;
    }
    poses.set(copy,pose);
    copy.dataset.shelfPosed = 'true';
    copy.dataset.shelfOrientation = pose.orientation;
    copy.dataset.shelfFace = pose.face;
    copy.style.setProperty('--pose-layer',String(pose.layer));
    if (pose.face === 'cover') window.AuroraEstanteCapa.prepare(copy);
  }

  function coverRatio(copy) {
    const img = copy.querySelector('.personal-book-front img');
    if (img?.naturalWidth && img.naturalHeight) return img.naturalWidth/img.naturalHeight;
    return parseFloat(copy.style.getPropertyValue('--cover-width')) /
      parseFloat(copy.style.getPropertyValue('--book-height')) || .72;
  }

  // O último espaço no fluxo dá a largura da fileira inteira, mesmo quando ela foi rolada.
  // scrollWidth também inclui sombras, capas laterais e transformações anteriores.
  function rowWidth(row) {
    const last = row.lastElementChild;
    return Math.max(row.clientWidth, last ? last.offsetLeft + last.offsetWidth +
      (parseFloat(last.style.getPropertyValue('--pose-space')) || 0) + row.clientLeft + 5 : 0);
  }

  function layoutPoses(row,retry = true) {
    const buttons = row.querySelectorAll('[data-shelf-posed]');
    if (!buttons.length || !row.clientWidth) return;
    const height = row.clientHeight;
    const availableHeight = Math.max(1,height-1);
    const availableWidth = Math.max(1,row.clientWidth-10);
    const boxes = [];
    for (const copy of buttons) {
      const pose = poses.get(copy);
      const h = copy.offsetHeight;
      if (pose.face === 'cover') copy.style.setProperty('--pose-cover-width',(h*coverRatio(copy))+'px');
      const w = copy.offsetWidth;
      const angle = pose.angle + (pose.orientation === 'horizontal' ? 90 : 0);
      const radians = angle * Math.PI / 180, cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
      const rotatedW = w*cos+h*sin, rotatedH = w*sin+h*cos;
      const scale = Math.min(.94*pose.scale,availableWidth/rotatedW,availableHeight/rotatedH);
      const boxWidth = rotatedW*scale, boxHeight = rotatedH*scale;
      const slot = slots.get(copy);
      if (slot?.parentElement && slot.parentElement !== row) {
        const lane = slot.parentElement;
        const projected = pose.angle || pose.scale !== 1 || pose.orientation === 'horizontal' || pose.face === 'cover';
        const seatWidth = projected ? rotatedW * Math.min(.94*pose.scale,
          Math.max(1,lane.clientWidth-10)/rotatedW,Math.max(1,lane.clientHeight-1)/rotatedH) : w;
        slot.style.flexBasis = seatWidth+'px';
      }
      copy.style.setProperty('--pose-space',(boxWidth-w)+'px');
      copy.style.setProperty('--pose-angle',angle+'deg');
      copy.style.setProperty('--pose-scale',String(scale));
      boxes.push({copy,pose,w,h,boxWidth,boxHeight});
    }
    if (retry && row.clientHeight !== height) { layoutPoses(row,false); return; }
    const totalWidth = row.dataset.placement ? row.clientWidth : rowWidth(row);
    for (const {copy,pose,w,h,boxWidth,boxHeight} of boxes) {
      const home = slots.get(copy);
      const originalLeft = pose.x == null && home ? home.getBoundingClientRect().left-row.getBoundingClientRect().left : copy.offsetLeft;
      const left = pose.x == null ? originalLeft : 5 + pose.x*Math.max(0,totalWidth-10-boxWidth);
      const bottom = availableHeight - (pose.y || 0)*Math.max(0,availableHeight-boxHeight);
      const dx = left-(copy.offsetLeft+(w-boxWidth)/2);
      const dy = bottom-(copy.offsetTop+(h+boxHeight)/2);
      copy.style.setProperty('--pose-dx',dx+'px');
      copy.style.setProperty('--pose-dy',dy+'px');
    }
  }

  function previewPose(key,next) {
    const copy = active?.copies.get(key)?.copy;
    if (!active?.editor || !copy?.isConnected || !next) return false;
    if (active.posePreview && active.posePreview.key !== key) cancelPose(active.posePreview.key);
    const row = laneOf(copy);
    const scrollLeft = active.posePreview?.scrollLeft ?? row.scrollLeft;
    const pose = poseOf(next);
    active.posePreview = {key,pose,scrollLeft};
    applyPose(copy,pose);
    if (!slots.has(copy)) layoutPoses(row);
    moveToLayer(copy,row);
    placeRow(row);
    return true;
  }

  function cancelPose(key) {
    if (active?.posePreview?.key !== key) return;
    const {scrollLeft} = active.posePreview;
    active.posePreview = null;
    const copy = active.copies.get(key)?.copy;
    if (!copy?.isConnected) return;
    const row = laneOf(copy);
    applyPose(copy,getPose(key) || defaults);
    moveToLayer(copy,row);
    placeRow(row);
    row.scrollLeft = scrollLeft;
  }

  function dragOrigin(key) {
    const copy = active?.copies.get(key)?.copy;
    if (!active?.editor || !copy?.isConnected) return null;
    const row = laneOf(copy);
    const box = copy.getBoundingClientRect(), plank = row.parentElement.getBoundingClientRect();
    const pose = active.posePreview?.key === key ? active.posePreview.pose : getPose(key);
    return {pose,left:box.left-plank.left-5,bottom:row.getBoundingClientRect().bottom-1-box.bottom,
      roomX:Math.max(0,plank.width-10-box.width),roomY:Math.max(0,row.offsetHeight-1-box.height)};
  }

  function dragPose(start,dx,dy) {
    if (!start || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    return {...start.pose,x:start.roomX ? limit((start.left+dx)/start.roomX,0,1) : 0,
      y:start.roomY ? limit((start.bottom-dy)/start.roomY,0,1) : 0};
  }

  function layerPose(key,direction) {
    const copy = active?.copies.get(key)?.copy;
    if (!active?.editor || !copy?.isConnected || !['front','back'].includes(direction)) return null;
    const pose = active.posePreview?.key === key ? active.posePreview.pose : getPose(key);
    const others = [...laneOf(copy).parentElement.querySelectorAll('[data-personal-book-key]')].filter(sibling => sibling !== copy)
      .map(sibling => poses.get(sibling)?.layer || 0);
    const layer = !others.length ? 0 : direction === 'front' ? Math.max(...others)+1 : Math.min(...others)-1;
    const placed = (pose.x == null || pose.y == null) ? dragPose(dragOrigin(key),0,0) : pose;
    return {...placed,layer};
  }

  async function saveAppearance(key,size,pose) {
    const view = active;
    if (!view?.editor || (size != null && !validSize(size)) || (size == null && pose == null))
      throw new Error('Ajustes de livro inválidos.');
    const members = await updateMembership(view.key,records => {
      const member = records.find(entry => isMember(entry) && entry.key === key);
      if (active !== view || !member) throw new Error('Este exemplar saiu da estante.');
      if (size) for (const field of ['height','width']) {
        if (size[field] === 'original') delete member[field];
        else member[field] = size[field];
      }
      if (pose) {
        const chosen = poseOf(pose);
        const stored = {...member.pose};
        for (const field of Object.keys(defaults)) {
          if (chosen[field] === defaults[field]) delete stored[field];
          else stored[field] = chosen[field];
        }
        if (Object.keys(stored).length) member.pose = stored;
        else delete member.pose;
      }
      return records;
    });
    if (active !== view) return;
    view.members = members;
    if (size && view.preview?.key === key) view.preview = null;
    if (pose && view.posePreview?.key === key) view.posePreview = null;
    draw();
  }

  const saveSize = (key,size) => saveAppearance(key,size,null);
  const savePose = (key,pose) => saveAppearance(key,null,pose);

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
        if (entry && slots.has(entry.copy)) { slots.get(entry.copy).remove(); entry.copy.remove(); }
        const copy = makeCopy(book,key,editor);
        copy.dataset.personalBookKey = key;
        entry = {copy,book};
        copies.set(key,entry);
      } else entry.book = book;
      applySize(entry.copy,active.preview?.key === key ? active.preview : sizeOf(member));
      applyPose(entry.copy,active.posePreview?.key === key ? active.posePreview.pose : poseOf(member.pose));
      // Uma seção removida pode ser recuperada ao desfazer. O vínculo original é preservado.
      contents[Math.min(section,rows.length-1)].push(entry.copy);
    }
    for (const [key,entry] of copies) if (!keys.has(key)) {
      slots.get(entry.copy)?.remove();
      entry.copy.remove();
      copies.delete(key);
    }
    rows.forEach((row,i) => {
      const children = contents[i];
      children.forEach((copy,index) => {
        const atIndex = row.children[index];
        const seat = slots.get(copy) || copy;
        if (atIndex !== seat) row.insertBefore(seat,atIndex || null);
      });
      while (row.childElementCount > children.length) row.lastElementChild.remove();
      row.hidden = children.length === 0;
      if (!row.hidden) {
        placeRow(row);
        if (children.some(copy => slots.has(copy) || poses.has(copy))) {
          for (const copy of children) moveToLayer(copy,row);
          placeRow(row);
        }
        if (!editor) children.forEach(copy => window.AuroraLombadas?.enhance?.(copy));
      }
    });
  }

  async function refresh() {
    const view = active;
    view.members = read(view.key);
    if (view.preview && !view.members.some(member => member.key === view.preview.key)) view.preview = null;
    if (view.posePreview && !view.members.some(member => member.key === view.posePreview.key)) view.posePreview = null;
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
      active.scene.querySelectorAll('.personal-book-row:not([data-placement]):not([hidden])').forEach(placeRow);
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
  window.AuroraEstanteExemplares = {render,layout,openPicker,clear,originFor,getSize,previewSize,saveSize,cancelSize,defaultPose,getPose,previewPose,cancelPose,savePose,saveAppearance,dragOrigin,dragPose,layerPose};
})();
