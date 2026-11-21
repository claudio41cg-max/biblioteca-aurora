const CACHE = 'aurora-v89';
// O cache inicial precisa ser leve para ativar o PWA rapidamente no celular.
// Os demais arquivos da estante, do livro 3D e dos leitores são cacheados
// quando usados. O conteúdo importado continua no armazenamento local.
const CORE = [
  './index.html?v=89',
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
    await cache.add('./index.html?v=89');
    // Recursos extras são opcionais; falhas ou lentidão não bloqueiam a instalação.
    await Promise.allSettled(CORE.filter(url => url !== './index.html?v=89').map(url => cache.add(url)));
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
    const resource = isAppRoot ? new Request(new URL('./index.html?v=89',self.registration.scope)) : request;
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

