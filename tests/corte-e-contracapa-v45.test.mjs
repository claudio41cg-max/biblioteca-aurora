import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const surfaces=read('aurora-edition-surfaces.js');
const webgl=read('aurora-livro-3d.mjs');
const formats=read('aurora-formatos.js');
const importing=read('aurora-novos-formatos.js');
const existing=read('aurora-importados.js');
const html=read('index.html');
const sw=read('sw.js');

const strokes=[];
const ctx={
  fillRect(...args){strokes.push(args);},
  beginPath(){},moveTo(){},lineTo(){},stroke(){},
  createLinearGradient(){return {addColorStop(){}};}
};
const fakeDocument={
  createElement:()=>({width:0,height:0,getContext:()=>ctx}),
  getElementById:()=>null
};
const fakeWindow={addEventListener(){}};
vm.runInNewContext(surfaces,{document:fakeDocument,window:fakeWindow,console});
const texture=fakeWindow.AuroraEditionSurfaces.paperEdgeCanvas('vertical');
assert.equal(texture.width,256);
assert.equal(texture.height,1024);
assert.ok(strokes.filter(([,y,w,h])=>y===0&&w===1&&h===1024).length>=250,
  'o corte lateral deve ter centenas de fibras verticais finas');
assert.ok(strokes.length>1000,'o papel deve conter pequenas irregularidades além das fibras');
assert.equal(fakeWindow.AuroraEditionSurfaces.paperEdgeCanvas('vertical'),texture,
  'a mesma textura é compartilhada sem reconstruir imagem para cada exemplar');
const top=fakeWindow.AuroraEditionSurfaces.paperEdgeCanvas('horizontal');
assert.equal(top.height,192);
assert.match(webgl,/AuroraEditionSurfaces\?\.paperEdgeCanvas\?\.\(orientation\)/);
assert.match(surfaces,/\.volume-edge/);
assert.match(surfaces,/\.volume-top,\.volume-bottom/);

assert.match(formats,/backMarker/);
assert.match(formats,/contracapa/);
assert.match(formats,/cover,back\}/);
assert.match(importing,/back:details\.back\|\|''/);
assert.match(existing,/recoverEpubBack\(book\)/);
assert.match(existing,/book\.backChecked=true/);
assert.match(surfaces,/if\(!book\.back\)/,'o verso real tem prioridade sobre o ilustrativo');
assert.match(html,/aurora-edition-surfaces\.js\?v=3/);
assert.match(html,/aurora-livro-3d\.mjs\?v=6/);
assert.match(html,/aurora-formatos\.js\?v=7/);
assert.match(sw,/aurora-v45/);

console.log('V45: fibras verticais, marcas leves, verso real do EPUB e 3D preservados.');
