import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('meus-livros.html');
const css=read('aurora-reader.css');
const sw=read('sw.js');

for(const id of ['close','title','count','bookmark','readerSettings','readerPrefs','readerPrefsClose',
  'readerZoom','readerZoomValue','readerTextMode','readerTextPrefs','readerFont','readerFontSize',
  'readerLineHeight','pageNumber','goto','scrub','position','viewport','flipbook']){
  assert.match(html,new RegExp(`id="${id}"`),`${id} deve permanecer disponível`);
}
for(const removed of ['minus10','plus10','zoomOut','zoomIn']){
  assert.doesNotMatch(html,new RegExp(`id="${removed}"`),`${removed} não deve poluir a tela`);
}
assert.match(html,/min="100" max="200" step="10"/, 'Zoom deve permitir 100 a 200%');
assert.match(html,/session\.flip = new St\.PageFlip\(host,/,'Preserva o motor físico de páginas');
assert.match(html,/drawShadow:true/,'Preserva a sombra da folha');
assert.match(html,/flippingTime:900/,'Preserva o tempo da virada');
assert.match(html,/getTextContent\(\)/,'Modo texto deve extrair conteúdo do PDF');
assert.match(html,/active\.zoom===1\|\|active\.textMode/,'O zoom do texto não bloqueia o gesto de folhear');
assert.match(html,/active\.flip\.flipNext\('bottom'\)/,'O PDF ampliado deve poder virar folhas para frente');
assert.match(html,/active\.flip\.flipPrev\('bottom'\)/,'O PDF ampliado deve poder virar folhas para trás');
assert.match(html,/persistProgress\(active\)/,'Marcador continua salvando progresso');
assert.match(html,/aurora-reader\.css\?v=3/);
assert.match(css,/\.reader-prefs\[hidden\]/);
assert.match(css,/\.reader\.zoomed \.viewport/);
assert.match(css,/\.reader \.(?:page|pdf-readable-text)/);
assert.match(sw,/\.\/aurora-reader\.css\?v=3/);
assert.match(read('manifest.webmanifest'),/index\.html\?v=22/);
for(const font of ['serif','sans','times','palatino','handwritten','mono']){
  assert.match(html,new RegExp(`<option value="${font}"`),`A fonte ${font} deve estar disponível`);
}
const embedded=[...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match=>match[1]).filter(Boolean);
for(const code of embedded)new Function(code);
console.log('Leitor: controles, zoom, motor de folheio e opções de texto validados.');
