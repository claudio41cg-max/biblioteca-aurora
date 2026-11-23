/* Volume da edição apoiado na prateleira. O mesmo giro determina a imagem e a área ocupada. */
(() => {
  'use strict';
  const prepared = new WeakMap();
  const paper = new Map();
  const radians = Math.PI / 180;
  // Na pilha, o olhar vem de cima e deixa uma faixa da capa visível atrás da lombada.
  const viewAngle = (yaw,horizontal) => (yaw + (horizontal ? 5 : 0))*radians;
  function project(_height,cover,spine,yaw,horizontal = false) {
    const angle = viewAngle(yaw,horizontal);
    return Math.abs(Math.sin(angle))*cover + Math.abs(Math.cos(angle))*spine;
  }

  function surface(root,name) {
    const face = document.createElement('span');
    face.dataset.volumeFace = name;
    root.append(face);
    return face;
  }

  function picture(face,src) {
    const image = new Image();
    image.alt = '';
    image.draggable = false;
    image.decoding = 'async';
    image.addEventListener('error',() => image.remove(),{once:true});
    face.append(image);
    image.src = src;
    return image;
  }

  function label(face,title,author) {
    const name = document.createElement('b');
    name.textContent = title;
    face.append(name);
    if (author) {
      const byline = document.createElement('small');
      byline.textContent = author;
      face.append(byline);
    }
  }

  function paperTexture(face,direction) {
    const surfaces = window.AuroraEditionSurfaces;
    if (!surfaces?.paperEdgeCanvas) return;
    if (!paper.has(direction)) {
      paper.set(direction,'url('+surfaces.paperEdgeCanvas(direction).toDataURL('image/png')+')');
    }
    face.style.backgroundImage = paper.get(direction);
  }

  function smallPrint(face,canvas,width,height) {
    if (!canvas) return;
    // As faces do visor de leitura têm resolução de tela cheia. Conserve só a miniatura na estante.
    const print = document.createElement('canvas');
    print.width = width;
    print.height = height;
    const ctx = print.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas,0,0,width,height);
    face.replaceChildren(print);
  }

  function prepare(button,book = {}) {
    const previous = prepared.get(button);
    if (previous?.root.parentElement === button) return previous.root;
    // O catálogo público já mantém as artes importadas em memória. O editor lê a mesma edição por ID.
    const edition = book.button && book.key?.startsWith('arquivo:')
      ? window.AuroraImportedBooks?.find(item => String(item.id) === button.dataset.bookId) || book
      : book;
    const root = document.createElement('span');
    root.className = 'shelf-volume';
    root.setAttribute('aria-hidden','true');
    const faces = {};
    for (const name of ['back','fore','cover','spine','top']) faces[name] = surface(root,name);
    const title = button.querySelector('.spine-title')?.textContent || book.title || 'Livro';
    const author = book.author || button.dataset.author || '';
    label(faces.cover,title,author);
    label(faces.back,title,author);
    label(faces.spine,title);

    const source = book.button || button;
    const photographed = Boolean(edition.spine || source.dataset.realSpine === 'true');
    const printed = source.dataset.spineCrisp === 'true';
    if (photographed || printed) {
      if (edition.spine) {
        const image = picture(faces.spine,edition.spine);
        image.addEventListener('error',() => faces.spine.classList.remove('has-spine-print'),{once:true});
      } else if (source.style.backgroundImage) faces.spine.style.backgroundImage = source.style.backgroundImage;
      if (edition.spine || source.style.backgroundImage) faces.spine.classList.add('has-spine-print');
    } else if (source.dataset.coverDerived !== 'true') {
      faces.spine.classList.add('cloth-spine');
    }
    if (edition.back) picture(faces.back,edition.back);

    const front = window.AuroraEstanteCapa.prepare(button);
    const image = front.querySelector('img');
    const state = {root,faces,geometry:null,art:null};
    prepared.set(button,state);
    if (image) {
      // Use a própria face frontal da aplicação, inclusive se uma capa de rede falhar e for substituída.
      const mirror = () => {
        const original = front.querySelector('img');
        const url = original?.getAttribute('src');
        if (!url || url === state.art) return;
        state.art = url;
        const cover = picture(faces.cover,url);
        const needsSpine = !photographed && !printed && source.dataset.coverDerived === 'true';
        if (needsSpine) {
          // Conserva a fotografia e o título na lombada mesmo quando a imagem está em outra origem.
          faces.spine.style.backgroundImage = source.style.backgroundImage;
          faces.spine.style.backgroundSize = 'cover';
          faces.spine.style.backgroundPosition = 'center';
        }
        if (!needsSpine && edition.back) return;
        cover.addEventListener('load',() => {
          if (state.art !== url) return;
          const aspect = (parseFloat(button.style.getPropertyValue('--book-width')) || 38) /
                         (parseFloat(button.style.getPropertyValue('--book-height')) || 164);
          try {
            const art = window.AuroraEditionSurfaces?.generate(cover,{
              title,author,description:edition.description,coverSource:source.dataset.coverSource,
              back:edition.back,spine:!needsSpine
            },aspect);
            if (art?.spine) smallPrint(faces.spine,art.spine,144,608);
            if (art?.back) smallPrint(faces.back,art.back,288,408);
          } catch (error) {
            // Uma capa externa ainda pode ser exibida quando a origem não permite amostrar suas cores.
            if (error.name !== 'SecurityError') console.warn('Acabamento do exemplar indisponível.',error);
          }
        },{once:true});
      };
      mirror();
      // A capa ilustrativa de reserva é instalada por AuroraEstanteCapa depois de uma falha de rede.
      front.addEventListener('load',mirror,true);
    }
    paperTexture(faces.fore,'vertical');
    paperTexture(faces.top,'horizontal');
    button.append(root);
    return root;
  }

  function layout(button,height,cover,spine,yaw,horizontal = false) {
    if (!Number.isFinite(yaw)) {
      delete button.dataset.volumeEstante;
      delete button.dataset.volumeFlat;
      return;
    }
    if (!prepared.has(button)) prepare(button);
    const state = prepared.get(button);
    button.dataset.volumeEstante = 'true';
    button.toggleAttribute('data-volume-flat',horizontal);
    if (height <= 0 || cover <= 0 || spine <= 0) return;
    const last = state.geometry;
    if (last && last.height === height && last.cover === cover && last.spine === spine && last.yaw === yaw && last.horizontal === horizontal) return;
    state.geometry = {height,cover,spine,yaw,horizontal};

    // Projeção ortográfica com a vista ligeiramente acima do livro. A caixa projetada
    // mede exatamente project() × height para manter contato ao empilhar e ao girar.
    const angle = viewAngle(yaw,horizontal);
    const sin = Math.cos(angle), cos = Math.sin(angle);
    const width = project(height,cover,spine,yaw,horizontal);
    const depth = Math.abs(sin)*cover + Math.abs(cos)*spine;
    const slope = Math.min(.083,height*.14/Math.max(1,depth));
    const topHeight = depth*slope;
    const sideScale = (height-topHeight)/height;
    const halfW = cover/2, halfD = spine/2;
    function paint(name,w,h,x,z,ux,uz,vx,vz,vertical) {
      const face = state.faces[name];
      const across = ux*cos + uz*sin;
      // A face só é pintada quando sua normal está voltada para a câmera.
      face.hidden = vertical && across < .00001;
      if (face.hidden) return;
      const away = -ux*sin + uz*cos;
      let dx = width/2 + x*cos + z*sin;
      let dy = topHeight/2 + slope*(-x*sin + z*cos);
      let acrossY = away*slope;
      let downX = vx*cos + vz*sin;
      if (horizontal) {
        // O livro deitado abre com a capa voltada para cima. Inverter também a origem
        // da impressão mantém legíveis a arte e o título em ambas as orientações.
        dx = width-dx-across*w;
        dy += acrossY*w;
        acrossY = -acrossY;
        downX = -downX;
      }
      const downY = vertical ? sideScale : slope*(-vx*sin + vz*cos);
      face.style.width = w+'px';
      face.style.height = h+'px';
      face.style.transform = 'matrix('+[across,acrossY,downX,downY,dx,dy].join(',')+')';
      const light = vertical ? Math.min(.33,Math.max(.025,.215 - across*.155 - away*.105)) : .045;
      face.style.setProperty('--volume-shade',String(light));
    }
    paint('cover',cover,height,-halfW,halfD,1,0,0,0,true);
    paint('back',cover,height,halfW,-halfD,-1,0,0,0,true);
    paint('spine',spine,height,-halfW,-halfD,0,1,0,0,true);
    paint('fore',spine,height,halfW,halfD,0,-1,0,0,true);
    paint('top',cover,spine,-halfW,-halfD,1,0,0,1,false);
  }

  window.AuroraVolumeEstante = {prepare,project,layout};
})();
