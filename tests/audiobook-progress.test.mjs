import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

test('espera o progresso salvo antes de carregar o áudio e gravar uma posição', async () => {
  const elements = new Map();
  const saved = Promise.withResolvers();
  const readingProgress = Promise.withResolvers();
  const writes = [];
  const document = Object.assign(new EventTarget(), {
    hidden: true,
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, Object.assign(new EventTarget(), {
          setAttribute() {},
          options: [],
          currentTime: 0,
          duration: 90,
          paused: true
        }));
      }
      return elements.get(id);
    }
  });
  const audio = document.getElementById('audio');
  Object.defineProperty(audio, 'src', {
    set() { audio.dispatchEvent(new Event('loadedmetadata')); }
  });
  const window = Object.assign(new EventTarget(), {
    AuroraFormats: {
      async readRecord(store) {
        if (store === 'books') {
          return {id: 'audio', format: 'audio', name: 'Audiolivro', data: new ArrayBuffer(1)};
        }
        readingProgress.resolve();
        return saved.promise;
      },
      async saveRecord(store, record) { writes.push(record); }
    }
  });
  runInNewContext(readFileSync(new URL('../aurora-audiobook.js', import.meta.url), 'utf8'), {
    document, window, location: {search: '?livro=audio'},
    localStorage: {getItem: () => null}, URLSearchParams, URL, Blob, console
  });
  await readingProgress.promise;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.deepEqual(writes, []);

  saved.resolve({seconds: 35});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(audio.currentTime, 35);
  assert.match(document.getElementById('audioStatus').textContent, /Continuando/);
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(writes[0].seconds, 35);
});
