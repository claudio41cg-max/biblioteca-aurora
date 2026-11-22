import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const spine=read('aurora-lombadas.js');
const imported=read('aurora-importados.js');
const surfaces=read('aurora-edition-surfaces.js');
const covers=read('aurora-formatos.js');
const html=read('index.html');

assert.match(surfaces,/canvas\.width=32;canvas\.height=144/);
assert.match(surfaces,/ctx\.drawImage\(image,0,0,image\.naturalWidth,image\.naturalHeight/);
assert.doesNotMatch(surfaces,/image\.naturalWidth\*\.12/);
assert.doesNotMatch(spine,/tries<14/);
assert.match(spine,/dataset\.realSpine==='true'/);
assert.match(imported,/recoverQueue/);
assert.match(imported,/stored\.coverCheckedVersion!==book\.coverCheckedVersion/);
assert.match(imported,/if\(epub\.cover\)\{cover=epub\.cover;coverSource='original';\}/);
assert.match(covers,/const palettes=\[/);
assert.match(html,/aurora-lombadas\.js\?v=\d+/);

let image;
const ctx={
  drawImage(value){image=value;},
  getImageData(){
    const data=new Uint8ClampedArray(32*144*4);
    for(let y=0;y<144;y++)for(let x=0;x<32;x++){
      const offset=(y*32+x)*4;
      const color=x<5?[35,35,35]:image.hue==='blue'?[20,85,210]:[220,46,55];
      data.set([...color,255],offset);
    }
    return {data};
  },
  createLinearGradient(){return {addColorStop(){}};},fillRect(){},scale(){},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},
  translate(){},rotate(){},save(){},restore(){},
  measureText(value){return {width:String(value).length*6};},fillText(){}
};
const document={
  getElementById:id=>id==='library'?{querySelectorAll:()=>[]}:null,
  createElement:()=>({getContext:()=>ctx}),
  addEventListener(){}
};
const window={devicePixelRatio:2,addEventListener(){}};
class MutationObserver{observe(){}}
vm.runInNewContext(surfaces,{document,window,console});
vm.runInNewContext(spine,{document,window,MutationObserver,
  requestAnimationFrame:callback=>callback(),console,Uint8ClampedArray});
const api=window.AuroraLombadas;
const color=hue=>api.sampleProfile({hue,naturalWidth:600,naturalHeight:900})[15];
const red=color('red'),blue=color('blue');
assert.ok(red[0]>red[2]*2,'capa vermelha continua vermelha');
assert.ok(blue[2]>blue[0]*3,'capa azul continua azul');
const imageProfile=Array(48).fill(red);
assert.deepEqual(Array.from(api.modelFromProfile(imageProfile).rows[0]),Array.from(red),
  'a legibilidade do título não deve embranquecer a cor da edição');
console.log('V49: cores das capas e recuperação de EPUBs protegidas por testes.');
