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
assert.ok(bottom.y>=499&&bottom.y<500,'a ponta inferior deve ficar a menos de 1px do pé');
assert.ok(top.y>0&&top.y<=1,'a ponta superior deve ficar a menos de 1px da cabeceira');
for (const x of [310,140,0,-100,-310]) {
  for(const sourceY of [0,50,250,450,500]) {
    assert.ok(500-soften({x,y:sourceY},height,'bottom').y<1,
      'a ponta inferior não deve encolher no meio do folheio');
    assert.ok(soften({x,y:sourceY},height,'top').y<1,
      'a ponta superior não deve encolher no meio do folheio');
    assert.equal(soften({x,y:sourceY},height,'top').x,x);
  }
}

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
assert.ok(received.y>499&&received.y<500,'o PageFlip recebe uma ponta na borda da folha');
const unchanged={do:originalDo,getCalculation:()=>({getCorner:()=> 'bottom'})};
const installOtherBook=vm.runInNewContext('('+installSource+')',{
  innerWidth:360,$:()=>({classList:{contains:()=>false}}),softenPageCornerLift:soften
});
installOtherBook({flip:{getFlipController:()=>unchanged,getBoundsRect:()=>({height})}});
assert.equal(unchanged.do,originalDo,'outros livros não devem receber a alteração');

// Só a ponta vertical muda. Mantemos o motor e seus 900 ms.
assert.match(html,/const controller=session\.flip\?\.getFlipController\?\.\(\)/);
assert.match(html,/return drawOriginal\.call\(this,softenPageCornerLift\(point,height,calc\.getCorner\(\)\)\)/);
assert.match(html,/session\.flip\.loadFromHTML\(session\.pages\);\s*installFullHeightTurn\(session\)/);
assert.match(html,/innerWidth>=670\|\|!\$\('reader'\)\.classList\.contains\('aurora-page-curl-preview'\)/);
assert.match(html,/visualTitle\.includes\('razao e sensibilidade'\)/);
assert.match(html,/flippingTime:900,usePortrait:mobile,mobileScrollSupport:false,swipeDistance:20/);
assert.match(html,/session\.flip\.on\('flip'/);
assert.match(html,/persistProgress\(session\)/);
assert.match(launcher,/meus-livros\.html\?livro=.*&v=31/);
assert.match(sw,/aurora-v64/);

console.log('V64: toda a trajetória da ponta fica a menos de 1px das bordas; 900 ms preservados.');
