(() => {
  'use strict';
  const listKey = 'aurora-estantes-personalizadas-v1';
  const DEFAULT_SHELF_ID = 'libria-estante-principal-v1';
  const DEFAULT_SHELF = Object.freeze({
    id:DEFAULT_SHELF_ID,name:'Minha primeira estante',wall:'tijolos',wallTone:'noite',
    wood:'nogueira',shelfTone:'natural',light:85,sections:1,objects:[],published:true
  });
  const byId = id => document.getElementById(id);
  const canvas = byId('personalCanvas');
  const scene = byId('personalScene');
  const previous = byId('shelfPrevious');
  const next = byId('shelfNext');
  const addBook = byId('addShelfBook');
  const edit = byId('editPersonalShelf');
  let published = [];
  let position = 0;

  function readPublished() {
    try {
      const stored = window.AuroraEstantesSalvas.read();
      return stored.filter(shelf => shelf?.id && shelf.published === true)
        .sort((a, b) => (a.publishedAt || 0) - (b.publishedAt || 0));
    } catch { return []; }
  }

  function navigateTo(index) {
    const url = new URL(location.href);
    const shelf = published[index - 1];
    if (shelf) url.searchParams.set('estante', shelf.id);
    else url.searchParams.delete('estante');
    url.searchParams.delete('livros');
    history.pushState(null, '', url);
    showCurrentShelf();
  }

  function showCurrentShelf() {
    const url = new URL(location.href);
    const id = url.searchParams.get('estante');
    const chooseBook = url.searchParams.get('livros') === '1';
    published = readPublished();
    position = published.findIndex(shelf => shelf.id === id) + 1;
    const shelf = published[position - 1];
    const total = published.length + 1;
    previous.hidden = next.hidden = total === 1;
    previous.disabled = position === 0;
    next.disabled = position === total - 1;
    byId('shelfTitle').textContent = shelf?.name || (shelf ? 'Minha estante' : 'Estante principal');
    byId('shelfPosition').textContent = total > 1 ? 'Estante ' + (position + 1) + ' de ' + total : '';
    byId('shelfSwitcher').hidden = false;
    if (shelf && byId('arrangeButton').getAttribute('aria-pressed') === 'true') byId('arrangeButton').click();
    if (shelf && !byId('roomPanel').hidden) byId('roomButton').click();
    document.body.classList.toggle('personal-shelf-open', Boolean(shelf));
    byId('library').hidden = Boolean(shelf);
    byId('personalShelf').hidden = addBook.hidden = edit.hidden = !shelf;
    window.AuroraEstanteExemplares.clear();
    scene.replaceChildren();

    if (shelf) {
      edit.href = './nova-estante.html?id=' + encodeURIComponent(shelf.id);
      canvas.dataset.wall = shelf.wall || 'tijolos';
      canvas.dataset.wallTone = shelf.wallTone || 'noite';
      canvas.dataset.shelf = shelf.wood || 'nogueira';
      canvas.dataset.shelfTone = shelf.shelfTone || 'natural';
      const light = Math.max(.55, Math.min(1.18, (Number(shelf.light) || 85) / 85));
      canvas.style.filter = 'brightness(' + light + ')';
      canvas.querySelector('.canvas-light').style.opacity = Math.min(1, light);
      const sections = Math.max(0, Math.min(8, Number(shelf.sections) || 0));
      const objects = Array.isArray(shelf.objects) ? shelf.objects : [];
      for (let i = 0; i < sections; i++) scene.append(window.AuroraShelfScene.section(objects, i));
      addBook.disabled = !sections;
      if (!sections) {
        const link = document.createElement('a');
        link.className = 'create-first-section';
        link.href = edit.href;
        link.textContent = 'Adicionar a primeira prateleira';
        scene.append(link);
      }
      window.AuroraEstanteExemplares.render(shelf, scene);
      if (chooseBook && sections) window.AuroraEstanteExemplares.openPicker();
    }
    if (!shelf && published.length) window.AuroraLombadas?.processAll();
    if (chooseBook || (id && !shelf)) {
      url.searchParams.delete('livros');
      if (!shelf) url.searchParams.delete('estante');
      history.replaceState(history.state, '', url);
    }
  }

  previous.addEventListener('click', () => navigateTo(position - 1));
  next.addEventListener('click', () => navigateTo(position + 1));
  addBook.addEventListener('click', () => window.AuroraEstanteExemplares.openPicker());
  window.addEventListener('popstate', () => {
    const selectedId = new URL(location.href).searchParams.get('estante');
    if (selectedId !== (published[position - 1]?.id || null)) showCurrentShelf();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) showCurrentShelf(); });
  window.addEventListener('storage', event => {
    if (event.key === listKey || event.key === null) showCurrentShelf();
  });
  showCurrentShelf();
})();
