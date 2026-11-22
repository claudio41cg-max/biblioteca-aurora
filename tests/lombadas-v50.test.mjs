import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const spine=read('aurora-lombadas.js');
const shelf=read('aurora-estante.js');
const epub=read('aurora-formatos.js');
const imported=read('aurora-importados.js');
const html=read('index.html');

assert.match(shelf,/if\(item\.cover&&item\.source!=='demo'\)button\.dataset\.coverSource/);
assert.match(spine,/function coverDetail\(image\)/);
assert.match(spine,/model\.artwork=coverDetail\(image\)/);
assert.match(spine,/if\(model\.artwork&&!illustrative\)/);
assert.match(spine,/ctx\.drawImage\(model\.artwork,0,0,w,h\)/);
assert.match(spine,/dataset\.realSpine==='true'/);
assert.match(epub,/const refs=nodes\(packageXML,'itemref'\)\.slice\(0,3\)/);
assert.match(epub,/if\(illustrations\.length!==1/);
assert.match(imported,/stored\.coverCheckedVersion!==book\.coverCheckedVersion/);
assert.match(html,/aurora-lombadas\.js\?v=\d+/);

let artDraws=0;
const ctx={
  drawImage(image){if(image?.width===56)artDraws++;},
  getImageData(){
    const data=new Uint8ClampedArray(32*144*4);
    for(let n=0;n<data.length;n+=4)data.set([42,102,170,255],n);
    return {data};
  },
  createLinearGradient(){return {addColorStop(){}};},
  fillRect(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
  fill(){},translate(){},rotate(){},save(){},restore(){},
  measureText(v){return {width:String(v).length*6};},fillText(){}
};
const makeBook=(src,coverSource)=>({
  dataset:{coverDerived:'true',coverSource,rawTitle:'Livro'},
  style:{},offsetWidth:46,offsetHeight:170,isConnected:true,
  title:{textContent:'Livro',style:{}},
  querySelector(sel){if(sel==='.spine-title')return this.title;
    if(sel==='.shelf-book-cover img')return {getAttribute:()=>src};
    return null;}
});
const original=makeBook('data:image/png;base64,ORIGINAL','original');
const generated=makeBook('data:image/png;base64,GENERATED','generated');
const real={dataset:{realSpine:'true'},style:{},offsetWidth:46,offsetHeight:170,
  querySelector:()=>null};
const buttons=[original,generated,real];
const document={
  getElementById:()=>({querySelectorAll:()=>buttons.filter(book=>!book.dataset.lombada)}),
  createElement:()=>({getContext:()=>ctx,toDataURL:()=> 'data:image/webp;base64,ART'}),
  addEventListener(){}
};
const window={devicePixelRatio:2,addEventListener(){}};
class Image{naturalWidth=700;naturalHeight=1000;
  set src(value){this._src=value;queueMicrotask(()=>this.onload?.());}
  get src(){return this._src;}
}
class MutationObserver{observe(){}}
vm.runInNewContext(spine,{document,window,Image,MutationObserver,
  requestAnimationFrame:fn=>queueMicrotask(fn),
  getComputedStyle:()=>({fontSize:'11px'}),location:{href:'https://exemplo.com/',origin:'https://exemplo.com'},
  console,Uint8ClampedArray});
await new Promise(resolve=>setTimeout(resolve,30));
assert.equal(original.dataset.spineMode,'arte-da-capa');
assert.equal(generated.dataset.spineMode,'cores-ilustrativas');
assert.equal(artDraws,1,'a textura com detalhes da capa deve aparecer apenas no livro real');
assert.equal(real.style.backgroundImage,undefined,'a lombada fotografada permanece intacta');
console.log('V50: acabamento fotográfico, prioridades originais e EPUBs verificados.');
