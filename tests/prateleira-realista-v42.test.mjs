import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const js=read('aurora-estante.js');
const css=read('aurora-estante-realista.css');

assert.match(html,/aurora-estante-realista\.css\?v=4/);
assert.match(html,/aurora-estante\.js\?v=16/);
assert.match(js,/section\.classList\.add\('shelf-premium'\)/);
assert.match(js,/aurora-catalog-trigger/);
assert.doesNotMatch(js,/Ver original|Ver realista|shelf-preview-toggle/);
assert.match(js,/--premium-height/);
assert.match(js,/--premium-width/);
assert.match(js,/window\.AuroraShelfViewer\.open\(button/);
assert.match(js,/const image=document\.createElement\('img'\)/);
assert.match(js,/image\.src=item\.cover/);
assert.match(css,/\.category\.shelf-premium \.cabinet/);
assert.match(css,/\.category\.shelf-premium \.book-spine/);
assert.match(css,/\.shelf-book-cover img/);
assert.match(css,/prefers-reduced-motion/);
assert.doesNotMatch(css,/#category-romance\.shelf-premium/,
  'A aparência premium deve valer para qualquer categoria');
assert.match(read('sw.js'),/aurora-v48/);

console.log('V48: todas as prateleiras receberam o acabamento realista; capas e 3D preservados.');
