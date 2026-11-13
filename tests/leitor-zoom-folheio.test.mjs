import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('meus-livros.html');
const css=read('aurora-reader.css');
const zoomSource=html.slice(html.indexOf('    function applyReaderZoom('),html.indexOf('    async function openReader('));
assert.ok(zoomSource.startsWith('    function applyReaderZoom('),'Função do zoom encontrada');

const readerClasses={};
const readerStyle={};
const elements={
  reader:{classList:{toggle:(name,enabled)=>{readerClasses[name]=enabled;}},style:{setProperty:(name,value)=>{readerStyle[name]=value;}}},
  flipbook:{offsetWidth:300,offsetHeight:520,style:{}},
  viewport:{clientWidth:330,clientHeight:580},
  readerZoom:{value:'100'},readerZoomValue:{textContent:'100%'},status:{textContent:''}
};
const $=id=>elements[id];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const readingPrefs={size:16};
const applyReaderZoom=new Function('$','clamp','readingPrefs',zoomSource+';return applyReaderZoom;')($,clamp,readingPrefs);

const session={zoom:1,textMode:true};
applyReaderZoom(session,1.8);
assert.equal(session.zoom,1.8);
assert.equal(elements.flipbook.style.transform,'translate(0px,0px) scale(1)','A folha não pode aumentar além da tela no texto adaptado');
assert.equal(readerStyle['--reader-text-zoomed-size'],'28.8px','O zoom do texto aumenta somente a fonte');
assert.equal(readerClasses.zoomed,false,'O texto adaptado não deve capturar os gestos do PageFlip');
assert.equal(elements.readerZoomValue.textContent,'180%');

session.textMode=false;
applyReaderZoom(session,1.2);
assert.match(elements.flipbook.style.transform,/scale\(1\.2\)$/,'PDF original continua ampliando o volume');
assert.equal(readerClasses.zoomed,true);
assert.equal(elements.flipbook.style.transform,'scale(1.2)','O PDF original deve ficar ancorado no centro com zoom');

const events=new Map();
let captures=0,forward=0,backward=0;
elements.viewport.addEventListener=(name,callback)=>{events.set(name,callback);};
elements.viewport.setPointerCapture=()=>{captures++;};
session.flip={flipNext:()=>{forward++;},flipPrev:()=>{backward++;}};
const gestureSource=html.slice(html.indexOf('    const viewport=$(\'viewport\');'),html.indexOf('    document.addEventListener(\'keydown\''));
assert.ok(gestureSource.startsWith('    const viewport='),'Gestos do leitor encontrados');
new Function('$','active','applyReaderZoom',gestureSource)($,session,applyReaderZoom);
const pointer=(type,x,y)=>({type,pointerId:1,clientX:x,clientY:y,stopPropagation(){},preventDefault(){}});

events.get('pointerdown')(pointer('pointerdown',250,200));
events.get('pointermove')(pointer('pointermove',210,206));
assert.equal(elements.flipbook.style.transform,'scale(1.2)','Arrastar a página não pode deslocar a folha ampliada');
events.get('pointerup')(pointer('pointerup',130,210));
assert.equal(forward,1,'O gesto lateral vira a folha para frente com zoom');
events.get('pointerdown')(pointer('pointerdown',100,200));
events.get('pointerup')(pointer('pointerup',230,205));
assert.equal(backward,1,'O gesto lateral vira a folha para trás com zoom');

session.textMode=true;
applyReaderZoom(session,1.3);
events.get('pointerdown')(pointer('pointerdown',250,200));
assert.equal(captures,2,'No texto adaptado, os gestos continuam com o motor físico de folhas');
assert.match(css,/box-sizing:border-box;width:100%;height:100%;overflow:auto/,'Texto ampliado permanece dentro da folha com rolagem vertical');
assert.match(css,/padding-bottom:48px/,'Folha usa melhor a altura da tela');
console.log('Zoom e folheio: páginas navegáveis até 200%, texto dentro da folha e margens ajustadas.');
