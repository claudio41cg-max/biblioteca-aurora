import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const catalog=read('libria-catalogo.js');
const preview=read('aurora-catalogos.js');
const css=read('aurora-catalogos.css');
const loader=read('aurora-livro-3d-loader.js');
const webgl=read('aurora-livro-3d.mjs');
const sw=read('sw.js');

test('os módulos de catálogo e o carregador 3D mantêm sintaxe válida',()=>{
  for(const source of [catalog,preview,loader])assert.doesNotThrow(()=>new Script(source));
});

test('os cartões 3D de gêneros fora da tela ficam adiados',()=>{
  assert.match(catalog,/deferCards:true/);
  assert.match(catalog,/new IntersectionObserver/);
  assert.match(catalog,/rootMargin:'520px 0px'/);
  assert.match(catalog,/preview\.hydrateHomeSection\?\.\(entry\.target\)/);
  assert.match(catalog,/cardObserver\?\.disconnect\(\)/);
  assert.match(preview,/deferredHomeSections=new WeakMap\(\)/);
  assert.match(preview,/section\.dataset\.cardsPending='true'/);
  assert.match(preview,/function hydrateHomeSection\(section\)/);
  assert.match(preview,/books\.replaceChildren\(\.\.\.cards\)/);
  assert.match(css,/\.libria-home-book-skeleton/);
  assert.match(css,/\.libria-home-skeleton-cover/);
});

test('pesquisa e ordenação reutilizam índice e comparador por livro',()=>{
  assert.match(catalog,/const searchIndex=new WeakMap\(\)/);
  assert.match(catalog,/const collator=new Intl\.Collator\('pt-BR'/);
  assert.match(catalog,/function indexedBook\(button\)/);
  assert.match(catalog,/indexed\.search\.includes\(term\)/);
});

test('o WebGL só é importado ao abrir um livro ou solicitar a prévia 3D',()=>{
  assert.match(html,/aurora-livro-3d-loader\.js\?v=1/);
  assert.doesNotMatch(html,/<script type="module" src="\.\/aurora-livro-3d\.mjs/);
  assert.match(loader,/window\.addEventListener\('aurora:book-selected',load,\{once:true\}\)/);
  assert.match(loader,/import\('\.\/aurora-livro-3d\.mjs\?v=25'\)/);
  assert.match(loader,/previa.*estante-3d/);
  assert.match(sw,/resources\.add\(new URL\('\.\/aurora-livro-3d\.mjs\?v=25'/);
  assert.match(webgl,/pixelRatioLimit/);
  assert.match(webgl,/deviceMemory/);
});

test('a versão PWA e os arquivos de catálogo estão na v132',()=>{
  assert.match(sw,/const CACHE = 'libria-v132'/);
  assert.match(sw,/const HOME = '\.\/index\.html\?v=132'/);
  assert.match(html,/manifest\.webmanifest\?v=132/);
  assert.match(html,/libria-catalogo\.js\?v=8/);
  assert.match(html,/aurora-catalogos\.js\?v=11/);
  assert.match(html,/aurora-catalogos\.css\?v=6/);
});
