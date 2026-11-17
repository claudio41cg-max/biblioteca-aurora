import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shelf=read('aurora-estante.js');
const catalog=read('aurora-catalogos.js');
const css=read('aurora-catalogos.css');
const html=read('index.html');
const sw=read('sw.js');

assert.match(shelf,/categories\.forEach\(\(category,index\)\s*=>/);
assert.match(shelf,/catalogButton\.dataset\.catalogCategory=category\.id/);
assert.match(shelf,/window\.AuroraCatalogos\?\.open\(category\.id\)/);
assert.match(shelf,/catalogButton\.textContent='Catálogos'/);
assert.doesNotMatch(shelf,/shelf-preview-toggle|Ver original/);
assert.match(catalog,/\$\('shelf-'\+category\)/);
assert.match(catalog,/row\.querySelectorAll\('\.book-spine'\)/);
assert.match(catalog,/getAttribute\('src'\)\|\|generatedCover/);
assert.match(catalog,/window\.AuroraFormats\?\.createDigitalCover/);
assert.match(catalog,/card\.addEventListener\('click',event=>\{/);
assert.match(catalog,/button\.click\(\)/,'As capas abrem exatamente o livro 3D da estante');
assert.match(catalog,/MutationObserver/);
assert.match(catalog,/subtree:true,childList:true/);
assert.match(catalog,/const PAGE_SIZE=9/);
assert.match(catalog,/visible\+=PAGE_SIZE/);
assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css,/#library \.section-title::after\{display:none\}/);
assert.match(html,/id="auroraCatalogOverlay"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html,/aurora-catalogos\.js\?v=3/);
assert.match(html,/aurora-catalogos\.css\?v=2/);
assert.match(sw,/aurora-v54/);
assert.match(sw,/aurora-catalogos\.js\?v=1/);

console.log('V44/V53: catálogos, capas, volumes físicos e abertura do mesmo livro confirmados.');
