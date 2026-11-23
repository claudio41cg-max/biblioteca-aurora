/* A prateleira continua interativa enquanto o painel de ajustes está aberto. */
(() => {
  'use strict';
  const selector = '.editor-book-row > [data-personal-book-key]';
  let stop;

  function desativar() {
    stop?.();
    stop = null;
  }

  function ativar({area,getBook,selectBook,getDraft,preview,hold}) {
    desativar();
    const renderer = window.AuroraEstanteExemplares;
    const listeners = new AbortController();
    const options = {signal:listeners.signal,capture:true};
    let drag;
    area.setAttribute('data-arrasto-livros','');

    function end(restore) {
      if (!drag) return;
      const previous = drag;
      drag = null;
      previous.book.removeAttribute('data-arrastando-livro');
      if (area.hasPointerCapture(previous.id)) area.releasePointerCapture(previous.id);
      if (restore && previous.moved && getBook()?.dataset.personalBookKey === previous.key) preview(previous.pose);
    }

    function move(origin,dx,dy) {
      const pose = renderer.dragPose(origin,dx,dy);
      if (pose) preview(pose);
    }

    // Encaixe só quando a base do exemplar chega ao topo de um apoio desta prateleira.
    function snapToBook(book) {
      const key = book.dataset.personalBookKey;
      const {orientation} = getDraft();
      const supports = renderer.stackTargets(key,orientation);
      if (!supports.length) return;
      const candidates = new Set(supports.map(support => support.key));
      const box = book.getBoundingClientRect();
      let closest, distance = Infinity;
      for (const other of book.closest('.shelf-section').querySelectorAll(selector)) {
        const baseKey = other.dataset.personalBookKey;
        if (!candidates.has(baseKey)) continue;
        const base = other.getBoundingClientRect();
        const overlap = Math.min(box.right,base.right) - Math.max(box.left,base.left);
        if (overlap < Math.min(box.width,base.width) * .5) continue;
        const gap = Math.abs(box.bottom-base.top);
        const tolerance = Math.min(14,Math.max(6,base.height*.4));
        if (gap <= tolerance && gap < distance) {
          closest = baseKey;
          distance = gap;
        }
      }
      if (closest) {
        const pose = renderer.stackPose(key,closest,orientation);
        if (pose) preview(pose);
      }
    }

    function begin(event,book,previousBox) {
      const key = book.dataset.personalBookKey;
      const origin = renderer.dragOrigin(key);
      if (!origin) return;
      // O canvas sobrevive à troca de fileira do botão e à composição de novas pilhas.
      try { area.setPointerCapture(event.pointerId); }
      catch { return; } // A pressão longa pode terminar enquanto o painel é montado.
      const box = book.getBoundingClientRect();
      const {clientX:x,clientY:y} = event;
      // Preserve o ponto tocado mesmo se selecionar outro livro alterar as dimensões da pilha.
      const shiftX = previousBox?.width ? x-box.left-(x-previousBox.left)*box.width/previousBox.width : 0;
      const shiftY = previousBox?.height ? y-box.top-(y-previousBox.top)*box.height/previousBox.height : 0;
      drag = {id:event.pointerId,key,book,x,y,shiftX,shiftY,origin,pose:{...getDraft()}};
    }

    function selected(button) {
      if (!button || !selectBook(button)) return null;
      const book = getBook();
      book?.focus({preventScroll:true});
      return book;
    }

    area.addEventListener('pointerdown',event => {
      if (drag || !event.isPrimary || event.button !== 0) return;
      const hit = event.target.closest(selector);
      if (!hit) return;
      const box = hit.getBoundingClientRect();
      const book = selected(hit);
      if (!book) return;
      event.preventDefault();
      event.stopPropagation();
      begin(event,book,box);
    },options);

    function updateDrag(event) {
      if (drag?.id !== event.pointerId) return;
      const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
      if (!drag.moved && Math.hypot(dx,dy) < 4) return;
      drag.moved = true;
      drag.book.setAttribute('data-arrastando-livro','');
      move(drag.origin,dx+drag.shiftX,dy+drag.shiftY);
    }

    area.addEventListener('pointermove',updateDrag,options);
    area.addEventListener('pointerup',event => {
      if (drag?.id !== event.pointerId) return;
      updateDrag(event);
      const {book,moved} = drag;
      if (moved && book.isConnected) snapToBook(book);
      end(false);
      if (moved && book.isConnected) book.focus({preventScroll:true});
    },options);
    for (const type of ['pointercancel','lostpointercapture']) {
      area.addEventListener(type,event => {
        // O livro pode perder sua captura implícita justamente quando o canvas a assume.
        if (type === 'lostpointercapture' && event.target !== area) return;
        if (drag?.id === event.pointerId) end(true);
      },options);
    }
    area.addEventListener('click',event => {
      // Enter, Espaço e ativação por leitor de tela não passam por pointerdown.
      if (event.detail !== 0 || !selected(event.target.closest(selector))) return;
      event.stopPropagation();
    },options);
    area.addEventListener('keydown',event => {
      if (drag || event.ctrlKey || event.altKey || event.metaKey) return;
      const delta = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if (!delta) return;
      const book = selected(event.target.closest(selector));
      if (!book) return;
      event.preventDefault();
      event.stopPropagation();
      const origin = renderer.dragOrigin(book.dataset.personalBookKey);
      const step = event.shiftKey ? 15 : 4;
      if (origin) move(origin,delta[0]*step,delta[1]*step);
      book.focus({preventScroll:true});
    },options);
    // Também permita que o dedo que abriu o painel continue o mesmo gesto de arrasto.
    if (hold && getBook()) {
      begin(hold,getBook());
      area.addEventListener('touchmove',event => {
        if (drag?.id === hold.pointerId && event.cancelable) event.preventDefault();
      },{...options,passive:false});
    }
    stop = () => {
      listeners.abort();
      end(false);
      area.removeAttribute('data-arrasto-livros');
    };
  }
  window.AuroraMoverExemplar = {ativar,desativar};
})();
