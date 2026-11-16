import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const js=read('aurora-estante.js');
const css=read('aurora-estante-realista.css');

assert.match(html,/aurora-estante-realista\.css\?v=3/);
assert.match(html,/aurora-estante\.js\?v=15/);
assert.match(js,/category\.id==='romance'\)section\.classList\.add\('shelf-premium'\)/);
assert.match(js,/aurora-catalog-trigger/);
assert.doesNotMatch(js,/Ver original|Ver realista|shelf-preview-toggle/);
assert.match(js,/--premium-height/);
assert.match(js,/--premium-width/);
assert.match(js,/window\.AuroraShelfViewer\.open\(button/);
assert.match(js,/const image=document\.createElement\('img'\)/);
assert.match(js,/image\.src=item\.cover/);
assert.match(css,/#category-romance\.shelf-premium \.cabinet/);
assert.match(css,/#category-romance\.shelf-premium \.book-spine/);
assert.match(css,/\.shelf-book-cover img/);
assert.match(css,/prefers-reduced-motion/);
assert.doesNotMatch(css,/#category-(?:adulto|ficcao|brasileiros)\.shelf-premium/,
  'O protótipo não deve mudar as outras prateleiras');
assert.match(read('sw.js'),/aurora-v47/);

console.log('V44: primeira prateleira realista preservada, catálogo substitui comparação e 3D permanece.');
