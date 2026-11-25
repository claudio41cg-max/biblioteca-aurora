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
  assert.ok(html.includes('aurora-desfragmentacao-lab.js?v=1'));
});

test('livro de teste é um modelo 3D temporário e não é salvo no acervo',()=>{
  assert.ok(lab.includes("format:'demo'"));
  assert.ok(lab.includes("id:'aurora-lab-demo-v114'"));
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

test('o teste usa o mesmo motor de partículas e aumenta só um pouco os efeitos',()=>{
  assert.ok(lab.includes('window.AuroraBookParticles?.play(shot)'));
  assert.ok(lab.includes('shot.fragmentScale=Number(slider.value)||1.45'));
  assert.ok(lab.includes('shot.fragmentCountScale=1.12'));
  assert.ok(lab.includes('shot.dustScale=1.12'));
  assert.ok(engine.includes('Number(snapshot.fragmentCountScale)||1'));
  assert.ok(engine.includes('Number(snapshot.dustScale)||1'));
});

test('som sintetizado e vibração são opcionais e iniciados pelo botão do usuário',()=>{
  assert.ok(lab.includes('window.AudioContext||window.webkitAudioContext'));
  assert.ok(lab.includes('function startVibration()'));
  assert.ok(lab.includes('navigator.vibrate(0)'));
  assert.ok(lab.includes('sound.checked'));
  assert.ok(lab.includes('vibration.checked'));
});

test('a captura do livro 3D é a mesma função usada na exclusão normal',()=>{
  assert.ok(actions.includes('window.AuroraBookActions={keyOf,keyFor,isHidden,setHidden,mark,sync,reaction,setReaction,erase,capture,mount}'));
  assert.ok(actions.includes('function capture(scene,css)'));
});

