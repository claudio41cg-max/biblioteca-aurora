import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=readFileSync(new URL('../aurora-catalogos.js',import.meta.url),'utf8');

function classify(dataset,backgroundImage='url(spine.webp)'){
  const window={};
  const document={getElementById:()=>null};
  runInNewContext(source,{window,document,console});
  return window.AuroraCatalogSpineInfo({
    dataset,
    style:{backgroundImage}
  });
}

test('arte marcada como lombada original mantém prioridade',()=>{
  const result=classify({realSpine:'true',spineCrisp:'true'});
  assert.equal(result.kind,'original');
  assert.equal(result.label,'Lombada original');
  assert.equal(result.useRenderedImage,true);
});

test('lombada nítida reconstruída usa a textura, mas não é identificada como original',()=>{
  const result=classify({coverDerived:'true',spineCrisp:'true'});
  assert.equal(result.kind,'reconstructed');
  assert.equal(result.label,'Lombada reconstruída');
  assert.equal(result.useRenderedImage,true);
  assert.match(result.description,/não é a lombada original/);
});

test('capa usada como aproximação não é tratada como lombada original',()=>{
  const result=classify({coverDerived:'true'});
  assert.equal(result.kind,'cover-fallback');
  assert.equal(result.label,'Aproximação da capa');
  assert.equal(result.useRenderedImage,false);
  assert.match(result.description,/não é a lombada original/);
});

test('marcador de textura sem origem de capa não é promovido a lombada reconstruída',()=>{
  const result=classify({spineCrisp:'true'});
  assert.equal(result.kind,'unavailable');
  assert.equal(result.label,'Sem lombada original');
  assert.equal(result.useRenderedImage,false);
});

test('ausência de arte original é identificada explicitamente',()=>{
  const result=classify({});
  assert.equal(result.kind,'unavailable');
  assert.equal(result.label,'Sem lombada original');
  assert.equal(result.useRenderedImage,false);
});

test('o catálogo atualiza textura e identificação sem reconstruir o cartão durante o giro',()=>{
  assert.match(source,/holder\.__auroraUpdateSpine=updateSpineArt/);
  assert.match(source,/card\.__auroraSourceBook=button/);
  assert.match(source,/card\.__auroraRefreshSpine=\(\)=>/);
  assert.match(source,/changed\.has\(card\.__auroraSourceBook\)/);
  assert.match(source,/attributeFilter:\['data-real-spine','data-spine-crisp','data-cover-derived'\]/);
  assert.match(source,/new MutationObserver\(\(\)=>\{if\(current&&!overlay\.hidden\)render\(\);\}\)/);
});

test('service worker abre a v131 e guarda os recursos do catálogo',()=>{
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.ok(sw.includes("const CACHE = 'libria-v132';"));
  assert.ok(sw.includes("const HOME = './index.html?v=132';"));
  assert.ok(sw.includes("const EDITOR = './nova-estante.html?v=132';"));
  assert.match(sw,/html\.matchAll/);
  assert.doesNotMatch(sw,/indexedDB\.deleteDatabase|localStorage\.clear\(/);
});
