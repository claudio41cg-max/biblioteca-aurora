/* O diálogo continua modal enquanto o dedo movimenta o exemplar na prévia. */
(() => {
  'use strict';
  let stop;

  function desativar() {
    stop?.();
    stop = null;
  }

  function ativar({area,livro,getDraft,preview}) {
    desativar();
    const key = livro.dataset.personalBookKey;
    const renderer = window.AuroraEstanteExemplares;
    const listeners = new AbortController();
    const options = {signal:listeners.signal};
    let drag;

    function end(restore) {
      if (!drag) return;
      const previous = drag;
      drag = null;
      if (area.hasPointerCapture(previous.id)) area.releasePointerCapture(previous.id);
      if (restore) preview(previous.pose);
    }

    function move(origin, dx, dy) {
      const pose = renderer.dragPose(origin,dx,dy);
      if (pose) preview(pose);
    }

    // Encaixa só ao soltar perto do topo de um apoio. O restante da tábua permite movimento livre.
    function snapToBook() {
      const {orientation} = getDraft();
      const supports = renderer.stackTargets(key,orientation);
      if (!supports.length) return;
      const candidates = new Set(supports.map(support => support.key));
      const box = livro.getBoundingClientRect();
      let closest, distance = Infinity;
      for (const other of livro.closest('.shelf-section').querySelectorAll('[data-personal-book-key]')) {
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

    area.addEventListener('pointerdown', event => {
      if (drag || event.button !== 0 || !event.isPrimary) return;
      const box = livro.getBoundingClientRect();
      const {clientX:x,clientY:y} = event;
      // Dá uma margem de toque às lombadas finas.
      if (x < box.left-8 || x > box.right+8 || y < box.top-8 || y > box.bottom+8) return;
      const origin = renderer.dragOrigin(key);
      if (!origin) return;
      drag = {id:event.pointerId,x,y,origin,pose:{...getDraft()}};
      area.setPointerCapture(event.pointerId);
      event.preventDefault();
    },options);
    function updateDrag(event) {
      if (drag?.id !== event.pointerId) return;
      const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
      if (!drag.moved && Math.hypot(dx,dy) < 2) return;
      drag.moved = true;
      move(drag.origin,dx,dy);
    }
    area.addEventListener('pointermove',updateDrag,options);
    area.addEventListener('pointerup', event => {
      if (drag?.id !== event.pointerId) return;
      updateDrag(event);
      if (drag.moved) snapToBook();
      end(false);
    },options);
    for (const type of ['pointercancel','lostpointercapture']) {
      area.addEventListener(type,event => {
        if (drag?.id === event.pointerId) end(true);
      },options);
    }
    area.addEventListener('keydown', event => {
      if (drag || event.ctrlKey || event.altKey || event.metaKey) return;
      const delta = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if (!delta) return;
      event.preventDefault();
      const origin = renderer.dragOrigin(key);
      const step = event.shiftKey ? 15 : 4;
      if (origin) move(origin,delta[0]*step,delta[1]*step);
    },options);
    stop = () => {
      listeners.abort();
      end(false);
    };
  }
  window.AuroraMoverExemplar = {ativar,desativar};
})();
