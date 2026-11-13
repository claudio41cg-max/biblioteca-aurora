const CACHE = 'aurora-v18';
const CORE = [
  './', './index.html', './index.html?v=17', './meus-livros.html?v=17',
  './aurora-estante.css?v=15', './aurora-avancado.css?v=4', './aurora-sala-3d.css?v=2', './aurora-edicao.css?v=1',
  './aurora-vitrine.css?v=5', './aurora-reader.css?v=1', './aurora-sinopses.js?v=2',
  './aurora-estante.js?v=4', './aurora-sala-3d.js?v=3', './aurora-importados.js?v=17', './aurora-avancado.js?v=3',
  './aurora-pdf-covers.js?v=1', './aurora-pdf-import.js?v=3',
  './aurora-livro-3d.mjs?v=4', './aurora-edition-surfaces.js?v=1', './assets/prateleira-romances.webp',
  './assets/prateleira-picantes.webp', './assets/prateleira-ficcao.webp',
  './assets/prateleira-brasileiros.webp', './assets/lombadas-couro.webp',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    // O endereço raiz pode permanecer no cache do GitHub Pages após um deploy.
    // A entrada versionada abre a edição atual também nos PWAs já instalados.
    const isAppRoot = new URL(request.url).pathname === new URL(self.registration.scope).pathname;
    const resource = isAppRoot ? new Request(new URL('./index.html?v=17',self.registration.scope)) : request;
    event.respondWith(fetch(resource).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request,copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request).then(result => result || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      // As bibliotecas carregadas pela primeira vez também ficam disponíveis offline.
      if (response.ok || response.type === 'opaque') {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request,copy)).catch(() => {});
      }
      return response;
    });
  }));
});
