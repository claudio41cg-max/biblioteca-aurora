const CACHE = 'libria-v126';
const HOME = './index.html?v=126';
const EDITOR = './nova-estante.html?v=126';
const SCOPE = new URL(self.registration.scope);
const PROJECT_CACHE = /^(aurora|libria)-v\d+$/;
const NAVIGATION_TIMEOUT_MS = 6000;

async function fetchWithTimeout(resource, milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try { return await fetch(resource, {signal: controller.signal}); }
  finally { clearTimeout(timer); }
}

function localResource(url) {
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
}

// Guarde os scripts e estilos versionados pela própria página. A instalação
// só fica pronta quando o catálogo puder ser aberto sem a rede.
async function prepareHome() {
  const homeURL = new URL(HOME, SCOPE);
  const response = await fetchWithTimeout(homeURL, 12000);
  if (!response.ok) throw new Error('Catálogo indisponível para instalação.');
  const html = await response.clone().text();
  const resources = new Set();
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*?\s(?:src|href)=["']([^"']+)["']/gi)) {
    const url = new URL(match[1], homeURL);
    if (localResource(url) && /\.(?:m?js|css|webmanifest|png)$/i.test(url.pathname)) resources.add(url.href);
  }
  if (!resources.size) throw new Error('Recursos do catálogo indisponíveis para instalação.');
  const cache = await caches.open(CACHE);
  await cache.addAll([...resources]);
  await cache.put(homeURL, response);
  await Promise.allSettled(['./icons/aurora-192.png','./icons/aurora-512.png']
    .map(icon => cache.add(new URL(icon, SCOPE))));
}

self.addEventListener('install', event => {
  event.waitUntil(prepareHome().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const previous = names.filter(name => name !== CACHE && PROJECT_CACHE.test(name)).at(-1);
    // Preserve a edição anterior como reserva para leitores já usados offline.
    await Promise.all(names.filter(name => name !== CACHE && name !== previous && PROJECT_CACHE.test(name))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cached(resource, options) {
  const current = await caches.open(CACHE);
  const hit = await current.match(resource, options);
  if (hit) return hit;
  const names = await caches.keys();
  const previous = names.filter(name => name !== CACHE && PROJECT_CACHE.test(name)).at(-1);
  return previous ? (await caches.open(previous)).match(resource, options) : undefined;
}

function offlinePage() {
  const home = new URL(HOME, SCOPE);
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Página indisponível offline</title><style>body{max-width:32rem;margin:12vh auto;padding:0 20px;font:16px/1.6 system-ui;color:#29251e;background:#fcf4e5}a{color:#593c23}</style><h1>Esta página precisa de conexão</h1><p>Abra esta página com internet para prepará-la para uso offline.</p><p><a href="${home.href}">Voltar ao catálogo</a></p></html>`,
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
}

async function navigate(request, url) {
  const home = new URL(HOME, SCOPE);
  const editor = new URL(EDITOR, SCOPE);
  const isHome = url.pathname === SCOPE.pathname || url.pathname === home.pathname;
  const page = isHome ? home : url.pathname === editor.pathname ? editor : null;
  const resource = page ? new Request(page) : request;
  try {
    const response = await fetchWithTimeout(resource, NAVIGATION_TIMEOUT_MS);
    if (response.ok) {
      const copy = response.clone();
      await (await caches.open(CACHE)).put(resource, copy).catch(() => {});
    }
    return response;
  } catch {
    // As consultas guardam apenas o ID a abrir. O mesmo HTML serve cada livro.
    return (await cached(resource)) || (await cached(request, {ignoreSearch:true})) || offlinePage();
  }
}

async function asset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return (await cached(request)) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    if (localResource(url)) event.respondWith(navigate(request, url));
    return;
  }
  // Não intercepte outro aplicativo hospedado no mesmo domínio.
  if (url.origin === SCOPE.origin && !localResource(url)) return;
  event.respondWith(asset(request));
});
