import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const webgl=read('aurora-livro-3d.mjs');
const cover=read('aurora-edition-surfaces.js');
const css=read('aurora-sala-3d.css');
const shelf=read('aurora-estante-realista.css');
const shelfJs=read('aurora-estante.js');
const html=read('index.html');
const sw=read('sw.js');

assert.match(webgl,/edgeCanvas\('vertical'\)/);
assert.match(webgl,/edgeCanvas\('horizontal'\)/);
assert.match(webgl,/ctx\.fillRect\(i,0,1,512\)/);
assert.match(webgl,/topPageMaterial,topPageMaterial/);
assert.match(css,/drop-shadow\(12px 19px 13px/);
assert.match(shelf,/--premium-yaw/);
assert.match(shelfJs,/--premium-lean/);
assert.match(html,/aurora-livro-3d\.mjs\?v=6/);
assert.match(html,/aurora-edition-surfaces\.js\?v=3/);
assert.match(sw,/aurora-v45/);

// Testa também a geração real do verso, sem depender de um PDF no aparelho.
const calls=[];
const ctx={
  fillRect(...args){calls.push(['rect',...args]);},
  drawImage(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
  fillText(value){calls.push(['text',value]);},strokeText(){},save(){},restore(){},
  translate(){},rotate(){},
  measureText(value){return {width:value.length*13};},
  getImageData(){
    const data=new Uint8ClampedArray(48*48*4);
    for(let i=0;i<data.length;i+=4){data[i]=107;data[i+1]=88;data[i+2]=123;data[i+3]=255;}
    return {data};
  },
  createLinearGradient(){return {addColorStop(){}};}
};
const windowStub={addEventListener(){},AuroraBookInfo:{find:()=>({author:'Autora Exemplo',description:'Sinopse informada pela edição.'})}};
const documentStub={createElement:()=>({getContext:()=>ctx}),getElementById:()=>null};
vm.runInNewContext(cover,{window:windowStub,document:documentStub,console});
const source={naturalWidth:600,naturalHeight:900};
const generated=windowStub.AuroraEditionSurfaces.generate(source,{name:'Uma História',author:'Autora Exemplo'});
assert.ok(generated.back,'sem contracapa, criar superfície ilustrativa');
assert.ok(generated.spine,'sem lombada, gerar lombada coerente');
assert.ok(calls.some(([kind,value])=>kind==='text'&&value==='BIBLIOTECA AURORA'));
assert.ok(calls.some(([kind,value])=>kind==='text'&&value.includes('Sinopse')));
assert.equal(windowStub.AuroraEditionSurfaces.generate(source,{name:'Uma História',back:'capa-traseira.jpg',spine:'lombada.jpg'}).back,null,
  'foto real do verso nunca deve ser substituída pelo verso ilustrativo');
assert.doesNotMatch(cover,/ISBN\s*[:0-9]/,'não inventar número editorial');

console.log('V43: verso ilustrativo preserva verso real; corte vertical e iluminação mais suave.');
