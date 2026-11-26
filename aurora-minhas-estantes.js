(() => {
  'use strict';
  const listKey = 'aurora-estantes-personalizadas-v1';
  const DEFAULT_SHELF_ID = 'libria-estante-principal-v2';
  const LEGACY_DEFAULT_SHELF_ID = 'libria-estante-principal-v1';
  const DEFAULT_SHELF = Object.freeze({
    id:DEFAULT_SHELF_ID,name:'Minha estante',genre:'',wall:'tijolos',wallTone:'noite',
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
      return stored.filter(shelf => shelf?.id && shelf.id !== DEFAULT_SHELF_ID && shelf.id !== LEGACY_DEFAULT_SHELF_ID && shelf.published === true)
        .sort((a, b) => (a.publishedAt || 0) - (b.publishedAt || 0));
    } catch { return []; }
  }

  function readDefaultShelf() {
    try {
      const saved = window.AuroraEstantesSalvas.read().find(item => item?.id === DEFAULT_SHELF_ID);
      return saved ? {...DEFAULT_SHELF,...saved,id:DEFAULT_SHELF_ID} : {...DEFAULT_SHELF};
    } catch { return {...DEFAULT_SHELF}; }
  }

  function navigateTo(index) {
    const url = new URL(location.href);
    const shelf = published[index - 1];
    url.searchParams.set('estantes','1');
    if (index > 0 && shelf) url.searchParams.set('estante', shelf.id);
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
    const isDefault = !id || id === DEFAULT_SHELF_ID;
    const foundIndex = published.findIndex(shelf => shelf.id === id);
    position = isDefault || foundIndex < 0 ? 0 : foundIndex + 1;
    const shelf = isDefault || foundIndex < 0 ? readDefaultShelf() : published[foundIndex];
    const total = published.length + 1;
    previous.hidden = next.hidden = total === 1;
    previous.disabled = position === 0;
    next.disabled = position === total - 1;
    byId('shelfTitle').textContent = shelf.name || 'Minha estante';
    const genreName = (window.AuroraShelf?.categories || []).find(item => item.id === shelf.genre)?.name || '';
    byId('shelfPosition').textContent = [total > 1 ? 'Estante ' + (position + 1) + ' de ' + total : '',genreName].filter(Boolean).join(' · ');
    byId('shelfSwitcher').hidden = false;
    if (shelf && byId('arrangeButton')?.getAttribute('aria-pressed') === 'true') byId('arrangeButton').click();
    if (shelf && !byId('roomPanel').hidden) byId('roomButton').click();
    document.body.classList.add('personal-shelf-open');
    // A estante de exibição é independente do catálogo. O catálogo permanece no DOM,
    // fora da tela, para que os livros antigos continuem acessíveis pelos gêneros.
    byId('library').hidden = false;
    byId('personalShelf').hidden = edit.hidden = false;
    addBook.hidden = true;
    window.AuroraEstanteExemplares.clear();
    scene.replaceChildren();

    {
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
      addBook.disabled = !sections || !shelf.genre;
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
    window.AuroraLombadas?.processAll();
    if (id || chooseBook || url.searchParams.get('estantes') === '1') {
      url.searchParams.set('estantes','1');
      if (chooseBook) url.searchParams.delete('livros');
      if (isDefault || foundIndex < 0) url.searchParams.delete('estante');
      if (url.href !== location.href) history.replaceState(history.state, '', url);
    }
  }

  previous.addEventListener('click', () => navigateTo(position - 1));
  next.addEventListener('click', () => navigateTo(position + 1));
  addBook.addEventListener('click', () => window.AuroraEstanteExemplares.openPicker());
  window.addEventListener('popstate', () => {
    const selectedId = new URL(location.href).searchParams.get('estante');
    const currentId = position === 0 ? null : published[position - 1]?.id || null;
    if (selectedId !== currentId) showCurrentShelf();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) showCurrentShelf(); });
  window.addEventListener('storage', event => {
    if (event.key === listKey || event.key === null) showCurrentShelf();
  });
  window.AuroraMinhasEstantes={refresh:showCurrentShelf};
  showCurrentShelf();
})();
