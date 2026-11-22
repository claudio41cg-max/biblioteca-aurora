import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const window={};
const load=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
vm.runInNewContext(load('aurora-artes.js'),{window});
const art=window.AuroraEditionArt;

test('reconhece cada face e distingue o verso do material final do livro',()=>{
  for(const [file,expected] of [
    ['OEBPS/Images/FrontCover.jpg','cover'],['folio/cover-back.webp','back'],
    ['contra-capa.png','back'],['spine-image.svg','spine'],['Lombada.png','spine'],
    ['capa-aberta.png','wrap'],['chapter-12.png',''],['back-matter.xhtml','']
  ])assert.equal(art.face(file),expected);
});

test('a largura da lombada vem das dimensões do miolo, excluindo páginas duplas comuns',()=>{
  assert.ok(Math.abs(art.spineFraction(1.42,.64)-.14)<1e-8);
  assert.equal(art.spineFraction(1.28,.64),0);
  assert.equal(art.spineFraction(1.9,.64),0);
});

test('a foto de contracapa de um MP3 não substitui a capa frontal',async()=>{
  class FileReader{
    async readAsDataURL(blob){
      this.result=Buffer.from(await blob.arrayBuffer()).toString('hex');
      this.onload();
    }
  }
  vm.runInNewContext(load('aurora-formatos.js'),{window,FileReader,Blob,TextDecoder,console});
  const frame=(type,byte)=>{
    const body=Buffer.concat([Buffer.from([0]),Buffer.from('image/png\0'),Buffer.from([type,0,byte])]);
    const head=Buffer.alloc(10);head.write('APIC');head.writeUInt32BE(body.length,4);
    return Buffer.concat([head,body]);
  };
  const pics=Buffer.concat([frame(3,0xaf),frame(4,0xbc)]);
  const header=Buffer.alloc(10);header.write('ID3');header[3]=3;header[9]=pics.length;
  const meta=await window.AuroraFormats.audioMetadata(Buffer.concat([header,pics]),'livro.mp3');
  assert.equal(meta.cover,'af');assert.equal(meta.back,'bc');
});
