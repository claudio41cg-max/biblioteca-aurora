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
assert.match(spine,/dataset\.realSpine==='true'/);
assert.match(epub,/const refs=nodes\(packageXML,'itemref'\)\.slice\(0,3\)/);
assert.match(epub,/if\(illustrations\.length!==1/);
assert.match(imported,/book\.editionArtVersion!==1/);
assert.match(html,/aurora-lombadas\.js\?v=\d+/);

const imageDraws=[];
const lettering=[],outlines=[];
const ctx={
  drawImage(...args){imageDraws.push(args);},
  getImageData(){
    const data=new Uint8ClampedArray(32*144*4);
    for(let n=0;n<data.length;n+=4)data.set([42,102,170,255],n);
    return {data};
  },
  createLinearGradient(){return {addColorStop(){}};},
  fillRect(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
  fill(){},translate(){},rotate(){},save(){},restore(){},
  measureText(v){return {width:String(v).length*6};},strokeText(text){outlines.push(text);},fillText(text){lettering.push(text);}
};
const makeBook=(src,coverSource)=>({
  dataset:{coverDerived:'true',coverSource,rawTitle:'Livro: subtítulo',author:'Nome da autora'},
  style:{},offsetWidth:46,offsetHeight:170,isConnected:true,
  title:{textContent:'Livro: subtítulo',style:{}},
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
  getElementById:id=>id==='library'?{querySelectorAll:()=>buttons.filter(book=>!book.dataset.lombada)}:null,
  createElement:()=>({getContext:()=>ctx,toDataURL:()=> 'data:image/webp;base64,ART'}),
  addEventListener(){}
};
const window={devicePixelRatio:2,addEventListener(){}};
class Image{async decode(){} naturalWidth=700;naturalHeight=1000;
  set src(value){this._src=value;queueMicrotask(()=>this.onload?.());}
  get src(){return this._src;}
}
class MutationObserver{observe(){}}
vm.runInNewContext(read('aurora-edition-surfaces.js'),{document,window,console});
vm.runInNewContext(spine,{document,window,Image,MutationObserver,
  requestAnimationFrame:fn=>queueMicrotask(fn),
  getComputedStyle:()=>({fontSize:'11px'}),location:{href:'https://exemplo.com/',origin:'https://exemplo.com'},
  console,Uint8ClampedArray});
await new Promise(resolve=>setTimeout(resolve,30));
assert.equal(original.dataset.spineCrisp,'true');
assert.equal(generated.dataset.spineCrisp,'true');
assert.deepEqual(lettering,['Livro','Livro','Nome da autora']);
assert.deepEqual(outlines,['Livro'],'o título sobre a ilustração tem contorno');
const [crop]=imageDraws.filter(args=>args[8]===1000);
assert.equal(crop[0].src,'data:image/png;base64,ORIGINAL');
assert.equal(crop[3]/crop[4],46/170,'o recorte segue a proporção física da lombada');
assert.equal(crop[1],(700-crop[3])/2,'faixa central da edição');
assert.equal(imageDraws.filter(args=>args[7]===32&&args[8]===144).length,2);
assert.equal(imageDraws.length,3,'a capa ilustrativa não é reimpressa sobre o título');
assert.equal(real.style.backgroundImage,undefined,'a lombada fotografada permanece intacta');
console.log('V50: título e autoria na lombada, prioridade das fotos originais e EPUBs verificados.');
