import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const scope = 'https://example.com/biblioteca-aurora/';

test('instala a mesma entrada declarada no manifesto e guarda recursos visitados', async () => {
  const listeners = new Map();
  const entries = new Map();
  const key = request => new URL(request.url ?? request, scope).href;
  const cache = {
    async add(request) { entries.set(key(request), new Response('entrada')); },
    async put(request, response) { entries.set(key(request), response); }
  };
  let online = true;
  runInNewContext(source, {
    self: {
      registration: {scope},
      skipWaiting() {},
      addEventListener(name, handler) { listeners.set(name, handler); }
    },
    caches: {
      async open() { return cache; },
      async match(request) { return entries.get(key(request))?.clone(); }
    },
    async fetch(request) {
      if (!online) throw new TypeError('offline');
      return new Response(key(request));
    },
    URL, Request, Response, AbortController, setTimeout, clearTimeout
  });
  let installation;
  listeners.get('install')({waitUntil(promise) { installation = promise; }});
  await installation;
  assert.equal(await entries.get(key(manifest.start_url))?.text(), 'entrada');

  async function request(url, mode = 'same-origin') {
    let result;
    const pending = [];
    listeners.get('fetch')({
      request: {method: 'GET', mode, url},
      respondWith(response) { result = response; },
      waitUntil(promise) { pending.push(promise); }
    });
    const response = await result;
    await Promise.all(pending);
    return response;
  }

  const files = ['ler-epub.html', 'ouvir-livro.html', 'assets/ambientes/parede-0.webp'];
  for (const file of files) {
    const url = key(file);
    await request(url, file.endsWith('.html') ? 'navigate' : 'same-origin');
    assert.equal(await entries.get(url)?.clone().text(), url);
  }
  online = false;
  for (const file of files) {
    const url = key(file);
    assert.equal(await (await request(url, file.endsWith('.html') ? 'navigate' : 'same-origin')).text(), url);
  }
});
