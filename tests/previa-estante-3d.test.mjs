import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate as nextFrame} from 'node:timers/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../aurora-estante-3d.js', import.meta.url), 'utf8');
const books = [
  {id:'envelope', title:'O Envelope Sobre a Mesa', cover:'capa-envelope'},
  {id:'jane', title:'Jane Eyre — Charlotte Brontë', cover:'capa-jane', spine:'lombada-original'},
  {id:'outro', title:'Jane Eyre revisitada', cover:'outra-capa'}
];

function start(search, render) {
  const buttons = books.map(book => ({
    isConnected:true,
    dataset:{bookId:book.id},
    children:[{src:book.cover}, {className:'spine-title'}, {className:'spine-bookmark'}],
    style:{setProperty() {}},
    querySelector(selector) {
      if (selector === '.shelf-book-cover img') return this.children[0];
      return this.children.find(child => '.' + child.className === selector);
    },
    append(child) { this.children.push(child); }
  }));
  const window = Object.assign(new EventTarget(), {
    AuroraTitles:{display:title => title || ''}, AuroraImportedBooks:books,
    Aurora3D:render && {renderShelfPreview:render}
  });
  const document = Object.assign(new EventTarget(), {querySelectorAll:() => buttons});
  class Image {
    naturalHeight = 500;
    naturalWidth = 125;
    async decode() {}
  }
  vm.runInNewContext(source, {window, document, location:{search, hash:''}, URLSearchParams, Image, queueMicrotask, console});
  return {buttons, document, window};
}

test('a estante normal não ativa as miniaturas', async () => {
  const calls = [];
  const {buttons} = start('', book => calls.push(book.id));
  await nextFrame();
  assert.deepEqual(calls, []);
  assert.ok(buttons.every(button => button.dataset.shelfPreview === undefined));
});

test('a prévia escolhe apenas os dois livros e preserva a capa, o título e o marcador', async () => {
  const {buttons, window, document} = start('?previa=estante-3d');
  const originalChildren = buttons.map(button => [...button.children]);
  await nextFrame();
  assert.deepEqual(buttons.map(button => button.dataset.shelfPreview), ['css', 'css', undefined]);
  const calls = [];
  window.Aurora3D = {renderShelfPreview(book, pose) { calls.push({book, pose}); return book.cover; }};
  window.dispatchEvent(new Event('aurora:3d-ready'));
  await nextFrame();
  assert.deepEqual(calls.map(call => call.book.id), ['envelope', 'jane']);
  assert.equal(calls[1].book.spine, 'lombada-original');
  assert.equal(calls[0].pose.roll, 0);
  assert.notEqual(calls[1].pose.roll, 0);
  assert.notEqual(calls[0].pose.yaw, calls[1].pose.yaw);
  assert.deepEqual(buttons.map(button => button.dataset.shelfPreview), ['ready', 'ready', undefined]);
  for (const [i, button] of buttons.entries()) {
    originalChildren[i].forEach((child, j) => assert.equal(button.children[j], child));
  }
  document.dispatchEvent(new Event('aurora:library-data'));
  await nextFrame();
  assert.equal(calls.length, 2);
  assert.deepEqual(buttons.map(button => button.children.length), [4, 4, 3]);
});

test('descarta a imagem antiga se a capa mudar durante a renderização', async () => {
  let finish;
  const {buttons, document} = start('?previa=estante-3d', book => {
    if (book.id === 'envelope' && !finish) return new Promise(resolve => { finish = resolve; });
    return 'miniatura-atual';
  });
  const [button] = buttons;
  button.children[0] = {src:'capa-recuperada'};
  document.dispatchEvent(new Event('aurora:book-cover-updated'));
  finish('miniatura-antiga');
  await nextFrame();
  const images = button.children.filter(child => child.className === 'shelf-3d-preview-image');
  assert.deepEqual(images.map(image => image.src), ['miniatura-atual']);
});
