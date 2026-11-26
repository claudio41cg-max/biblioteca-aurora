import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const css=read('libria-book.css');
const catalog=read('libria-catalogo.js');
const onboarding=read('libria-onboarding.js');
const shelves=read('aurora-minhas-estantes.js');
const shelfCore=read('aurora-estante.js');
const pdfImport=read('aurora-pdf-import.js');
const epubAudioImport=read('aurora-novos-formatos.js');
const txt=shelfCore;
const pdf=read('aurora-pdf-import.js');
const formats=read('aurora-novos-formatos.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
const sw=read('sw.js');
const settings=read('configuracoes.html');

test('scripts novos do protótipo têm sintaxe JavaScript válida',()=>{
  assert.doesNotThrow(()=>new Script(catalog));
  assert.doesNotThrow(()=>new Script(onboarding));
  assert.doesNotThrow(()=>new Script(shelves));
  assert.doesNotThrow(()=>new Script(shelfCore));
  assert.doesNotThrow(()=>new Script(pdfImport));
  assert.doesNotThrow(()=>new Script(epubAudioImport));
});

test('a identidade LIBRIA - BOOK está no cabeçalho e no PWA',()=>{
  assert.ok(html.includes('<span>LIBRIA</span><span class="libria-brand-book"> - BOOK</span>'));
  assert.equal(manifest.name,'LIBRIA - BOOK');
  assert.equal(manifest.short_name,'LIBRIA');
  assert.ok(html.includes('apple-mobile-web-app-title" content="LIBRIA - BOOK"'));
  assert.ok(settings.includes('Configurações • LIBRIA - BOOK'));
});

test('o menu concentra busca, conexão por link, leituras e configurações',()=>{
  assert.ok(html.includes('id="libriaMenuToggle"'));
  assert.ok(html.includes('id="libriaAppMenu"'));
  assert.ok(html.includes('href="./explorar-livros.html">⌕ <span>Buscar livros</span>'));
  assert.ok(html.includes('Conectar catálogo por link'));
  assert.ok(html.includes('id="statsButton"'));
  assert.ok(html.includes('href="./configuracoes.html">⚙ <span>Configurações</span>'));
  assert.equal(html.includes('class="library-tools"'),false);
  assert.ok(html.includes('id="arrangeButton"')&&html.includes('libria-legacy-controls" hidden'));
  assert.ok(html.includes('id="roomButton"')&&html.includes('libria-legacy-controls" hidden'));
});

test('o catálogo geral é único e pode ser aberto pela home e por cada estante',()=>{
  assert.ok(html.includes('id="openCatalogButton"'));
  assert.ok(html.includes('id="shelfCatalogButton"'));
  assert.ok(html.includes('id="libriaCatalogHome"'));
  assert.ok(catalog.includes("$('openCatalogButton')?.addEventListener('click',open)"));
  assert.ok(catalog.includes("$('shelfCatalogButton')?.addEventListener('click',open)"));
  assert.ok(catalog.includes('window.AuroraCatalogos?.open(category)'));
  assert.ok(catalog.includes('window.AuroraShelf.categories'));
  assert.ok(html.includes('class="library libria-catalog-source"'));
  assert.ok(css.includes('.libria-catalog-source'));
});

test('a primeira estante é vazia, editável e usa o mesmo editor das demais',()=>{
  assert.ok(shelves.includes("DEFAULT_SHELF_ID = 'libria-estante-principal-v1'"));
  assert.ok(shelves.includes("name:'Minha primeira estante'"));
  assert.ok(shelves.includes('sections:1,objects:[]'));
  assert.ok(shelves.includes('window.AuroraEstanteExemplares.render(shelf, scene)'));
  assert.ok(shelves.includes("edit.href = './nova-estante.html?id=' + encodeURIComponent(shelf.id)"));
  assert.ok(shelves.includes("byId('library').hidden = false"));
  assert.ok(shelves.includes("byId('personalShelf').hidden = addBook.hidden = edit.hidden = false"));
});

test('a configuração inicial é simples, local e não interrompe acervos antigos',()=>{
  assert.ok(html.includes('id="libriaWelcome"'));
  assert.ok(onboarding.includes("PROFILE_KEY='libria-profile-v1'"));
  assert.ok(onboarding.includes("country:country.value,language:language.value,setupComplete:true"));
  assert.ok(onboarding.includes("localStorage.getItem('aurora-estantes-personalizadas-v1')"));
  assert.ok(onboarding.includes("localStorage.getItem('aurora-books')"));
  assert.ok(onboarding.includes('migratedFromLegacy:true'));
  assert.ok(settings.includes('id="profileCountry"'));
  assert.ok(settings.includes('id="profileLanguage"'));
});

test('importações entram no catálogo e não abrem automaticamente a leitura',()=>{
  assert.ok(pdf.includes("location.href='./index.html?catalogo=1&importado='+encodeURIComponent(id)"));
  assert.ok(formats.includes("location.href='./index.html?catalogo=1&importado='+encodeURIComponent(book.id)"));
  assert.ok(txt.includes("if(duplicate)duplicate.replaceWith(button);else row?.append(button)"));
  assert.ok(txt.includes("window.LibriaCatalogo?.open()"));
  assert.ok(txt.includes("window.LibriaCatalogo?.open()"));
  assert.equal(txt.includes('draw();\n      toggleMenu(false);'),false);
  assert.ok(catalog.includes("if(params.get('catalogo')==='1')"));
});

test('a versão de cache do protótipo não substitui o aplicativo publicado',()=>{
  assert.equal(sw.includes("const CACHE = 'libria-v118';"),true);
  assert.ok(sw.includes("const HOME = './index.html?v=118';"));
  assert.ok(sw.includes("const EDITOR = './nova-estante.html?v=118';"));
  assert.ok(html.includes('./manifest.webmanifest?v=118'));
});
