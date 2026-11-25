import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

const source=readFileSync(new URL('../aurora-exclusao-particulas.js',import.meta.url),'utf8');
const lab=readFileSync(new URL('../aurora-desfragmentacao-lab.js',import.meta.url),'utf8');

test('motor de desfragmentação mantém sintaxe válida',()=>{
  assert.doesNotThrow(()=>new Script(source));
});

test('não cria nem desenha pedaços sólidos recortados da capa',()=>{
  assert.equal(source.includes('const chunks=[];'),false);
  assert.equal(source.includes('e.chunks'),false);
  assert.equal(source.includes('ctx.clip()'),false);
  assert.equal(source.includes('fragmentScale'),false);
  assert.equal(source.includes('fragmentCountScale'),false);
});

test('mantém poeira fina e permite reduzir seu tamanho até 70%',()=>{
  assert.ok(source.includes('dustParticleScale=clamp(Number(snapshot.dustParticleScale)||1,.7,1)'));
  assert.ok(source.includes('*sizeScale*dustParticleScale'));
  assert.ok(source.includes('rare<.055?1.95+Math.random()*1.2'));
  assert.ok(source.includes('(cinema?12+Math.random()*20:6+Math.random()*9)*dustParticleScale'));
  assert.ok(source.includes('*dustParticleScale,life:cinema?2.7'));
  assert.ok(source.includes('const baseParticleCount=cinema?clamp(Math.round(w*h/52)'));
  assert.ok(source.includes('dustScale=clamp(Number(snapshot.dustScale)||1,1,1.4)'));
});

test('a fumaça difusa ganha volume sem criar fragmentos sólidos',()=>{
  assert.ok(source.includes('cinema?58:14'));
  assert.ok(source.includes('cinema?12+Math.random()*20:6+Math.random()*9'));
  assert.ok(source.includes('opacity=.07*Math.sin(Math.PI*a)'));
  assert.ok(source.includes('ctx.scale(1.45,.76)'));
  assert.ok(source.includes('Nuvens elípticas e translúcidas'));
  assert.equal(source.includes('const chunks=[];'),false);
});

test('a erosão orgânica e a duração cinematográfica são preservadas',()=>{
  assert.ok(source.includes('return clamp(.075+v*.52+(1-u)*.10'));
  assert.ok(source.includes('(u<.16?'));
  assert.ok(source.includes('const startRelease=cinema?.42:.10,span=cinema?5.2:1.55,duration=reduced?.18:cinema?8.7:3.2'));
  assert.equal(source.includes('function paintSweep'),false);
});

test('o som usa efeitos externos SpritePilot CC0, leves e sem whoosh repetitivo',()=>{
  assert.ok(source.includes('SpritePilot, biblioteca CC0 1.0'));
  assert.ok(source.includes('https://spritepilot.com/free-assets/sound-effects/magic/spell-cast.ogg'));
  assert.ok(source.includes('https://spritepilot.com/free-assets/sound-effects/magic/wind-spell.ogg'));
  assert.ok(source.includes('https://spritepilot.com/free-assets/sound-effects/magic/buff.ogg'));
  assert.ok(source.includes('const cues=['));
  assert.ok(source.includes('new Audio(cue.url)'));
  assert.equal(source.includes('assets.sfx.woven.video'),false);
  assert.equal(source.includes('AudioContext'),false);
});

test('som e vibração podem ser desligados pelo laboratório',()=>{
  assert.ok(source.includes('snapshot.soundEnabled!==false'));
  assert.ok(source.includes('snapshot.hapticEnabled!==false'));
  assert.ok(source.includes('navigator.vibrate([8,34,7])'));
  assert.ok(lab.includes('shot.soundEnabled=sound.checked'));
  assert.ok(lab.includes('shot.hapticEnabled=vibration.checked'));
});

test('o laboratório controla poeira fina, não fragmentos de capa',()=>{
  assert.ok(lab.includes('Tamanho da poeira fina'));
  assert.ok(lab.includes('min="0.7" max="1.0" step="0.05" value="1.0"'));
  assert.ok(lab.includes('shot.dustParticleScale=Number(slider.value)||1'));
  assert.ok(lab.includes('shot.dustScale=1.12'));
  assert.equal(lab.includes('shot.fragmentScale'),false);
  assert.equal(lab.includes('function startSound()'),false);
  assert.equal(lab.includes('AudioContext'),false);
});

test('o script integrado do laboratório mantém sintaxe válida',()=>{
  assert.doesNotThrow(()=>new Script(lab));
});
