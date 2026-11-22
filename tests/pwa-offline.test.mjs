import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const scope = 'https://example.com/biblioteca-aurora/';
const home = scope + JSON.parse(
  readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8')
).start_url.replace(/^\.\//, '');

function worker() {
  const handlers = {};
  const entries = new Map();
  const cache = {
    async add(url) { entries.set(new URL(url, scope).href, new Response('estante')); },
    async put(request, response) { entries.set(request.url ?? new URL(request, scope).href, response); }
  };
  let fetchResponse = () => { throw new TypeError('offline'); };
  runInNewContext(source, {
    self: {
      registration: {scope},
      skipWaiting() {},
      addEventListener(type, handler) { handlers[type] = handler; }
    },
    caches: {
      async open() { return cache; },
      async match(request, {ignoreSearch} = {}) {
        const url = new URL(request.url ?? request, scope);
        if (!ignoreSearch) return entries.get(url.href)?.clone();
        return [...entries].find(([key]) => new URL(key).pathname === url.pathname)?.[1].clone();
      }
    },
    fetch: async (...args) => fetchResponse(...args),
    URL, Request, Response, AbortController, setTimeout, clearTimeout
  });
  return {
    setFetch(next) { fetchResponse = next; },
    async install() {
      let pending;
      handlers.install({waitUntil(promise) { pending = promise; }});
      await pending;
    },
    async request(url, mode = 'navigate') {
      let result;
      const pending = [];
      handlers.fetch({
        request: {method: 'GET', mode, url},
        waitUntil(promise) { pending.push(promise); },
        respondWith(promise) { result = promise; }
      });
      await Promise.all(pending);
      return result;
    }
  };
}

test('abre a estante pelo endereço raiz após instalar, mesmo sem visita prévia à raiz', async () => {
  const app = worker();
  await app.install();
  assert.equal(await (await app.request(scope)).text(), 'estante');
  assert.equal(await (await app.request(home)).text(), 'estante');
});

test('reabre o leitor visitado pelo cache e mantém os erros de rotas ausentes', async () => {
  const app = worker();
  const reader = scope + 'ler-epub.html?livro=1';
  await app.install();
  app.setFetch(() => new Response('leitor'));
  assert.equal(await (await app.request(reader)).text(), 'leitor');
  app.setFetch(() => new Response('indisponível', {status: 503}));
  assert.equal(await (await app.request(reader)).text(), 'leitor');
  assert.equal((await app.request(scope + 'ouvir-livro.html')).status, 503);
  app.setFetch(() => new Response('ausente', {status: 404}));
  assert.equal((await app.request(reader)).status, 404);
  app.setFetch(() => { throw new TypeError('offline'); });
  assert.equal(await (await app.request(scope + 'ler-epub.html?livro=2')).text(), 'leitor');
  assert.equal((await app.request(scope + 'ouvir-livro.html')).type, 'error');
});

test('mantém um recurso carregado sob demanda disponível offline', async () => {
  const app = worker();
  const script = scope + 'aurora-epub-reader.js';
  app.setFetch(() => new Response('script do leitor'));
  assert.equal(await (await app.request(script, 'cors')).text(), 'script do leitor');
  app.setFetch(() => { throw new TypeError('offline'); });
  assert.equal(await (await app.request(script, 'cors')).text(), 'script do leitor');
});
