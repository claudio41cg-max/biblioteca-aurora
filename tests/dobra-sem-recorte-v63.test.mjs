import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('meus-livros.html');
const sw=read('sw.js');
const launcher=read('aurora-sala-3d.js');

const source=html.match(/function softenPageCornerLift\(point,height,corner\)\{[\s\S]*?\n    \}/)?.[0];
assert.ok(source,'a função que regula a altura da ponta precisa existir no leitor');
const soften=vm.runInNewContext('('+source+')');

const height=500;
const bottom=soften({x:140,y:450},height,'bottom');
const top=soften({x:140,y:50},height,'top');
assert.equal(bottom.x,140,'o movimento horizontal não deve mudar');
assert.equal(top.x,140,'o movimento horizontal não deve mudar');
assert.equal(bottom.y,479,'a ponta inferior deve chegar perto do pé do livro');
assert.equal(top.y,21,'a ponta superior deve chegar perto da cabeceira');
assert.equal(soften({x:-180,y:500},height,'bottom').y,500);
assert.equal(soften({x:-180,y:0},height,'top').y,0);

const installSource=html.match(/function installFullHeightTurn\(session\)\{[\s\S]*?\n    \}/)?.[0];
assert.ok(installSource);
let received=null;
const originalDo=point=>{received=point;return 'virou';};
const controller={do:originalDo,getCalculation:()=>({getCorner:()=> 'bottom'})};
const session={flip:{getFlipController:()=>controller,getBoundsRect:()=>({height})}};
const install=vm.runInNewContext('('+installSource+')',{
  innerWidth:360,$:()=>({classList:{contains:()=>true}}),softenPageCornerLift:soften
});
install(session);
assert.equal(controller.do({x:140,y:450}),'virou');
assert.equal(received.x,140);
assert.equal(received.y,479,'o método original do PageFlip continua recebendo a página corrigida');
const unchanged={do:originalDo,getCalculation:()=>({getCorner:()=> 'bottom'})};
const installOtherBook=vm.runInNewContext('('+installSource+')',{
  innerWidth:360,$:()=>({classList:{contains:()=>false}}),softenPageCornerLift:soften
});
installOtherBook({flip:{getFlipController:()=>unchanged,getBoundsRect:()=>({height})}});
assert.equal(unchanged.do,originalDo,'outros livros não devem receber a alteração');

// Há ainda uma dobra em perspectiva, mas a variação vertical é menor.
// A animação original do StPageFlip continua com o tempo padrão de 900 ms.
assert.match(html,/const controller=session\.flip\?\.getFlipController\?\.\(\)/);
assert.match(html,/return drawOriginal\.call\(this,softenPageCornerLift\(point,height,calc\.getCorner\(\)\)\)/);
assert.match(html,/session\.flip\.loadFromHTML\(session\.pages\);\s*installFullHeightTurn\(session\)/);
assert.match(html,/innerWidth>=670\|\|!\$\('reader'\)\.classList\.contains\('aurora-page-curl-preview'\)/);
assert.match(html,/visualTitle\.includes\('razao e sensibilidade'\)/);
assert.match(html,/flippingTime:900,usePortrait:mobile,mobileScrollSupport:false,swipeDistance:20/);
assert.match(html,/session\.flip\.on\('flip'/);
assert.match(html,/persistProgress\(session\)/);
assert.match(launcher,/meus-livros\.html\?livro=.*&v=30/);
assert.match(sw,/aurora-v63/);

console.log('V63: ponta da folha fica próxima às bordas; gesto horizontal e duração preservados.');
