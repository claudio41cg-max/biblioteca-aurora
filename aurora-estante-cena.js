/* Pranchas, peças e pontos de apoio usados na oficina e na biblioteca. */
(() => {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const onBoard = item => item.mount === 'board' ||
    (item.mount !== 'wall' && String(item.src || '').startsWith('./assets/customizador/'));

  function position(element, item) {
    const size = clamp(Number(item.size) || 88, 44, 160);
    element.style.setProperty('--object-size', size + 'px');
    element.style.setProperty('--object-left', clamp(Number(item.x) || 0, 0, 100) + '%');
    element.style.setProperty('--object-bottom', (onBoard(item) ? 0 : clamp(Number(item.bottom) || 0, 0, 100)) + '%');
    element.style.setProperty('--object-rotation', ((Number(item.rotation) || 0)+(item.orientation==='horizontal'?90:0)) + 'deg');
    element.style.setProperty('--object-yaw',(Number(item.yaw)||0)+'deg');
    element.style.zIndex=String(Number.isFinite(item.layer)?item.layer:4);
    element.style.setProperty('--object-fit-x','0px');
    element.style.setProperty('--object-fit-y','0px');
    if(item.rotation || item.orientation==='horizontal' || item.yaw) requestAnimationFrame(()=>{
      if(!element.isConnected)return;
      const box=element.getBoundingClientRect(),area=element.parentElement.getBoundingClientRect();
      const dx=box.left<area.left?area.left-box.left:box.right>area.right?area.right-box.right:0;
      element.style.setProperty('--object-fit-x',dx+'px');
      if(onBoard(item))element.style.setProperty('--object-fit-y',(area.bottom-box.bottom)+'px');
    });
  }

  function objects(items, sectionIndex, {editable = false, selectedId = null} = {}) {
    const layer = document.createElement('div');
    layer.className = 'shelf-object-layer';
    layer.dataset.section = String(sectionIndex);
    for (const item of items || []) {
      if (!item || Number(item.section) !== sectionIndex || !item.src) continue;
      const element = document.createElement(editable ? 'button' : 'span');
      element.className = 'shelf-object';
      if (editable) {
        element.type = 'button';
        element.dataset.objectId = item.id;
        element.setAttribute('aria-label', item.name + ' na prateleira ' + (sectionIndex + 1) + '. Arraste para reposicionar.');
        element.classList.toggle('selected', item.id === selectedId);
      }
      if (onBoard(item)) {
        element.classList.add('on-board');
        // Distância da borda do PNG à base física do vaso, do castiçal ou do globo.
        const overhang = {'folhagem-pendente.png':18.75,'velas-marfim.png':2.7,'globo-antigo.png':2.5};
        element.style.setProperty('--overhang', (overhang[item.src.split('/').pop()] || 0) + '%');
      }
      position(element,item);
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = editable ? '' : item.name || '';
      image.draggable = false;
      if (item.src === './assets/customizador/aquario.webp' && window.AuroraAquario) {
        element.append(window.AuroraAquario.create(image));
      } else {
        element.append(image);
        if (item.src === './assets/customizador/velas-marfim.png' || item.src === './assets/customizador/velas-bandeja.webp') {
          window.AuroraChamas?.mount(element, image);
        }
      }
      layer.append(element);
    }
    return layer;
  }

  function section(items, sectionIndex, options) {
    const section = document.createElement('div');
    section.className = 'shelf-section';
    section.setAttribute('aria-label', 'Prateleira ' + (sectionIndex + 1));
    const board = document.createElement('div');
    board.className = 'shelf-board';
    board.setAttribute('aria-hidden','true');
    section.append(objects(items,sectionIndex,options),board);
    return section;
  }

  window.AuroraShelfScene = {section,objects,position,onBoard};
})();
