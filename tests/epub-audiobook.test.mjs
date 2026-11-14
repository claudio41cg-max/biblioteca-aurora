import {strict as assert} from 'node:assert';
import {readFileSync,statSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const index=read('index.html');
const shelf=read('aurora-importados.js');
const viewer=read('aurora-sala-3d.js');
const pdf=read('meus-livros.html');
for(const id of ['epubFile','audioFile','audioCoverFile'])assert.match(index,new RegExp('id="'+id+'"'));
for(const name of ['aurora-formatos.js','aurora-novos-formatos.js','vendor/jszip.min.js'])assert.ok(index.includes(name));
assert.ok(statSync(new URL('../vendor/jszip.min.js',import.meta.url)).size>10000);
assert.match(shelf,/format:book\.format\|\|'pdf'/);
assert.match(viewer,/session\.motion=scene\.animate/,'3D deve continuar flutuando');
assert.match(viewer,/ler-epub\.html/);
assert.match(viewer,/ouvir-livro\.html/);
assert.match(read('aurora-avancado.js'),/\['pdf','epub','audio'\]\.includes\(source\)/);
assert.match(pdf,/new St\.PageFlip\(host,/,'O leitor PDF mantém o folheio original');
assert.match(read('aurora-epub-reader.js'),/new St\.PageFlip\(host,/,'O EPUB usa páginas físicas');
assert.match(read('aurora-epub-reader.js'),/formats\.saveRecord\('progress'/);
assert.match(read('aurora-audiobook.js'),/playbackRate/);
assert.match(read('aurora-audiobook.js'),/formats\.saveRecord\('progress'/);
assert.match(read('sw.js'),/\.\/ler-epub\.html/);
assert.match(read('sw.js'),/\.\/ouvir-livro\.html/);

const context={window:{},TextDecoder,Blob,Uint8Array,ArrayBuffer,indexedDB:{}};
vm.runInNewContext(read('aurora-formatos.js'),context);
const name=context.window.AuroraFormats.cleanName;
assert.equal(name('O_Morro-dos-Ventos-Uivantes.epub'),'O Morro dos Ventos Uivantes');
assert.equal(name('Livro de áudio.m4b'),'Livro de áudio');
// ID3v2: título e artista, sem alterar o arquivo original.
const frame=(tag,text)=>{
  const payload=new Uint8Array([3,...new TextEncoder().encode(text)]);
  const n=payload.length;
  return new Uint8Array([...new TextEncoder().encode(tag),0,0,0,n,0,0,...payload]);
};
const title=frame('TIT2','Narrativa de teste');
const author=frame('TPE1','Autora de teste');
const size=title.length+author.length;
const audio=new Uint8Array([73,68,51,3,0,0,0,0,(size>>7)&127,size&127,...title,...author]);
const meta=await context.window.AuroraFormats.audioMetadata(audio.buffer,'fallback.mp3');
assert.equal(meta.title,'Narrativa de teste');
assert.equal(meta.author,'Autora de teste');
console.log('EPUB, áudio, capas, persistência, exclusão e 3D verificados.');
