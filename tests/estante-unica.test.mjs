import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=read('index.html');
const viewer=read('meus-livros.html');
assert.match(main,/<label for="pdfFile" class="import-option"/);
assert.match(main,/id="pdfImportStatus"/);
assert.match(main,/class="back-to-shelf"/);
assert.match(main,/id="arrangeBack"/);
assert.doesNotMatch(main,/id="pdfLink"[^>]*href=/);
assert.match(viewer,/location\.replace\('\.\/index\.html\?v=18'\)/);
assert.match(viewer,/recoverOriginalBack\(id\)/);
assert.match(viewer,/aurora-edition-surfaces\.js\?v=1/);
assert.match(read('aurora-importados.js'),/AuroraShelfViewer\.open/);
assert.match(read('index.html'),/id="auroraShowcase"/);
assert.match(read('aurora-sala-3d.js'),/aurora:book-ready/);
assert.match(read('aurora-sala-3d.js'),/session\.motion=scene\.animate/);
assert.doesNotMatch(read('aurora-sala-3d.js'),/cloneNode\(/);
assert.match(main,/id="deleteBook"[^>]*disabled/);
assert.match(main,/class="arrange-actions"/);
assert.doesNotMatch(main,/Guardar em:/);
assert.match(read('aurora-avancado.js'),/confirm\(message\)/);
assert.match(read('aurora-avancado.js'),/objectStore\('books'\)\.delete\(id\)/);
assert.match(read('aurora-avancado.js'),/objectStore\('progress'\)\.delete\(id\)/);
assert.match(read('aurora-estante.js'),/aurora-hidden-books/);
assert.match(read('aurora-vitrine.css'),/\.showhead\{/);
assert.match(read('aurora-vitrine.css'),/flex-wrap:nowrap/);
assert.match(viewer,/routeParams\.get\('open'\)==='1'/);
assert.match(read('aurora-livro-3d.mjs'),/matchEditionSurfaces/);
assert.match(read('aurora-edition-surfaces.js'),/if\(!book\.back\)/);
const embedded=[...viewer.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match=>match[1]).filter(Boolean);
for(const code of embedded)new Function(code);

const ctx={window:{pdfjsLib:{OPS:{paintImageXObject:85,paintInlineImageXObject:86}}}};
vm.runInNewContext(read('aurora-pdf-covers.js'),ctx);
const extract=ctx.window.AuroraPDFCovers.extractBack;
const fakePage=(text,image=true)=>({
  getTextContent:async()=>({items:[{str:text}]}),
  getOperatorList:async()=>({fnArray:image?[85]:[42]}),
  getViewport:()=>({width:700,height:1000})
});
const long='Era uma vez '.repeat(150);
function fakePDF(pages){return {numPages:pages.length,getPage:async n=>pages[n-1]};}
const realBack=fakePDF([fakePage('Capa'),fakePage(long),fakePage('Conheça esta edição',true)]);
assert.equal(await extract(realBack,async(_pdf,n)=>'BACK-PAGE-'+n),'BACK-PAGE-3');
const novelEnd=fakePDF([fakePage('Capa'),fakePage(long),fakePage(long)]);
assert.equal(await extract(novelEnd,async()=>'bad'),'');
const scanned=fakePDF([fakePage(''),fakePage(''),fakePage(''),fakePage('')]);
assert.equal(await extract(scanned,async()=>'bad'),'');
const noImage=fakePDF([fakePage('Capa'),fakePage(long),fakePage('Contracapa',false)]);
assert.equal(await extract(noImage,async()=>'bad'),'');
console.log('Entrada única, scripts e critérios de contracapa validados.');
