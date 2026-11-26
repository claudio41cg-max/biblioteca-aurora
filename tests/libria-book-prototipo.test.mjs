import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const css=read('libria-book.css');
const catalog=read('libria-catalogo.js');
const onboarding=read('libria-onboarding.js');
const shelves=read('aurora-minhas-estantes.js');
const shelfEditor=read('aurora-nova-estante.js');
const shelfPicker=read('aurora-estante-exemplares.js');
const shelfEditorHtml=read('nova-estante.html');
const shelfCore=read('aurora-estante.js');
const pdfImport=read('aurora-pdf-import.js');
const epubAudioImport=read('aurora-novos-formatos.js');
const txt=shelfCore;
const pdf=read('aurora-pdf-import.js');
const formats=read('aurora-novos-formatos.js');
const onlineSearch=read('aurora-online.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
const sw=read('sw.js');
const settings=read('configuracoes.html');

test('scripts novos do protótipo têm sintaxe JavaScript válida',()=>{
  assert.doesNotThrow(()=>new Script(catalog));
  assert.doesNotThrow(()=>new Script(onboarding));
  assert.doesNotThrow(()=>new Script(shelves));
  assert.doesNotThrow(()=>new Script(shelfEditor));
  assert.doesNotThrow(()=>new Script(shelfPicker));
  assert.doesNotThrow(()=>new Script(shelfCore));
  assert.doesNotThrow(()=>new Script(pdfImport));
  assert.doesNotThrow(()=>new Script(epubAudioImport));
  assert.doesNotThrow(()=>new Script(onlineSearch));
});

test('a identidade LIBRIA - BOOK está no cabeçalho e no PWA',()=>{
  assert.ok(html.includes('<span>LIBRIA</span><span class="libria-brand-book"> - BOOK</span>'));
  assert.equal(manifest.name,'LIBRIA - BOOK');
  assert.equal(manifest.short_name,'LIBRIA');
  assert.ok(html.includes('apple-mobile-web-app-title" content="LIBRIA - BOOK"'));
  assert.ok(settings.includes('Configurações • LIBRIA - BOOK'));
});

test('o menu principal fica limpo e os controles antigos permanecem ocultos',()=>{
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
  assert.ok(catalog.includes("$('openCatalogButton')?.addEventListener('click',()=>goCatalog())"));
  assert.ok(catalog.includes("$('shelfCatalogButton')?.addEventListener('click',()=>window.AuroraEstanteExemplares?.openPicker())"));
  assert.ok(catalog.includes('window.AuroraCatalogPreview?.homeCardFor(button)'));
  assert.ok(html.includes('id="libriaGoShelves"'));
  assert.match(css,/\.libria-home-books\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.ok(html.indexOf('id="libriaGenreGrid"')<html.indexOf('id="libriaGoShelves"'));
  assert.ok(!html.includes('id="libriaCatalogClose"'));
  assert.ok(catalog.includes('window.AuroraShelf.categories'));
  assert.ok(html.includes('class="library libria-catalog-source"'));
  assert.ok(css.includes('.libria-catalog-source'));
});

test('a primeira estante é vazia, editável e usa o mesmo editor das demais',()=>{
  assert.ok(shelves.includes("DEFAULT_SHELF_ID = 'libria-estante-principal-v2'"));
  assert.ok(shelves.includes("LEGACY_DEFAULT_SHELF_ID = 'libria-estante-principal-v1'"));
  assert.ok(shelves.includes("name:'Minha estante',genre:''"));
  assert.ok(shelves.includes('sections:1,objects:[]'));
  assert.ok(shelves.includes('shelf.id !== LEGACY_DEFAULT_SHELF_ID'));
  assert.ok(shelfEditor.includes("const DEFAULT_SHELF_ID='libria-estante-principal-v2'"));
  assert.ok(shelfEditorHtml.includes('id="shelfGenreInput"'));
  assert.ok(shelfEditor.includes("genreInput.replaceChildren"));
  assert.ok(shelfEditor.includes("if(!state.name?.trim()||!state.genre)"));
  assert.ok(shelfPicker.includes('active.genre && book.category === active.genre'));
  assert.equal(shelfPicker.includes("choose('Gênero','category')"),false);
  assert.equal(shelfPicker.includes('picker.category'),false);
  assert.ok(shelves.includes('window.AuroraEstanteExemplares.render(shelf, scene)'));
  assert.ok(shelves.includes("edit.href = './nova-estante.html?id=' + encodeURIComponent(shelf.id)"));
  assert.ok(shelves.includes("byId('library').hidden = false"));
  assert.ok(shelves.includes("byId('personalShelf').hidden = edit.hidden = false"));
  assert.ok(shelves.includes('addBook.hidden = true'));
});

test('cada estante abre o catálogo geral filtrado pelo gênero e permite adicionar ou retirar',()=>{
  assert.ok(catalog.includes("$('shelfCatalogButton')?.addEventListener('click',()=>window.AuroraEstanteExemplares?.openPicker())"));
  assert.ok(shelfPicker.includes('active.genre && book.category === active.genre'));
  assert.ok(shelfPicker.includes("element('h2','','Catálogo da estante')"));
  assert.ok(shelfPicker.includes("placed?'Retirar':'Adicionar'"));
  assert.ok(shelfPicker.includes('O catálogo geral continua completo. Aqui aparecem apenas livros do gênero desta estante.'));
});

test('toda importação exige gênero e a busca online não classifica automaticamente',()=>{
  assert.ok(html.includes('<select id="importCategory" required>'));
  assert.ok(html.includes('<option value="" selected disabled>Selecione o gênero...</option>'));
  assert.ok(pdfImport.includes('if(!category.value)'));
  assert.ok(epubAudioImport.includes('if(!category.value)'));
  assert.ok(shelfCore.includes('if(!importCategory.value)'));
  assert.ok(onlineSearch.includes('Gênero no catálogo: '));
  assert.ok(onlineSearch.includes('＋ Adicionar ao catálogo'));
  assert.ok(onlineSearch.includes('if(!selector.value)'));
  assert.ok(onlineSearch.includes('O arquivo não foi baixado para o aparelho.'));
  assert.equal(onlineSearch.includes('selector.value=category(item.title,item.author)'),false);
  assert.ok(onlineSearch.includes("['filmes','Filmes inspirado em livros']"));
  assert.ok(onlineSearch.includes("['veterinaria','Medicina Veterinária']"));
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
  assert.equal(sw.includes("const CACHE = 'libria-v123';"),true);
  assert.ok(sw.includes("const HOME = './index.html?v=123';"));
  assert.ok(sw.includes("const EDITOR = './nova-estante.html?v=123';"));
  assert.ok(html.includes('./manifest.webmanifest?v=123'));
});

test('a tela inicial mostra livros reais do acervo, filtra e navega para as estantes',()=>{
  class Node {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.hidden=false;this.value='';this.textContent='';}
    append(...items){this.children.push(...items);}
    replaceChildren(...items){this.children=[...items];}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
    fire(k,target=this){for(const fn of this.listeners[k]||[])fn({target,key:''});}
    closest(){return this;}
    contains(node){return this.children.includes(node)||node===this;}
    querySelectorAll(){return this.children;}
    querySelector(){return null;}
    focus(){}
  }
  const ids=Object.fromEntries(['libriaCatalogHome','libriaGenreGrid','libriaHomeBooks','libriaGenreSearch','libriaHomeSearchWrap','libriaSearchToggle','libriaCatalogMore','libriaCatalogTotal','libriaCatalogHeading','libriaAppMenu','libriaMenuToggle','openCatalogButton','libriaGoShelves','shelfCatalogButton','shelf-romance','shelf-ficcao','library'].map(id=>[id,new Node()]));
  ids.libriaAppMenu.hidden=true;
  ids.libriaHomeSearchWrap.hidden=true;
  const book=(title,author,source,id)=>{const n=new Node('button');n.dataset={rawTitle:title,author,source,bookId:id};return n;};
  ids['shelf-romance'].append(book('Razão e Sensibilidade','Jane Austen','pdf','a'),book('Noite de amor','Autora','epub','b'));
  ids['shelf-ficcao'].append(book('A Máquina do Tempo','H. G. Wells','epub','c'),book('A Máquina do Tempo','H. G. Wells','epub','c'));
  const classes=new Set(),doc=new Node();
  doc.getElementById=id=>ids[id]||null;
  doc.createElement=tag=>new Node(tag);
  doc.body={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
  const location={href:'https://example.com/app/index.html'};
  const history={pushState:(_s,_t,url)=>{location.href=String(url);},replaceState:(_s,_t,url)=>{location.href=String(url);},state:null};
  let refreshed=0,picked=0;
  const window=new Node();
  window.AuroraShelf={categories:[{id:'romance',name:'Romances'},{id:'ficcao',name:'Ficção'}]};
  window.AuroraCatalogPreview={homeCardFor:button=>{const n=new Node('button');n.textContent=button.dataset.rawTitle;return n;}};
  window.AuroraMinhasEstantes={refresh:()=>refreshed++};
  window.AuroraEstanteExemplares={layout(){},openPicker:()=>picked++};
  window.scrollTo=()=>{};
  runInNewContext(catalog,{document:doc,window,location,history,URL,URLSearchParams,requestAnimationFrame:fn=>{fn();return 0;},console});
  assert.equal(ids.libriaCatalogHome.hidden,false);
  assert.equal(ids.libriaHomeBooks.children.length,3);
  assert.equal(ids.libriaCatalogTotal.textContent,'3 livros');
  assert.equal(ids.libriaGenreGrid.children[0].textContent,'Todos');
  ids.libriaGenreGrid.fire('click',ids.libriaGenreGrid.children[1]);
  assert.deepEqual(ids.libriaHomeBooks.children.map(n=>n.textContent),['Razão e Sensibilidade','Noite de amor']);
  ids.libriaGenreSearch.value='razao';ids.libriaGenreSearch.fire('input');
  assert.equal(ids.libriaCatalogTotal.textContent,'1 livro');
  assert.equal(ids.libriaHomeBooks.children[0].textContent,'Razão e Sensibilidade');
  ids.libriaGoShelves.fire('click');
  assert.equal(new URL(location.href).searchParams.get('estantes'),'1');
  assert.equal(ids.libriaCatalogHome.hidden,true);
  assert.equal(classes.has('libria-catalog-view'),false);
  assert.equal(refreshed,1);
  ids.shelfCatalogButton.fire('click');assert.equal(picked,1);
  ids.openCatalogButton.fire('click');
  assert.equal(ids.libriaCatalogHome.hidden,false);
  assert.equal(new URL(location.href).searchParams.has('estantes'),false);
  assert.equal(ids.libriaCatalogTotal.textContent,'1 livro');
  window.LibriaCatalogo.open();
  assert.equal(ids.libriaCatalogTotal.textContent,'3 livros');
  ids['shelf-romance'].append(book('Livro novo','Autor','pdf','new'));
  doc.fire('aurora:library-data');
  assert.equal(ids.libriaCatalogTotal.textContent,'4 livros');
});
