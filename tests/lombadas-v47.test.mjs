import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const script=read('aurora-lombadas.js'),html=read('index.html'),worker=read('sw.js');
const shelf=read('aurora-estante.js');
assert.match(shelf,/dataset\.realSpine='true'/);
assert.match(shelf,/dataset\.coverDerived='true'/);
assert.match(html,/aurora-lombadas\.js\?v=\d+/);
assert.match(worker,/Promise\.allSettled/);
assert.match(worker,/NAVIGATION_TIMEOUT_MS/);
assert.match(script,/devicePixelRatio/);
assert.match(script,/getImageData/);
assert.match(script,/backgroundSize='100% 100%'/);
assert.match(script,/dataset\.realSpine==='true'/);
assert.match(script,/crossOrigin='anonymous'/);

// Livro sem lombada real: a textura deve ser produzida sem mudar sua capa.
const title={textContent:'A Hipótese do Amor',style:{},clientHeight:140,clientWidth:38,scrollHeight:130,scrollWidth:36};
const cover={getAttribute:()=> 'data:image/png;base64,EXAMPLE'};
const imported={
  dataset:{coverDerived:'true',rawTitle:'A Hipótese do Amor'},
  offsetWidth:46,offsetHeight:169,isConnected:true,style:{},
  querySelector(selector){return selector==='.spine-title'?title:selector==='.shelf-book-cover img'?cover:null;}
};
const realTitle={textContent:'Lombada original',style:{},clientHeight:160,clientWidth:40,scrollHeight:150,scrollWidth:36};
const original={
  dataset:{realSpine:'true'},offsetWidth:42,offsetHeight:166,isConnected:true,style:{},
  querySelector(selector){return selector==='.spine-title'?realTitle:null;}
};
const library={
  querySelectorAll(selector){return [imported,original].filter(book=>!book.dataset.lombada);}
};
const ctx={
  createLinearGradient(){return {addColorStop(){}};},
  drawImage(){},getImageData(){return {data:new Uint8ClampedArray(32*144*4).fill(125)};},
  fillRect(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},
  translate(){},rotate(){},save(){},restore(){},measureText(t){return {width:String(t).length*7};},fillText(){}
};
const document={
  getElementById:id=>id==='library'?library:null,
  createElement:()=>({width:0,height:0,getContext:()=>ctx,toDataURL:()=>'data:image/webp;base64,TEST'}),
  addEventListener(){}
};
const window={devicePixelRatio:2,addEventListener(){}};
class Image{
  naturalWidth=720;naturalHeight=1100;
  set src(value){Promise.resolve().then(()=>this.onload?.());}
}
class MutationObserver{observe(){}}
vm.runInNewContext(script,{
  document,window,Image,MutationObserver,
  requestAnimationFrame:fn=>Promise.resolve().then(fn),
  getComputedStyle:()=>({fontSize:'11px'}),
  location:{href:'https://example.com/',origin:'https://example.com'},
  console,Uint8ClampedArray
});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(imported.dataset.spineCrisp,'true','lombada ilustrada foi gerada');
assert.match(imported.style.backgroundImage,/data:image\/webp/);
assert.equal(imported.style.backgroundSize,'100% 100%');
assert.equal(title.style.color,'transparent','não duplica o título desenhado no canvas');
assert.equal(original.style.backgroundImage,undefined,'lombada original não pode ser substituída');
assert.notEqual(realTitle.style.color,'transparent','não esconde título de lombada original');
console.log('V47/V49: lombadas nítidas; arte original, leitores e cache preservados.');
