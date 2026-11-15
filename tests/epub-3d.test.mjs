import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const drawn=[];
const ctx={
  createLinearGradient:()=>({addColorStop:()=>{}}),
  fillRect:()=>{},strokeRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},stroke:()=>{},
  fillText:text=>drawn.push(String(text)),measureText:text=>({width:text.length*18})
};
const formatsContext={window:{},document:{createElement:name=>{
  assert.equal(name,'canvas');return {width:0,height:0,getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,TESTE'};
}},TextDecoder,Blob,Uint8Array,ArrayBuffer};
vm.runInNewContext(read('aurora-formatos.js'),formatsContext);
const cover=formatsContext.window.AuroraFormats.createEpubCover('A Moreninha','Joaquim Manuel de Macedo');
assert.equal(cover,'data:image/png;base64,TESTE');
assert.ok(drawn.includes('A Moreninha'));
assert.ok(drawn.includes('CAPA ILUSTRATIVA • EPUB'),'Não apresentar uma imagem criada como capa original');

const classes=()=>{
  const values=new Set();
  return {add:(...names)=>names.forEach(name=>values.add(name)),
    remove:(...names)=>names.forEach(name=>values.delete(name)),contains:name=>values.has(name)};
};
const element=()=>({style:{setProperty:()=>{}},classList:classes(),
  addEventListener:()=>{},querySelector:()=>({style:{}}),
  getBoundingClientRect:()=>({left:0,top:0,width:40,height:150}),
  focus:()=>{},hidden:true,textContent:'',value:'',open:false});
const elements=new Map();
const get=id=>{
  if(!elements.has(id))elements.set(id,element());
  return elements.get(id);
};
const site={AuroraFormats:{createEpubCover:()=>cover},addEventListener:()=>{},dispatchEvent:()=>{}};
let redirected='';
const navigation={set href(value){redirected=value;},get href(){return redirected;}};
const context={window:site,document:{getElementById:get,body:{classList:classes()},addEventListener:()=>{}},
  location:navigation,history:{state:{},pushState:()=>{},back:()=>{}},
  setTimeout:()=>1,clearTimeout:()=>{},cancelAnimationFrame:()=>{},
  CustomEvent:class{constructor(name,options){this.type=name;this.detail=options.detail;}},console};
vm.runInNewContext(read('aurora-sala-3d.js'),context);
const button=element();
const epub={id:'moreninha',format:'epub',name:'A Moreninha',author:'Joaquim Manuel de Macedo',cover:''};
site.AuroraShelfViewer.open(button,epub);
assert.equal(epub.cover,cover);
assert.equal(epub.coverSource,'generated');
assert.equal(get('auroraShowcase').hidden,false,'EPUB sem capa deve abrir o mesmo visor 3D');
assert.equal(get('cover3d').src,cover);
assert.match(get('cover3d').alt,/Capa ilustrativa/);
assert.equal(redirected,'','Não deve saltar direto para o leitor EPUB');
site.AuroraShelfViewer.close();
const pdf={id:'pdf',format:'pdf',name:'PDF existente',cover:'data:image/jpeg;base64,ORIGINAL'};
site.AuroraShelfViewer.open(button,pdf);
assert.equal(get('cover3d').src,pdf.cover,'A capa original do PDF não deve mudar');
assert.equal(redirected,'','O fluxo 3D do PDF permanece funcionando');
console.log('EPUB sem capa entra no visor 3D e o PDF mantém seu comportamento.');
