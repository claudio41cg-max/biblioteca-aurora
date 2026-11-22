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
formatsContext.window.AuroraFormats.createDigitalCover('Um livro na internet','Autora','online');
assert.ok(drawn.includes('CAPA ILUSTRATIVA • LIVRO ONLINE'));

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
const listeners=new Map();
const site={AuroraFormats:{createDigitalCover:()=>cover},addEventListener:(name,callback)=>listeners.set(name,callback),dispatchEvent:()=>{}};
let redirected='';
const navigation={set href(value){redirected=value;},get href(){return redirected;}};
const context={window:site,document:{getElementById:get,body:{classList:classes()},addEventListener:()=>{}},
  location:navigation,history:{state:{},pushState:()=>{},back:()=>{}},
  setTimeout:()=>1,clearTimeout:()=>{},cancelAnimationFrame:()=>{},requestAnimationFrame:callback=>callback(0),
  Event,CustomEvent:class{constructor(name,options){this.type=name;this.detail=options.detail;}},console};
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
site.AuroraShelfViewer.close();

let openedText=0;
const txt={id:'txt:meu',format:'txt',name:'Meu TXT',cover:'',openReader:()=>openedText++};
site.AuroraShelfViewer.open(button,txt);
assert.equal(get('auroraShowcase').hidden,false,'TXT deve passar pelo 3D');
listeners.get('aurora:book-ready')({detail:{id:txt.id}});
listeners.get('aurora:open-book')();
assert.equal(openedText,1,'Abrir a capa deve retornar ao leitor TXT existente');

const online={id:'online:livro',format:'online',name:'Livro online',cover:'',
  readerURL:'./ler-online.html?tipo=wiki&titulo=Livro'};
site.AuroraShelfViewer.open(button,online);
assert.equal(get('auroraShowcase').hidden,false,'Livro online adicionado também deve sair da estante em 3D');
listeners.get('aurora:book-ready')({detail:{id:online.id}});
listeners.get('aurora:open-book')();
assert.equal(redirected,online.readerURL,'O leitor online deve abrir somente após a capa 3D');
assert.match(read('aurora-online-estante.js'),/AuroraShelfViewer\.open\(button/);
assert.match(read('aurora-estante.js'),/AuroraShelfViewer\.open\(button/);
console.log('EPUB, TXT e online entram no 3D; PDFs e leitores originais foram preservados.');
