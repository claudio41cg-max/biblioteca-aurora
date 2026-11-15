import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const epub=read('aurora-epub-reader.js');
const html=read('ler-epub.html');
const pdf=read('meus-livros.html');
const showcase=read('aurora-sala-3d.css');
const css=read('aurora-novos-leitores.css');
const sound=read('aurora-som-folhas.js');

assert.match(html,/aurora-epub-reader\.js\?v=3/);
assert.match(html,/aurora-som-folhas\.js\?v=1/);
assert.match(pdf,/aurora-som-folhas\.js\?v=1/);
assert.match(pdf,/Som suave de folhas ao virar/);
assert.match(html,/Som suave de folhas ao virar/);
assert.match(css,/body\.epub-reader/);
assert.match(css,/\.epub-reader \.epub-sheet-number|\.epub-reader \.epub-page-number/);
assert.match(showcase,/background:transparent/);
assert.match(showcase,/Palatino Linotype/);
assert.match(epub,/whiteSpace:'pre-wrap'/,'A medição das folhas deve respeitar parágrafos');
assert.match(epub,/lineHeight:String\(settings\.line\)/,'Espaçamento das folhas acompanha configurações');
assert.match(epub,/changeState/,'Folhas EPUB iniciam o som durante o folheio');
assert.match(pdf,/changeState/,'Folhas PDF iniciam o som durante o folheio');

// Simula St.PageFlip.destroy() retirando o host inteiro, como acontece em
// alguns EPUBs após a troca de capítulos. O novo livro deve continuar visível.
const source=epub.slice(epub.indexOf('  function drawPages(){'),epub.indexOf('  function goPage('));
assert.ok(source.includes('function drawPages(){'));
const created=[];
const makeElement=tag=>{
  const element={tag,dataset:{},style:{},className:'',children:[],attributes:{},
    append(...items){this.children.push(...items);},
    replaceChildren(...items){this.children=items;},
    setAttribute(name,value){this.attributes[name]=value;},
    classList:{add(name){element.className+=' '+name;},toggle(name,on){if(on)element.className+=' '+name;}}};
  created.push(element);
  return element;
};
const stage={child:null,replaceChildren(...items){this.child=items[0]||null;}};
const document={createElement:makeElement};
const window={St:{PageFlip:class{
  constructor(host){this.host=host;this.events=new Map();}
  loadFromHTML(elements){this.elements=elements;}
  on(event,handler){this.events.set(event,handler);}
  turnToPage(page){this.current=page;}
  destroy(){stage.child=null;}
}}};
const makeDraw=new Function('document','stage','window',`
  let host={style:{},className:'',replaceChildren(){},classList:{add(){}}};
  let flip={destroy(){stage.child=null}};
  let pages=['Primeira folha','Segunda folha','Terceira folha'];
  let page=1,windowStart=0,windowLength=0;
  const PAGE_WINDOW=48,settings={theme:'light',font:'Georgia',size:18,line:1.55};
  const St=window.St;
  const pageDimensions=()=>({width:270,height:375});
  const refresh=()=>{},remember=()=>{},stopSpeech=()=>{};
  const innerWidth=390;
  const $=()=>({textContent:''});
  ${source}
  return {drawPages,getHost:()=>host,getFlip:()=>flip};
`);
const runner=makeDraw(document,stage,window);
runner.drawPages();
assert.equal(stage.child,runner.getHost(),'Nova folha montada após destruir motor anterior');
assert.equal(runner.getFlip().elements.length,3,'As três páginas continuam no livro');
assert.equal(runner.getFlip().current,1,'A página salva continua aberta');
runner.drawPages();
assert.equal(stage.child,runner.getHost(),'Outra troca de capítulo preserva o host do EPUB');
assert.equal(runner.getFlip().elements[0].children[0].textContent,'Primeira folha');

// O som funciona sem downloads e permite silenciar ambos os leitores.
const values=new Map();
const handlers={};
const inputs=[{checked:true},{checked:true}];
let played=0;
const context={state:'running',currentTime:1,sampleRate:22050,destination:{},
  createBuffer:(_,size)=>({getChannelData:()=>new Float32Array(size)}),
  createBufferSource:()=>({playbackRate:{value:1},connect(){},start(){played++;},stop(){}}),
  createBiquadFilter:()=>({connect(){},frequency:{value:0},Q:{value:0}}),
  createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}})};
const page={readyState:'complete',querySelectorAll:()=>inputs,
  addEventListener:(type,fn)=>handlers[type]=fn};
const soundWindow={AudioContext:class{constructor(){return context;}}};
vm.runInNewContext(sound,{window:soundWindow,document:page,localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},console});
assert.equal(soundWindow.AuroraPageSound.enabled(),true);
soundWindow.AuroraPageSound.play();
assert.equal(played,2,'Folha usa duas camadas de ruído suave');
soundWindow.AuroraPageSound.setEnabled(false);
assert.equal(inputs.every(input=>!input.checked),true);
context.currentTime=2;
soundWindow.AuroraPageSound.play();
assert.equal(played,2,'Folheio silenciado não toca som');

console.log('EPUB: host recuperado, paridade visual e som de folheio PDF/EPUB verificados.');
