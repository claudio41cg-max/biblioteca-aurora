import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=filename=>readFileSync(new URL('../'+filename,import.meta.url),'utf8');
const html=read('meus-livros.html');
const css=read('aurora-reader.css');
const sw=read('sw.js');

// A superfície que o leitor dobra tem a mesma proporção do PageFlip.
// A imagem original é centralizada sem esticar textos ou ilustrações.
assert.match(html,/session\.leafRatio=width\/height/);
assert.match(html,/canvas\.height=Math\.max\(1,Math\.round\(canvas\.width\/session\.leafRatio\)\)/);
assert.match(html,/scale=Math\.min\(2\.4,canvas\.width\/natural\.width,canvas\.height\/natural\.height\)/);
assert.match(html,/offsetY=\(canvas\.height-viewport\.height\)\/2/);
assert.match(html,/background:'#ffffff'/);
assert.match(css,/\.reader\.aurora-page-curl-preview \.page:not\(\.text-page\) canvas\{\s*object-fit:fill/);

// Branco sobre papel sépia deve ficar sépia, mesmo quando a edição PDF tem
// uma caixa de página ligeiramente diferente das outras folhas.
assert.match(css,/\.reader\.aurora-page-curl-preview\[data-reader-theme="sepia"\] \.page:not\(\.text-page\) canvas\{\s*background:transparent;\s*filter:none;\s*mix-blend-mode:multiply;/);
assert.match(css,/\.reader\.aurora-page-curl-preview\[data-reader-theme="sepia"\] \.page:not\(\.text-page\)\{\s*background:var\(--aurora-sheet\)/);
assert.match(css,/--aurora-sheet:#f8edda/);
const paper=[248,237,218];
assert.deepEqual([255,255,255].map((white,index)=>Math.round(white*paper[index]/255)),paper);
assert.deepEqual([0,0,0].map((black,index)=>Math.round(black*paper[index]/255)),[0,0,0]);

// O acabamento inferior da capa pode aparecer como espessura, mas não deve
// formar uma moldura grossa atrás de uma folha aparentemente menor.
assert.match(css,/\.aurora-reader-volume__cover\{\s*position:absolute;inset:4px -13px -5px -14px/);
assert.match(css,/\.aurora-reader-volume__sheets\{\s*position:absolute;inset:1px -9px -2px -8px/);

// A prova visual continua restrita a Razão e Sensibilidade e usa o mesmo
// motor, os mesmos gestos e a mesma duração da animação original.
assert.match(html,/visualTitle\.includes\('razao e sensibilidade'\)/);
assert.match(html,/flippingTime:900,usePortrait:mobile,mobileScrollSupport:false,swipeDistance:20/);
assert.match(html,/session\.flip\.loadFromHTML\(session\.pages\)/);
assert.match(html,/\.flip\.flipNext\('bottom'\)/);
assert.match(html,/persistProgress\(session\)/);
assert.match(sw,/aurora-v63/);

console.log('V62: superfície sépia contínua, corte discreto e folheio original preservados.');
