const CACHE = 'aurora-v89';
const HOME = './index.html?v=89';
// O cache inicial precisa ser leve para ativar o PWA rapidamente no celular.
// Os demais arquivos da estante, do livro 3D e dos leitores são cacheados
// quando usados. O conteúdo importado continua no armazenamento local.
const OPTIONAL_CORE = [
  './manifest.webmanifest?v=89',
  './aurora-pwa.js?v=2',
  './aurora-pwa.css?v=2',
  './icons/aurora-192.png',
  './icons/aurora-512.png'
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
    await cache.add(HOME);
    // Recursos extras são opcionais; falhas ou lentidão não bloqueiam a instalação.
    await Promise.allSettled(OPTIONAL_CORE.map(async url => {
      const response = await fetchWithTimeout(url, NAVIGATION_TIMEOUT_MS);
      if (response.ok) await cache.put(url, response);
    }));
  }));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key !== CACHE && /^aurora-v\d+$/.test(key))
      .map(key => caches.delete(key))))
  ]));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    // O endereço raiz pode permanecer no cache do GitHub Pages após um deploy.
    // A entrada versionada abre a edição atual também nos PWAs já instalados.
    const isAppRoot = new URL(request.url).pathname === new URL(self.registration.scope).pathname;
    const resource = isAppRoot ? new Request(new URL(HOME, self.registration.scope)) : request;
    const network = fetchWithTimeout(resource, NAVIGATION_TIMEOUT_MS);
    event.waitUntil(network.then(response => {
      if (response.ok) return saveResponse(resource, response);
    }).catch(() => {}));
    event.respondWith(network.then(
      async response => response.status >= 500 ? (await cachedPage(resource)) || response : response,
      async () => (await cachedPage(resource)) || Response.error()
    ));
    return;
  }
  const cached = caches.match(request, {cacheName: CACHE});
  const network = cached.then(response => response ? undefined : fetch(request));
  event.waitUntil(network.then(response => {
    // As bibliotecas carregadas pela primeira vez também ficam disponíveis offline.
    if (response && (response.ok || response.type === 'opaque')) {
      return saveResponse(request, response);
    }
  }).catch(() => {}));
  event.respondWith(cached.then(response => response || network));
});

async function cachedPage(request) {
  return (await caches.match(request, {cacheName: CACHE}))
    || caches.match(request, {cacheName: CACHE, ignoreSearch: true});
}

function saveResponse(request, response) {
  const copy = response.clone();
  return caches.open(CACHE).then(cache => cache.put(request, copy));
}
