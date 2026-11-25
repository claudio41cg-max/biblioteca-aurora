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

test('a frente orgânica original é preservada e a linha dourada artificial não existe',()=>{
  assert.ok(source.includes('return clamp(.12+v*.59+(1-u)*.13'));
  assert.equal(source.includes('function paintSweep'),false);
});

test('quadradinhos adicionais são discretos, recortados da capa e opcionais',()=>{
  assert.ok(source.includes('const fragmentScale=clamp(Number(snapshot.fragmentScale)||0,0,1.8)'));
  assert.ok(source.includes('const chunks=[];'));
  assert.ok(source.includes('if(fragmentScale>0)'));
  assert.ok(source.includes('ctx.drawImage(e.original,p.sx,p.sy,p.sw,p.sh'));
  assert.ok(source.includes('for(const p of e.chunks)'));
});

test('a exclusão normal não ativa quadradinhos extras sem parâmetro do laboratório',()=>{
  assert.ok(source.includes('Number(snapshot.fragmentScale)||0'));
  assert.ok(source.includes('if(fragmentScale>0)'));
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
