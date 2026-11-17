import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const webgl=read('aurora-livro-3d.mjs');
const surfaces=read('aurora-edition-surfaces.js');
const html=read('index.html');
const worker=read('sw.js');

assert.match(webgl,/THREE\.NeutralToneMapping/,'cores neutras e fiéis à capa');
assert.match(webgl,/PMREMGenerator/,'reflexos suaves de estúdio');
assert.match(webgl,/makeContactShadow/,'sombra de contato atrás do volume');
assert.match(webgl,/deviceMemory/,'reflexos opcionais em aparelhos de pouca memória');
assert.match(webgl,/prefers-reduced-motion/,'respeita movimento reduzido');
assert.match(webgl,/startInertia/,'livro responde ao arraste com inércia');
assert.match(webgl,/velocityY\*elapsed/,'inércia independente dos quadros por segundo');
assert.match(webgl,/clamp\(\(rotation\.y-previous\)\/elapsed,-\.008,\.008\)/,
  'velocidade limitada para não provocar giro descontrolado');
assert.match(webgl,/img\.crossOrigin='anonymous'/,'capas remotas respeitam CORS no WebGL');
assert.doesNotMatch(webgl,/attempt\(false\)/,'não tenta enviar imagens remotas sem CORS à GPU');
assert.match(html,/aurora-edition-surfaces\.js\?v=4/);
assert.match(html,/aurora-livro-3d\.mjs\?v=7/);
assert.match(worker,/aurora-v48/);
assert.match(worker,/index\.html\?v=46/);

function fakeContext(){
  return {
    createLinearGradient(){return {addColorStop(){}};},
    getImageData(){return {data:new Uint8ClampedArray(48*48*4).fill(130)};},
    measureText(value){return {width:String(value).length*12};},
    drawImage(){},fillRect(){},strokeRect(){},scale(){},save(){},restore(){},
    fillText(){},strokeText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
    translate(){},rotate(){}
  };
}
const document={
  createElement:()=>({width:0,height:0,getContext:()=>fakeContext()}),
  getElementById:()=>null
};
const window={addEventListener(){},AuroraBookInfo:{find:()=>null}};
vm.runInNewContext(surfaces,{document,window,console,Uint8ClampedArray,Math});

const image={naturalWidth:900,naturalHeight:1300};
const generated=window.AuroraEditionSurfaces.generate(image,{name:'Livro de teste',author:'Autora'});
assert.equal(generated.back.width,1024);
assert.equal(generated.back.height,1440);
assert.equal(generated.spine.width,512);
assert.equal(generated.spine.height,1920);

const original=window.AuroraEditionSurfaces.generate(image,{
  name:'Livro de teste',back:'contracapa-original.jpg',spine:'lombada-original.jpg'
});
assert.equal(original.back,null,'não substitui contracapa original por arte gerada');
assert.equal(original.spine,null,'não substitui lombada original por arte gerada');

console.log('V46: cores, reflexos, sombra, inércia segura, nitidez e arte original preservadas.');
