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
    supportStacks(row);
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
    if (!row.dataset.stackScroll) {
      row.dataset.stackScroll = '1';
      row.addEventListener('scroll',() => { if (active?.stacks?.children.size) layout(); },{passive:true});
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

  function observedBook(view,key) {
    let draft = view.drafts.get(key);
    if (!draft) {
      draft = {size:new Map(),pose:new Map(),shown:{},origins:{}};
      view.drafts.set(key,draft);
    }
    return draft;
  }

  function appearance(member,kind) {
    const values = kind === 'size' ? sizeOf(member) : poseOf(member.pose);
    const changes = active.drafts.get(member.key)?.[kind];
    if (changes) for (const [field,change] of changes) values[field] = change.value;
    return values;
  }

  function currentPose(key) {
    const member = active?.members.find(entry => entry.key === key);
    return member ? appearance(member,'pose') : null;
  }

  function getDraftAppearance(key) {
    const member = active?.members.find(entry => entry.key === key);
    if (!member) return null;
    const size = appearance(member,'size'), pose = appearance(member,'pose');
    if (active.session) observedBook(active,key).shown = {size:{...size},pose:{...pose}};
    return {size,pose};
  }

  function notePreview(key,kind,next,row,previous) {
    const view = active, draft = observedBook(view,key);
    const shown = draft.shown[kind] || previous;
    const persisted = kind === 'size' ? getSize(key) : getPose(key);
    for (const [field,value] of Object.entries(next)) {
      if (value === shown[field]) continue;
      const change = draft[kind].get(field);
      const before = change ? change.before : shown[field];
      if (value === before || value === persisted[field]) draft[kind].delete(field);
      else draft[kind].set(field,{before,value});
    }
    draft.shown[kind] = {...next};
    if (!draft.origins[kind]) draft.origins[kind] = {row,left:row.scrollLeft};
    if (view.session && !view.session.rows.has(row)) view.session.rows.set(row,row.scrollLeft);
    return draft.origins[kind];
  }

  function forgetPreview(view,key,kind) {
    const draft = view.drafts.get(key);
    if (!draft) return;
    draft[kind].clear();
    delete draft.shown[kind];
    delete draft.origins[kind];
    if (!view.session && !draft.origins.size && !draft.origins.pose) view.drafts.delete(key);
  }

  function cancelSize(key) {
    const origin = active?.drafts.get(key)?.origins.size;
    if (!origin) return;
    forgetPreview(active,key,'size');
    const copy = active.copies.get(key)?.copy, size = getSize(key);
    if (copy && size) {
      applySize(copy,size);
      if (laneOf(copy) === origin.row) origin.row.scrollLeft = origin.left;
      layout();
    }
  }

  function previewSize(key,size) {
    const copy = active?.copies.get(key)?.copy;
    if (!active?.editor || active.session?.saving || !copy?.isConnected || !validSize(size)) return false;
    if (!active.session) for (const other of active.drafts.keys()) if (other !== key) cancelSize(other);
    const member = active.members.find(entry => entry.key === key);
    if (!member) return false;
    const row = laneOf(copy);
    const origin = notePreview(key,'size',sizeOf(size),row,appearance(member,'size'));
    applySize(copy,appearance(member,'size'));
    row.scrollLeft = origin.left;
    layout();
    return true;
  }

  const defaults = Object.freeze({scale:1,angle:0,orientation:'vertical',face:'spine',x:null,y:null,layer:0,yaw:null,stackOn:null,stackOffset:0});
  const defaultPose = () => ({...defaults});
  const limit = (value,min,max) => Math.min(max,Math.max(min,value));
  const poses = new WeakMap();
  const slots = new WeakMap();
  const laneOf = copy => slots.get(copy)?.parentElement || copy.parentElement;

  function moveToLayer(copy,row) {
    const pose = poses.get(copy);
    let slot = slots.get(copy);
    const key = copy.dataset.personalBookKey;
    const inStack = active.stacks.parents.has(key) || active.stacks.children.has(key);
    if (pose?.x == null && pose?.y == null && !pose?.layer && !inStack) {
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
      const adjusted = pose.yaw != null || pose.angle || pose.scale !== 1 || pose.orientation === 'horizontal' || pose.face === 'cover';
      const width = originalWidth + (adjusted ? parseFloat(copy.style.getPropertyValue('--pose-space')) || 0 : 0);
      slot.style.flexBasis = width+'px';
      if (pose.face === 'spine' && pose.yaw == null && !copy.dataset.shelfWidth) copy.style.setProperty('--placed-spine-width',originalWidth+'px');
      copy.before(slot);
      slots.set(copy,slot);
    }
    slot.hidden = active.stacks.parents.has(key);
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
      yaw:Number.isFinite(pose.yaw) ? ((pose.yaw % 360)+360)%360 : null,
      stackOffset:Number.isFinite(pose.stackOffset) ? limit(pose.stackOffset,-.35,.35) : 0,
      stackOn:typeof pose.stackOn === 'string' && pose.stackOn ? pose.stackOn : null,
      layer:Number.isSafeInteger(pose.layer) ? limit(pose.layer,-1000000,1000000) : 0
    };
  }

  function getPose(key) {
    const member = active?.members.find(entry => entry.key === key);
    return member ? poseOf(member.pose) : null;
  }

  // Uma base tem um único livro diretamente apoiado. Outros podem ser apoiados no topo.
  function stackGraph(records,key,pose) {
    const nodes = new Map(), parents = new Map(), children = new Map();
    for (const member of records) if (isMember(member) && !nodes.has(member.key)) {
      nodes.set(member.key,{section:member.section,pose:member.key === key && pose ? pose : poseOf(member.pose)});
    }
    for (const [child,node] of nodes) {
      const parent = node.pose.stackOn, base = nodes.get(parent);
      if (!base || child === parent || base.section !== node.section ||
          base.pose.orientation !== 'horizontal' || base.pose.angle || children.has(parent)) continue;
      parents.set(child,parent);
      children.set(parent,child);
    }
    // Vínculos importados ou antigos podem conter ciclos. Não desenhe um apoio circular.
    const checked = new Set();
    for (const child of parents.keys()) {
      const path = new Set();
      let cursor = child;
      while (parents.has(cursor) && !checked.has(cursor) && !path.has(cursor)) {
        path.add(cursor);
        cursor = parents.get(cursor);
      }
      if (path.has(cursor)) {
        const first = cursor;
        do {
          const parent = parents.get(cursor);
          parents.delete(cursor);
          children.delete(parent);
          cursor = parent;
        } while (cursor !== first);
      }
      for (const visited of path) checked.add(visited);
    }
    return {nodes,parents,children};
  }

  function draftMembers() {
    return active.members.map(member => active.drafts.get(member.key)?.pose.size
      ? {...member,pose:appearance(member,'pose')} : member);
  }

  function refreshStacks() {
    active.stacks = stackGraph(draftMembers().filter(member => active.books.has(member.key)));
  }

  function stackError(text) {
    const error = new Error(text);
    error.code = 'STACK_INVALID';
    return error;
  }

  function validateSupport(records,key,pose) {
    const before = stackGraph(records), graph = stackGraph(records,key,pose);
    const occupant = before.children.get(pose.stackOn);
    if (pose.stackOn && ((occupant && occupant !== key) || graph.parents.get(key) !== pose.stackOn))
      throw stackError('Escolha uma base deitada, sem inclinação e com o topo livre nesta prateleira.');
    if (before.children.has(key) && graph.children.get(key) !== before.children.get(key))
      throw stackError('Retire primeiro o livro apoiado nesta base para mudar a orientação dela.');
  }

  function stackTargets(key,orientation='horizontal') {
    if (!active?.editor || !active.stacks || !['vertical','horizontal'].includes(orientation)) return [];
    const {nodes,parents,children} = active.stacks;
    const node = nodes.get(key);
    if (!node || (children.has(key) && orientation !== 'horizontal')) return [];
    const results = [];
    // O próprio exemplar e os livros acima dele não podem virar sua base.
    const above = new Set();
    for (let cursor=key;cursor!=null;cursor=children.get(cursor)) above.add(cursor);
    for (const [candidate,base] of nodes) {
      if (base.section !== node.section || above.has(candidate) || base.pose.orientation !== 'horizontal' || base.pose.angle) continue;
      if (children.has(candidate) && parents.get(key) !== candidate) continue;
      results.push({key:candidate,title:active.books.get(candidate).title});
    }
    return results;
  }

  function stackPose(key,baseKey,orientation='horizontal') {
    if (!stackTargets(key,orientation).some(base => base.key === baseKey)) return null;
    const pose = currentPose(key);
    return {...pose,angle:pose.orientation === orientation ? pose.angle : 0,orientation,stackOn:baseKey,stackOffset:pose.stackOn===baseKey ? pose.stackOffset : 0,y:0};
  }

  function unstackPose(key) {
    const start = dragOrigin(key);
    if (!start) return null;
    const pose = {...start.pose,stackOn:null,y:0};
    const copy = active.copies.get(key).copy, row = laneOf(copy), section = row.parentElement;
    const plank = section.getBoundingClientRect(), left = plank.left+5, right = plank.right-5;
    const angle = (pose.angle + (pose.orientation === 'horizontal' ? 90 : 0))*Math.PI/180;
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    const w = cos*copy.offsetWidth+sin*copy.offsetHeight, h = sin*copy.offsetWidth+cos*copy.offsetHeight;
    const scale = Math.min(.94*pose.scale,(right-left)/w,(row.offsetHeight-1)/h);
    const width = w*scale;
    const exclude = new Set();
    for (let cursor=key;cursor!=null;cursor=active.stacks.children.get(cursor)) exclude.add(cursor);
    const floor = row.getBoundingClientRect().bottom-1;
    const occupied = [];
    for (const object of section.querySelectorAll('.shelf-object,[data-personal-book-key]')) {
      if (exclude.has(object.dataset.personalBookKey)) continue;
      const rect = object.getBoundingClientRect();
      if (rect.bottom <= floor-h*scale || rect.top >= floor) continue;
      const clip = object.closest('.personal-book-row')?.getBoundingClientRect() || plank;
      const a = Math.max(left,rect.left,clip.left), b = Math.min(right,rect.right,clip.right);
      if (b > a) occupied.push([a-3,b+3]);
    }
    occupied.sort((a,b)=>a[0]-b[0]);
    let space = left, nearest = null, distance = Infinity;
    const original = copy.getBoundingClientRect().left;
    for (const [a,b] of [...occupied,[right,right]]) {
      if (a-space >= width) {
        const x = limit(original,space,a-width);
        if (Math.abs(x-original)<distance) { nearest=x; distance=Math.abs(x-original); }
      }
      space = Math.max(space,b);
    }
    if (nearest == null) return {...pose,x:null,y:null,layer:0};
    return {...pose,x:(nearest-left)/Math.max(1,right-left-width)};
  }

  function supportStacks(row) {
    const {parents,children} = active.stacks;
    if (!children.size) return;
    const section = row.parentElement, surface = row.getBoundingClientRect().bottom - 1;
    const plank = section.getBoundingClientRect();
    for (const root of children.keys()) {
      if (parents.has(root)) continue;
      const base = active.copies.get(root)?.copy;
      if (!base?.isConnected || base.closest('.shelf-section') !== section) continue;
      const pile = [];
      let height = 0, width = 0;
      for (let key=root;key!=null;key=children.get(key)) {
        const book = active.copies.get(key)?.copy;
        if (!book?.isConnected || book.closest('.shelf-section') !== section) break;
        const box = book.getBoundingClientRect();
        pile.push(book);
        height += box.height;
        width = Math.max(box.width,width);
      }
      if (pile.length < 2 || !height) continue;
      const space = poses.get(base)?.x == null ? row.getBoundingClientRect() : plank;
      const fit = Math.min(1,(row.offsetHeight-1)/height,(space.width-10)/Math.max(1,width));
      const originalBase = base.getBoundingClientRect();
      const halfWidth = width*fit/2;
      const center = limit(originalBase.left+originalBase.width/2,space.left+5+halfWidth,space.right-5-halfWidth);
      let bottom = surface, supportCenter = center;
      for (const book of pile) {
        const style = book.style;
        if (fit < 1) style.setProperty('--pose-scale',String(parseFloat(style.getPropertyValue('--pose-scale'))*fit));
        const box = book.getBoundingClientRect();
        const offset = (poses.get(book)?.stackOffset || 0) * box.width;
        const bookCenter = limit(supportCenter + offset,plank.left+box.width/2,plank.right-box.width/2);
        const dx = parseFloat(style.getPropertyValue('--pose-dx'))+bookCenter-box.left-box.width/2;
        supportCenter = bookCenter;
        const dy = parseFloat(style.getPropertyValue('--pose-dy'))+bottom-box.bottom;
        style.setProperty('--pose-dx',dx+'px');
        style.setProperty('--pose-dy',dy+'px');
        const support = parents.get(book.dataset.personalBookKey);
        if (support) book.dataset.shelfStackOn = support;
        // Uma fração de pixel sobreposta evita frestas de rasterização entre capas.
        bottom -= box.height - .65;
      }
    }
  }

  function displayedYaw(pose) {
    return pose.yaw ?? (pose.orientation === 'horizontal' && pose.face === 'spine' ? 0 : null);
  }

  function applyPose(copy,pose) {
    delete copy.dataset.shelfStackOn;
    if (pose.yaw != null) copy.dataset.shelfYaw = String(pose.yaw);
    else delete copy.dataset.shelfYaw;
    if (displayedYaw(pose) != null) window.AuroraVolumeEstante?.prepare(copy,active.books.get(copy.dataset.personalBookKey));
    else if (copy.hasAttribute('data-volume-estante')) {
      window.AuroraVolumeEstante?.layout(copy,0,0,0,null,false);
      copy.style.removeProperty('--pose-volume-width');
    }
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
    if (pose.face === 'cover' && pose.yaw == null) window.AuroraEstanteCapa.prepare(copy);
  }

  function coverRatio(copy) {
    const img = copy.querySelector('.personal-book-front img') || copy.querySelector('.shelf-book-cover img');
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
      const yaw = displayedYaw(pose), horizontal = pose.orientation === 'horizontal';
      if (yaw != null && window.AuroraVolumeEstante) {
        const widths = {fino:27,medio:42,grande:59};
        const spineWidth = widths[copy.dataset.shelfWidth] || parseFloat(copy.style.getPropertyValue('--book-width')) || 42;
        const coverWidth = h*coverRatio(copy);
        copy.style.setProperty('--pose-volume-width',window.AuroraVolumeEstante.project(h,coverWidth,spineWidth,yaw,horizontal)+'px');
        window.AuroraVolumeEstante.layout(copy,h,coverWidth,spineWidth,yaw,horizontal);
      } else if (pose.face === 'cover') copy.style.setProperty('--pose-cover-width',(h*coverRatio(copy))+'px');
      const w = copy.offsetWidth;
      const angle = pose.angle + (pose.orientation === 'horizontal' ? 90 : 0);
      const radians = angle * Math.PI / 180, cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
      const rotatedW = w*cos+h*sin, rotatedH = w*sin+h*cos;
      const scale = Math.min(.94*pose.scale,availableWidth/rotatedW,availableHeight/rotatedH);
      const boxWidth = rotatedW*scale, boxHeight = rotatedH*scale;
      const slot = slots.get(copy);
      if (slot?.parentElement && slot.parentElement !== row) {
        const lane = slot.parentElement;
        const projected = pose.yaw != null || pose.angle || pose.scale !== 1 || pose.orientation === 'horizontal' || pose.face === 'cover';
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
    if (!active?.editor || active.session?.saving || !copy?.isConnected || !next) return false;
    if (!active.session) for (const other of active.drafts.keys()) if (other !== key) cancelPose(other);
    const row = laneOf(copy);
    const old = currentPose(key);
    if (!old) return false;
    const pose = poseOf(next);
    if ((pose.stackOn || active.stacks.children.has(key)) && (old.stackOn !== pose.stackOn ||
        old.orientation !== pose.orientation || old.angle !== pose.angle)) {
      try { validateSupport(draftMembers(),key,pose); } catch { return false; }
    }
    notePreview(key,'pose',pose,row,old);
    const updated = currentPose(key);
    if (old.stackOn !== updated.stackOn) { draw(); return true; }
    if (old.orientation !== updated.orientation || old.angle !== updated.angle) refreshStacks();
    applyPose(copy,updated);
    if (!slots.has(copy)) layoutPoses(row);
    moveToLayer(copy,row);
    placeRow(row);
    return true;
  }

  function cancelPose(key) {
    const origin = active?.drafts.get(key)?.origins.pose;
    if (!origin) return;
    forgetPreview(active,key,'pose');
    draw();
    if (origin.row.isConnected) origin.row.scrollLeft = origin.left;
    layout();
  }

  function dragOrigin(key) {
    const copy = active?.copies.get(key)?.copy;
    if (!active?.editor || !copy?.isConnected) return null;
    const row = laneOf(copy);
    const box = copy.getBoundingClientRect(), plank = row.parentElement.getBoundingClientRect();
    const pose = currentPose(key);
    return {pose,width:box.width,left:box.left-plank.left-5,bottom:row.getBoundingClientRect().bottom-1-box.bottom,
      roomX:Math.max(0,plank.width-10-box.width),roomY:Math.max(0,row.offsetHeight-1-box.height)};
  }

  function dragPose(start,dx,dy) {
    if (!start || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
    if (start.pose.stackOn && Math.abs(dy) < Math.max(20,Math.abs(dx)*.45)) return {...start.pose,stackOffset:limit((start.pose.stackOffset || 0)+dx/Math.max(1,start.width),-.35,.35)};
    return {...start.pose,stackOn:null,stackOffset:0,x:start.roomX ? limit((start.left+dx)/start.roomX,0,1) : 0,
      y:start.roomY ? limit((start.bottom-dy)/start.roomY,0,1) : 0};
  }

  function layerPose(key,direction) {
    const copy = active?.copies.get(key)?.copy;
    if (!active?.editor || !copy?.isConnected || !['front','back'].includes(direction)) return null;
    const pose = currentPose(key);
    const others = [...laneOf(copy).parentElement.querySelectorAll('[data-personal-book-key]')].filter(sibling => sibling !== copy)
      .map(sibling => poses.get(sibling)?.layer || 0);
    const layer = !others.length ? 0 : direction === 'front' ? Math.max(...others)+1 : Math.min(...others)-1;
    const placed = (pose.x == null || pose.y == null) ? dragPose(dragOrigin(key),0,0) : pose;
    return {...placed,stackOn:pose.stackOn,layer};
  }

  function beginAppearanceSession() {
    if (!active?.editor) return false;
    if (!active.session) {
      if (active.drafts.size) { active.drafts.clear(); draw(); }
      active.session = {rows:new Map(),saving:false};
    }
    return true;
  }

  function cancelAppearanceSession() {
    const view = active, session = view?.session;
    if (!session) return;
    view.session = null;
    view.drafts.clear();
    // Outra aba pode ter salvo enquanto o painel estava aberto.
    try { view.members = storedRecords(view.key).filter(isMember); } catch { /* Última leitura válida. */ }
    draw();
    for (const [row,left] of session.rows) if (row.isConnected) row.scrollLeft = left;
    layout();
  }

  function applyField(member,kind,field,value) {
    const target = kind === 'size' ? member : (member.pose ||= {});
    if (value === (kind === 'size' ? 'original' : defaults[field])) delete target[field];
    else target[field] = value;
    if (kind === 'pose' && !Object.keys(target).length) delete member.pose;
  }

  function editError(code,message) { return Object.assign(new Error(message),{code}); }

  async function saveAppearanceSession() {
    const view = active, session = view?.session;
    if (!session || session.saving) throw new Error('A sessão de edição não está disponível.');
    session.saving = true;
    try {
      const changed = [...view.drafts].filter(([,draft]) => draft.size.size || draft.pose.size);
      if (changed.length) {
        const members = await updateMembership(view.key,records => {
          if (active !== view || view.session !== session) throw new Error('A estante em edição mudou.');
          const before = stackGraph(records), links = new Map();
          for (const [key,draft] of changed) {
            const member = records.find(record => isMember(record) && record.key === key);
            if (!member) throw editError('BOOK_REMOVED','Um dos livros editados saiu desta estante.');
            for (const kind of ['size','pose']) {
              const fresh = kind === 'size' ? sizeOf(member) : poseOf(member.pose);
              for (const [field,{before:original,value}] of draft[kind]) {
                if (fresh[field] !== original && fresh[field] !== value)
                  throw editError('APPEARANCE_CONFLICT','Uma das medidas ou posições também mudou em outra aba.');
                applyField(member,kind,field,value);
              }
            }
            if (draft.pose.has('stackOn')) links.set(key,member.pose?.stackOn ?? null);
          }
          // Valida o conjunto final: é possível soltar um topo e reutilizar sua base na mesma gravação.
          const after = stackGraph(records);
          for (const [child,parent] of before.parents) {
            if (!links.has(child) && after.parents.get(child) !== parent)
              throw stackError('Esta alteração afetaria outro livro apoiado na pilha.');
          }
          for (const [child,parent] of links) if (parent && after.parents.get(child) !== parent)
            throw stackError('A base escolhida mudou ou já está ocupada.');
          return records;
        });
        if (active !== view || view.session !== session) return;
        view.members = members;
      }
      view.session = null;
      view.drafts.clear();
      draw();
    } finally {
      session.saving = false;
    }
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
        validateSupport(records,key,chosen);
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
    if (size) forgetPreview(view,key,'size');
    if (pose) forgetPreview(view,key,'pose');
    draw();
  }

  const saveSize = (key,size) => saveAppearance(key,size,null);
  const savePose = (key,pose) => saveAppearance(key,null,pose);

  const visualFields = ['title','author','source','cover','spine','coverSource','total','ratio','spineAspect','bookmarked','back'];
  function draw() {
    const {scene,editor,members,books,copies} = active;
    refreshStacks();
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
      applySize(entry.copy,appearance(member,'size'));
      applyPose(entry.copy,appearance(member,'pose'));
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
    if (!view.session) for (const key of view.drafts.keys()) {
      if (!view.members.some(member => member.key === key)) view.drafts.delete(key);
    }
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
    active = {scene,key,editor,members:[],drafts:new Map(),session:null,books:new Map(),copies:new Map(),stacks:stackGraph([]),request:0};
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
    select.setAttribute('aria-label',label);
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
    const views = element('div','shelf-picker-views');
    views.setAttribute('role','group');
    views.setAttribute('aria-label','Forma de buscar no catálogo');
    for (const [mode,text] of [['images','Buscar catálogo por imagem'],['az','Buscar catálogo de A a Z']]) {
      const button = element('button','',text);
      button.type = 'button';
      button.dataset.catalogView = mode;
      button.setAttribute('aria-pressed',String(mode === 'az'));
      button.addEventListener('click',() => {
        picker.mode = mode;
        updatePicker();
        picker.list.scrollTop = 0;
      });
      views.append(button);
    }
    controls.append(section.control,category.control,searchLabel,views);
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
    return {dialog,section:section.select,category:category.select,search,list,status,views,mode:'az'};
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
    const categories = window.AuroraShelf?.categories || [];
    const visual = picker.mode === 'images';
    const categoryOrder = new Map(categories.map((category,index) => [category.id,index]));
    books.sort((a,b) => (visual ? (categoryOrder.get(a.category) ?? 999)-(categoryOrder.get(b.category) ?? 999) : 0) || a.title.localeCompare(b.title,'pt-BR'));
    picker.list.classList.toggle('shelf-picker-images',visual);
    picker.list.setAttribute('aria-label',visual?'Catálogo por imagem':'Catálogo de A a Z');
    for (const button of picker.views.children) button.setAttribute('aria-pressed',String(button.dataset.catalogView === picker.mode));
    const items = document.createDocumentFragment();
    const focusKey = document.activeElement?.dataset.bookKey;
    let focusAfter = null;
    const count = picker.section.options.length;
    let previousCategory;
    for (const book of books) {
      if (visual && book.category !== previousCategory) {
        const heading = element('li','shelf-picker-genre');
        heading.append(element('h3','',categories.find(category => category.id === book.category)?.name || 'Outros livros'));
        items.append(heading);
        previousCategory = book.category;
      }
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
      if (visual) {
        const preview = window.AuroraCatalogPreview?.volumeFor(book.button,book.title,li);
        if (preview) li.append(preview.holder);
      }
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
        if (!add) {
          for (const entry of saved) if (entry?.pose?.stackOn === bookKey) {
            delete entry.pose.stackOn;
            delete entry.pose.y;
            if (!Object.keys(entry.pose).length) delete entry.pose;
          }
          return saved.filter(entry => entry?.key !== bookKey);
        }
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
  window.AuroraEstanteExemplares = {render,layout,openPicker,clear,originFor,getSize,previewSize,saveSize,cancelSize,defaultPose,getPose,previewPose,cancelPose,savePose,saveAppearance,dragOrigin,dragPose,layerPose,stackTargets,stackPose,unstackPose,beginAppearanceSession,getDraftAppearance,saveAppearanceSession,cancelAppearanceSession};
})();
