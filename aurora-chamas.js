/* Anima apenas a porção fotografada que fica acima de cada pavio. */
(() => {
  'use strict';
  const recipes = {
    'velas-marfim.png': {
      width:512, height:475,
      // x, y, largura e altura do recorte livre, em pixels da foto.
      flames:[[172,0,46,58],[300,128,44,58]]
    },
    'velas-bandeja.webp': {
      width:323, height:341,
      flames:[[90,0,39,64]]
    }
  };
  let sequence = 0;

  function svg(tag, attributes) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  function mount(element, image) {
    const src = image.getAttribute('src') || '';
    if (src.startsWith('data:') || src.startsWith('blob:')) return;
    const match = /(?:^|\/)assets\/customizador\/(velas-marfim\.png|velas-bandeja\.webp)(?:[?#].*)?$/.exec(src);
    if (!match || element.classList.contains('aurora-velas')) return;
    const {width, height, flames} = recipes[match[1]];
    const id = 'aurora-chama-' + (++sequence);
    const layer = svg('svg', {
      class:'aurora-chamas', viewBox:`0 0 ${width} ${height}`,
      preserveAspectRatio:'xMidYMax meet', 'aria-hidden':'true', focusable:'false'
    });
    const defs = svg('defs', {});
    const photo = svg('image', {id:id+'-foto', href:src, width, height});
    const body = svg('clipPath', {id:id+'-corpo'});
    let cutout = `M0 0h${width}v${height}H0Z`;
    for (const [x, y, w, h] of flames) cutout += `M${x} ${y}h${w}v${h}h-${w}Z`;
    body.append(svg('path', {d:cutout, 'clip-rule':'evenodd'}));
    const glow = svg('radialGradient', {id:id+'-luz'});
    glow.append(svg('stop', {offset:0,'stop-color':'#ffbd67','stop-opacity':0.43}),
                svg('stop', {offset:1,'stop-color':'#ff963e','stop-opacity':0}));
    defs.append(photo, body, glow);
    layer.append(defs, svg('use', {href:'#'+id+'-foto', 'clip-path':`url(#${id}-corpo)`}));

    flames.forEach(([x, y, w, h], index) => {
      const wickX = x + w / 2;
      const wickY = y + h;
      const light = svg('ellipse', {class:'aurora-chama-luz', cx:wickX, cy:wickY,
        rx:w*0.83, ry:h*0.55, fill:`url(#${id}-luz)`});
      const tip = svg('g', {class:'aurora-chama-ponta'});
      tip.style.transformOrigin = wickX+'px '+wickY+'px';
      // Um viewport próprio recorta a ponta antes de incliná-la, mantendo a cera imóvel.
      const crop = svg('svg', {x, y, width:w, height:h, viewBox:`${x} ${y} ${w} ${h}`, overflow:'hidden'});
      crop.append(svg('use', {href:'#'+id+'-foto'}));
      tip.append(crop);
      const pair = svg('g', {});
      pair.style.setProperty('--chama-atraso', -(sequence * 0.37 + index * 0.89) + 's');
      pair.style.setProperty('--chama-ciclo', (index ? 2.3 : 2.9) + 's');
      pair.append(light, tip);
      layer.append(pair);
    });
    element.append(layer);
    element.classList.add('aurora-velas');
  }
  window.AuroraChamas = {mount};
})();
