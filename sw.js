const CACHE = 'aurora-v75';
const CORE = [
  './index.html?v=73', './meus-livros.html?v=32', './aurora-sala-3d.js?v=31',
  './aurora-estante.js?v=24', './aurora-estante-realista.css?v=9',
  './aurora-importados.js?v=28', './aurora-estante-3d.js?v=4', './aurora-livro-3d.mjs?v=18', './aurora-edition-surfaces.js?v=9',
  './', './index.html', './index.html?v=22', './index.html?v=35', './index.html?v=36', './index.html?v=37', './index.html?v=38', './index.html?v=39', './index.html?v=40', './index.html?v=41', './index.html?v=42', './index.html?v=43', './index.html?v=44', './index.html?v=45', './index.html?v=47', './index.html?v=48', './index.html?v=49', './index.html?v=50', './index.html?v=51', './index.html?v=52', './index.html?v=53', './index.html?v=54', './index.html?v=55', './index.html?v=56', './index.html?v=57', './index.html?v=58', './index.html?v=59', './index.html?v=60', './index.html?v=61', './index.html?v=62', './index.html?v=63', './index.html?v=46', './meus-livros.html?v=22', './meus-livros.html?v=23', './meus-livros.html?v=24', './meus-livros.html?v=25', './meus-livros.html?v=26', './meus-livros.html?v=27', './meus-livros.html?v=28', './meus-livros.html?v=29', './meus-livros.html?v=30', './meus-livros.html?v=20', './meus-livros.html?v=21',
  './explorar-livros.html', './ler-online.html', './minha-biblioteca-privada.html', './aurora-notion-privado.js?v=2', './aurora-online.css?v=6', './aurora-online.css?v=7',
  './aurora-online.js?v=5', './aurora-online-estante.js?v=3', './aurora-leitura-online.js?v=5', './aurora-leitura-online.js?v=6',
  './ler-epub.html', './ouvir-livro.html', './aurora-novos-leitores.css?v=1', './aurora-novos-leitores.css?v=2', './aurora-novos-leitores.css?v=3', './aurora-novos-leitores.css?v=4', './aurora-novos-leitores.css?v=5', './aurora-novos-leitores.css?v=6', './aurora-novos-leitores.css?v=7', './aurora-novos-leitores.css?v=8',
  './aurora-formatos.js?v=1', './aurora-formatos.js?v=2', './aurora-formatos.js?v=3', './aurora-formatos.js?v=4', './aurora-formatos.js?v=5', './aurora-formatos.js?v=6', './aurora-formatos.js?v=7', './aurora-formatos.js?v=8', './aurora-formatos.js?v=9', './aurora-formatos.js?v=10', './aurora-novos-formatos.js?v=2', './aurora-novos-formatos.js?v=3', './aurora-novos-formatos.js?v=4', './aurora-novos-formatos.js?v=5',
  './aurora-epub-reader.js?v=2', './aurora-epub-reader.js?v=3', './aurora-epub-reader.js?v=4', './aurora-epub-reader.js?v=5', './aurora-epub-reader.js?v=6', './aurora-epub-reader.js?v=7', './aurora-epub-reader.js?v=8', './aurora-audiobook.js?v=1', './aurora-som-folhas.js?v=1', './aurora-som-folhas.js?v=2', './aurora-titulos.js?v=1', './aurora-lombadas.js?v=1', './aurora-lombadas.js?v=2', './aurora-lombadas.js?v=3', './vendor/jszip.min.js',
  './aurora-estante.css?v=15', './aurora-estante.css?v=16', './aurora-estante.css?v=17', './aurora-avancado.css?v=4', './aurora-sala-3d.css?v=2', './aurora-sala-3d.css?v=3', './aurora-sala-3d.css?v=4', './aurora-sala-3d.css?v=5', './aurora-sala-3d.css?v=6', './aurora-sala-3d.css?v=7', './aurora-edicao.css?v=1',
  './aurora-ambiente.css?v=2', './aurora-estante-realista.css?v=1', './aurora-estante-realista.css?v=2', './aurora-estante-realista.css?v=3', './aurora-estante-realista.css?v=4', './aurora-catalogos.css?v=1', './aurora-catalogos.css?v=2',
  './aurora-vitrine.css?v=5', './aurora-vitrine.css?v=6', './aurora-vitrine.css?v=7', './aurora-vitrine.css?v=8', './aurora-reader.css?v=3', './aurora-reader.css?v=4', './aurora-reader.css?v=5', './aurora-reader.css?v=6', './aurora-reader.css?v=7', './aurora-reader.css?v=8', './aurora-reader.css?v=9', './aurora-reader.css?v=10', './aurora-reader.css?v=11', './aurora-reader.css?v=12', './aurora-sinopses.js?v=2', './aurora-sinopses.js?v=3',
  './aurora-estante.js?v=7', './aurora-estante.js?v=8', './aurora-estante.js?v=9', './aurora-estante.js?v=10', './aurora-estante.js?v=11', './aurora-estante.js?v=12', './aurora-estante.js?v=13', './aurora-estante.js?v=14', './aurora-estante.js?v=15', './aurora-estante.js?v=16', './aurora-estante.js?v=17', './aurora-estante.js?v=18', './aurora-estante.js?v=19', './aurora-catalogos.js?v=1', './aurora-catalogos.js?v=2', './aurora-catalogos.js?v=3', './aurora-sala-3d.js?v=8', './aurora-sala-3d.js?v=9', './aurora-sala-3d.js?v=10', './aurora-sala-3d.js?v=11', './aurora-sala-3d.js?v=12', './aurora-sala-3d.js?v=13', './aurora-sala-3d.js?v=14', './aurora-sala-3d.js?v=15', './aurora-sala-3d.js?v=16', './aurora-sala-3d.js?v=17', './aurora-sala-3d.js?v=18', './aurora-sala-3d.js?v=19', './aurora-sala-3d.js?v=20', './aurora-sala-3d.js?v=21', './aurora-sala-3d.js?v=22', './aurora-sala-3d.js?v=23', './aurora-sala-3d.js?v=24', './aurora-sala-3d.js?v=25', './aurora-sala-3d.js?v=26', './aurora-sala-3d.js?v=27', './aurora-importados.js?v=21', './aurora-importados.js?v=22', './aurora-importados.js?v=23', './aurora-importados.js?v=24', './aurora-importados.js?v=25', './aurora-importados.js?v=26', './aurora-importados.js?v=27', './aurora-avancado.js?v=6',
  './aurora-online-estante.js?v=4',
  './aurora-pdf-covers.js?v=1', './aurora-pdf-import.js?v=5', './aurora-pdf-import.js?v=6',
  './aurora-livro-3d.mjs?v=18', './aurora-livro-3d.mjs?v=5', './aurora-livro-3d.mjs?v=6', './aurora-livro-3d.mjs?v=7', './aurora-livro-3d.mjs?v=8', './aurora-edition-surfaces.js?v=1', './aurora-edition-surfaces.js?v=2', './aurora-edition-surfaces.js?v=3', './aurora-edition-surfaces.js?v=9', './assets/prateleira-romances.webp',
  './assets/prateleira-picantes.webp', './assets/prateleira-ficcao.webp',
  './assets/prateleira-brasileiros.webp', './assets/lombadas-couro.webp',
  './assets/ambientes/parede-0.webp', './assets/ambientes/parede-1.webp',
  './assets/ambientes/parede-2.webp', './assets/ambientes/parede-3.webp',
  './assets/ambientes/parede-4.webp', './assets/ambientes/prateleira-0.webp',
  './assets/ambientes/prateleira-1.webp', './assets/ambientes/prateleira-2.webp',
  './assets/ambientes/prateleira-3.webp', './assets/ambientes/prateleira-4.webp',
  './manifest.webmanifest'
];

// Protege a instalação em conexões lentas: só a página atual é obrigatória.
const NAVIGATION_TIMEOUT_MS = 6000;
async function fetchWithTimeout(resource, milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await fetch(resource, {signal: controller.signal}); }
  finally { clearTimeout(timer); }
}
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(async cache => {
    // Se a versão nova não estiver disponível, a antiga não é descartada.
    await cache.add('./index.html?v=70');
    await Promise.allSettled(CORE.filter(url => url !== './index.html?v=70').map(url => cache.add(url)));
  }));
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
    const resource = isAppRoot ? new Request(new URL('./index.html?v=70',self.registration.scope)) : request;
    event.respondWith(fetchWithTimeout(resource,NAVIGATION_TIMEOUT_MS).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request,copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request,{ignoreSearch:true}).then(result => result || caches.match('./index.html'))));
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
