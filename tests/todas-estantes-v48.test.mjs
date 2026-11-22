import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const js=read('aurora-estante.js');
const css=read('aurora-estante-realista.css');
const html=read('index.html');
const lombadas=read('aurora-lombadas.js');

assert.match(js,/categories\.forEach\(\(category,index\)\s*=>/);
assert.match(js,/section\.classList\.add\('shelf-premium'\)/);
assert.doesNotMatch(js,/if\(category\.id==='romance'\)section\.classList\.add\('shelf-premium'\)/);
assert.ok((css.match(/\.category\.shelf-premium/g)||[]).length>=20,
  'o acabamento deve ser aplicado a todas as estantes, inclusive futuras categorias');
assert.doesNotMatch(css,/#category-romance\.shelf-premium/);
assert.match(css,/\.category\.shelf-premium \.book-spine/);
assert.match(css,/\.category\.shelf-premium \.bookrow/);
assert.match(css,/\.category\.shelf-premium \.shelf-book-cover img/);
assert.match(js,/--book-width/);
assert.match(js,/--book-height/);
assert.match(js,/--premium-yaw/);
assert.match(js,/--premium-lean/);
assert.match(js,/item\.spine/,'lombada verdadeira continua prioritária');
assert.match(js,/item\.cover/,'capa verdadeira continua disponível na lateral');
assert.match(js,/item\.source!=='demo'&&Boolean\(item\.cover\|\|item\.spine\)/,
  'outros formatos com capa não devem perder a representação física');
assert.match(lombadas,/dataset\.realSpine==='true'/);
assert.match(html,/aurora-estante-realista\.css\?v=\d+/);
assert.match(html,/aurora-estante\.js\?v=\d+/);
console.log('V48: acabamento para todas as categorias, dimensões e arte reais preservadas.');
