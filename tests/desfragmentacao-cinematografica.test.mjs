import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=readFileSync(new URL('../aurora-exclusao-particulas.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../teste-desfragmentacao.html',import.meta.url),'utf8');
const offline=readFileSync(new URL('../teste-desfragmentacao-offline.html',import.meta.url),'utf8');

test('motor original de erosão mantém sintaxe válida',()=>{
  assert.doesNotThrow(()=>new Script(source));
});

test('a erosão mantém o avanço de cima para baixo e alcança as laterais sem efeito de queimadura',()=>{
  assert.ok(source.includes('return clamp(.075+v*.52+(1-u)*.10'));
  assert.ok(source.includes('(u<.16?'));
  assert.ok(source.includes('ed.data[i*4+3]=Math.round(34*'));
  assert.equal(source.includes('function paintSweep'),false);
});

test('fragmentos maiores e irregulares usam a textura original da capa',()=>{
  assert.ok(source.includes('const chunks=[];'));
  assert.ok(source.includes('if(cinema||fragmentScale>0)'));
  assert.ok(source.includes('shape:(()=>{const sides='));
  assert.ok(source.includes('ctx.drawImage(e.original,p.sx,p.sy,p.sw,p.sh'));
  assert.ok(source.includes('ctx.clip()'));
  assert.ok(source.includes('for(const p of e.chunks)'));
});

test('fragmentos grandes ficam menores e menos numerosos sem reduzir a poeira fina',()=>{
  assert.ok(source.includes('Math.round(w*h/7800),11,20'));
  assert.ok(source.includes('Math.round(w*h/8400),6,13'));
  assert.ok(source.includes('cinema?7+Math.random()*10:5+Math.random()*6'));
  assert.ok(source.includes('const duration=3.1'));
  assert.ok(source.includes('source.start(audio.currentTime)'));
  assert.ok(source.includes('cinema?8+Math.random()*11:5+Math.random()*7'));
  assert.ok(source.includes('const baseParticleCount=cinema?clamp(Math.round(w*h/52)'));
});
test('som de desfragmentação e vibração são discretos e opcionais',()=>{
  assert.ok(source.includes('function playDissolveSound()'));
  assert.ok(source.includes('gain.gain.exponentialRampToValueAtTime(.052'));
  assert.ok(source.includes('navigator.vibrate([8,34,7])'));
  assert.ok(source.includes('if(!reduced){playDissolveSound();addGentleHaptic();}'));
});

test('a exclusão real ativa fragmentos e poeira com movimento e gravidade',()=>{
  assert.ok(source.includes('Number(snapshot.fragmentScale)||0'));
  assert.ok(source.includes('gravity:dust?-5:18+Math.random()*34'));
  assert.ok(source.includes('(cinema?48:12)*dustScale'));
  assert.ok(source.includes('ctx.clip()'));
});

test('o laboratório começa com quadradinhos em 1,35x e permite ajustar',()=>{
  assert.ok(page.includes('Tamanho dos quadradinhos'));
  assert.ok(page.includes('min="1.0" max="1.8" step="0.05" value="1.35"'));
  assert.ok(page.includes('snapshot.fragmentScale=Number(slider.value)'));
});

test('a página offline é autossuficiente e inclui o motor original ajustado',()=>{
  assert.equal(offline.includes('<script src='),false);
  assert.equal(offline.includes('<link rel="stylesheet"'),false);
  assert.ok(offline.includes('const fragmentScale=clamp(Number(snapshot.fragmentScale)||0,0,1.8)'));
  assert.ok(offline.includes('id="testBook"'));
});

test('scripts de controle do laboratório têm sintaxe válida',()=>{
  const start=page.indexOf('<script>'),end=page.indexOf('</script>',start);
  assert.ok(start>=0&&end>start);
  assert.doesNotThrow(()=>new Script(page.slice(start+8,end)));
  const offStart=offline.indexOf('<script>'),offEnd=offline.indexOf('</script>',offStart);
  assert.ok(offStart>=0&&offEnd>offStart);
  assert.doesNotThrow(()=>new Script(offline.slice(offStart+8,offEnd)));
});
