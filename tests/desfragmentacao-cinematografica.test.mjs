import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../aurora-exclusao-particulas.js',import.meta.url),'utf8');
const page=readFileSync(new URL('../teste-desfragmentacao.html',import.meta.url),'utf8');
test('motor de partículas com sintaxe JavaScript válida',()=>assert.doesNotThrow(()=>new Script(source)));
test('frente de erosão começa no topo e desce verticalmente',()=>{
 assert.match(source,/\.055\+v\*\.79/);assert.doesNotMatch(source,/\(1-u\)\*\.13/);
});
test('fragmentos maiores são recortes da arte original e recebem gravidade',()=>{
 assert.match(source,/const chunks=\[\],chunkCount=cinema\?/);
 assert.match(source,/13\+Math\.random\(\)\*7/);
 assert.match(source,/8\+Math\.random\(\)\*5/);
 assert.match(source,/ctx\.drawImage\(e\.original,p\.sx,p\.sy,p\.sw,p\.sh/);
 assert.match(source,/p\.gravity\*t\*t/);
});
test('frente iluminada acompanha a erosão e a poeira fica em segundo plano',()=>{
 assert.match(source,/function paintSweep\(/);assert.match(source,/shadowBlur=18/);
 assert.match(source,/function paintDust\(/);assert.match(source,/Blocos maiores: recortes reais da capa/);
});
test('animação reserva tempo para queda e assentamento dos blocos',()=>{
 assert.match(source,/span=cinema\?6\.0:1\.55,duration=reduced\?\.18:cinema\?9\.7:3\.2/);
 assert.match(source,/snapshot\.fragmentScale/);
});
test('laboratório executa só o livro cenográfico, sem rotinas do acervo',()=>{
 assert.ok(page.includes('AuroraBookParticles?.capture(book)'));
 assert.match(page,/snapshot\.cinematic=true/);assert.match(page,/snapshot\.fragmentScale=Number\(slider\.value\)/);
 assert.match(page,/AuroraBookParticles\.play\(snapshot\)/);
 const start=page.indexOf('<script>'),end=page.indexOf('</script>',start);const inline=start>=0&&end>start?page.slice(start+8,end):'';
 assert.doesNotMatch(inline,/localStorage|indexedDB|AuroraBookActions|erase/i);
});
test('script de controle do laboratório tem sintaxe válida',()=>{
 const inline=page.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];assert.ok(inline);
 assert.doesNotThrow(()=>new Script(inline));
});

test('a página offline é autossuficiente e não depende de arquivos externos',()=>{
  const offline=readFileSync(new URL('../teste-desfragmentacao-offline.html',import.meta.url),'utf8');
  assert.equal(offline.includes('<script src='),false);
  assert.equal(offline.includes('<link rel="stylesheet"'),false);
  assert.ok(offline.includes('function paintSweep('));
  assert.ok(offline.includes('id="testBook"'));
});
