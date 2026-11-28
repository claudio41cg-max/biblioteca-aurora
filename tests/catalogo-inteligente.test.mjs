import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const catalog=read('libria-catalogo.js');
const css=read('libria-book.css');
const formats=read('aurora-formatos.js');
const pdf=read('aurora-pdf-import.js');
const epubAudio=read('aurora-novos-formatos.js');
const shelf=read('aurora-estante.js');
const sw=read('sw.js');
const manifest=JSON.parse(read('manifest.webmanifest'));

test('scripts de pesquisa e importação mantêm sintaxe válida',()=>{
  for(const source of [catalog,formats,pdf,epubAudio,shelf])assert.doesNotThrow(()=>new Script(source));
});

test('a pesquisa avançada fica recolhida e não acrescenta botões ao cabeçalho',()=>{
  assert.match(html,/id="libriaHomeSearchWrap" hidden/);
  assert.match(html,/id="libriaGenreSearch"/);
  assert.match(html,/id="libriaFormatFilter"/);
  assert.match(html,/id="libriaSortOrder"/);
  assert.match(catalog,/formatFilter\?\.addEventListener\('change'/);
  assert.match(catalog,/sortOrder\?\.addEventListener\('change'/);
  assert.match(shelf,/button\.dataset\.created/);
  assert.match(css,/\.libria-catalog-filters\{display:grid;grid-template-columns:1fr 1fr/);
});

test('o catálogo filtra por formato e ordena por título, autor ou data',()=>{
  assert.match(catalog,/if\(format&&source!==format\)continue/);
  assert.match(catalog,/order==='recent'/);
  assert.match(catalog,/order==='author'/);
  assert.match(catalog,/new Intl\.Collator\('pt-BR'/);
  assert.match(shelf,/created:Number\(book\.created\)\|\|0/);
  assert.match(shelf,/button\.dataset\.created=String\(Number\(item\.created\|\|item\.addedAt\)\|\|0\)/);
});

test('identificação de duplicados compara assinatura do arquivo e metadados',()=>{
  assert.ok(formats.includes("window.crypto.subtle.digest('SHA-256',bytes)"));
  assert.match(formats,/item\.fingerprint===fingerprint/);
  assert.match(formats,/normalizeDuplicate\(item\.name\)!==titleKey/);
  assert.match(formats,/kind:'exact'/);
  assert.match(formats,/kind:'possible'/);
  assert.match(formats,/inspectDuplicate/);
  assert.match(pdf,/inspectDuplicate/);
  assert.match(epubAudio,/inspectDuplicate/);
  assert.match(pdf,/window\.confirm\(/);
  assert.match(epubAudio,/window\.confirm\(/);
});

test('duplicado exato é bloqueado sem apagar o registro existente',()=>{
  assert.match(pdf,/Este mesmo arquivo já está no catálogo/);
  assert.match(epubAudio,/Este mesmo arquivo já está no catálogo/);
  assert.match(pdf,/if\(!id\)return/);
  assert.match(epubAudio,/if\(!book\)return/);
  assert.match(shelf,/Object\.entries\(saved\)\.find\(\(\[,value\]\)=>value===content\)/);
  assert.match(shelf,/Este conteúdo já está no catálogo/);
  assert.doesNotMatch(formats,/objectStore\(['"]books['"]\)\.clear\(/);
});

test('a versão PWA e os arquivos principais estão atualizados para v129',()=>{
  assert.match(sw,/const CACHE = 'libria-v129'/);
  assert.match(sw,/const HOME = '\.\/index\.html\?v=129'/);
  assert.equal(manifest.start_url,'./index.html?v=129');
  assert.match(html,/libria-catalogo\.js\?v=7/);
  assert.match(html,/aurora-formatos\.js\?v=12/);
});
