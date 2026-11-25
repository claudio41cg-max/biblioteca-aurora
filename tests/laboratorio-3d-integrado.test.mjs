import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const lab=readFileSync(new URL('../aurora-desfragmentacao-lab.js',import.meta.url),'utf8');
const engine=readFileSync(new URL('../aurora-exclusao-particulas.js',import.meta.url),'utf8');
const actions=readFileSync(new URL('../aurora-acoes-livro.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('script do laboratório integrado tem sintaxe válida',()=>{
  assert.doesNotThrow(()=>new Script(lab));
});

test('laboratório abre o mesmo visor 3D da Biblioteca Aurora',()=>{
  assert.ok(lab.includes("window.AuroraShelfViewer.open(launch,createDemoBook())"));
  assert.ok(lab.includes("showcase.classList.add('aurora-lab-demo')"));
  assert.ok(lab.includes("window.AuroraBookActions?.capture(scene,cssBook)"));
  assert.ok(html.includes('aurora-desfragmentacao-lab.js?v=2'));
});

test('livro de teste é um modelo 3D temporário e não é salvo no acervo',()=>{
  assert.ok(lab.includes("format:'demo'"));
  assert.ok(lab.includes("id:'aurora-lab-demo-v115'"));
  assert.ok(lab.includes('cover:drawCover(false),back:drawCover(true),spine:drawSpine()'));
  assert.ok(lab.includes("window.addEventListener('aurora:book-closed',cleanup)"));
  assert.equal(lab.includes('indexedDB'),false);
  assert.equal(lab.includes('localStorage'),false);
  assert.equal(lab.includes('AuroraBookActions.erase'),false);
});

test('o toque na capa do exemplar temporário não abre o leitor',()=>{
  assert.ok(lab.includes("window.addEventListener('aurora:open-book',event=>"));
  assert.ok(lab.includes('event.stopImmediatePropagation()'));
  assert.ok(lab.includes('window.Aurora3D?.reset?.()'));
});

test('o laboratório usa o motor de poeira sem pedaços de capa',()=>{
  assert.ok(lab.includes('window.AuroraBookParticles?.play(shot)'));
  assert.ok(lab.includes('shot.dustParticleScale=Number(slider.value)||1'));
  assert.ok(lab.includes('shot.dustScale=1.12'));
  assert.ok(engine.includes('dustParticleScale=clamp(Number(snapshot.dustParticleScale)||1,.7,1)'));
  assert.equal(engine.includes('const chunks=[];'),false);
});

test('som externo e vibração são opcionais e controlados pelos checkboxes',()=>{
  assert.ok(lab.includes('shot.soundEnabled=sound.checked'));
  assert.ok(lab.includes('shot.hapticEnabled=vibration.checked'));
  assert.ok(engine.includes('https://assets.sfx.woven.video/sfx/swish-whoosh-large.wav'));
  assert.ok(engine.includes('navigator.vibrate([8,34,7])'));
  assert.equal(lab.includes('AudioContext'),false);
});

test('a captura do livro 3D é a mesma função usada na exclusão normal',()=>{
  assert.ok(actions.includes('window.AuroraBookActions={keyOf,keyFor,isHidden,setHidden,mark,sync,reaction,setReaction,erase,capture,mount}'));
  assert.ok(actions.includes('function capture(scene,css)'));
});

