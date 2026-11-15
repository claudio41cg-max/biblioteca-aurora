import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const text=value=>({nodeType:3,nodeValue:value});
const element=(tag,attributes={},children=[])=>({
  nodeType:1,localName:tag,childNodes:children,
  getAttribute:key=>attributes[key]||null
});
const chapter=element('body',{},[
  element('h1',{},[text('Capítulo com ilustração')]),
  element('figure',{},[
    element('img',{src:'../Images/gravura.jpg',alt:'Gravura original'}),
    element('figcaption',{},[text('Legenda da gravura')])
  ]),
  element('p',{},[text('Depois da imagem, a história continua.')]),
  element('img',{src:'https://exemplo.invalid/nao-abrir.jpg',alt:'Remoto não permitido'})
]);
let activeBody=chapter;
const files={
  'OPS/Text/cap.xhtml':{async:async()=>'<html></html>'},
  'OPS/Images/gravura.jpg':{_data:{uncompressedSize:1200},async:async()=>new Uint8Array([1,2,3])}
};
const sandbox={
  window:{},console,Blob,Uint8Array,
  DOMParser:class{parseFromString(){return {body:activeBody,querySelectorAll:()=>[]};}},
  FileReader:class{
    readAsDataURL(){this.result='data:image/jpeg;base64,AQID';this.onload?.();}
  }
};
vm.runInNewContext(read('aurora-formatos.js'),sandbox);
const formats=sandbox.window.AuroraFormats;
const book={spine:[{path:'OPS/Text/cap.xhtml'}],filenames:new Map(),zip:{file:path=>files[path]||null}};
const result=await formats.epubChapterContent(book,0);
assert.deepEqual(Array.from(result,part=>part.type),['text','image','text','text']);
assert.match(result[0].text,/Capítulo com ilustração/);
assert.match(result[1].src,/^data:image\/jpeg;base64/);
assert.equal(result[1].alt,'Gravura original');
assert.match(result[3].text,/história continua/);
assert.equal(result.some(part=>part.alt==='Remoto não permitido'),false,'EPUB não consulta endereços externos');
const plain=await formats.epubChapter(book,0);
assert.match(plain,/Depois da imagem, a história continua/,'Modo texto continua compatível');

activeBody=element('body',{},[]);
assert.equal((await formats.epubChapterContent(book,0)).length,0,'Capítulo realmente vazio é identificado');
const reader=read('aurora-epub-reader.js');
assert.match(reader,/target\+=direction/,'Capítulos vazios são ignorados ao avançar ou voltar');
assert.match(reader,/paginateContent\(blocks,size\.width,size\.height\)/);
assert.match(reader,/epub-image-content/,'Páginas com gravuras têm tratamento próprio');
assert.match(reader,/stage\.addEventListener\('touchend'/,'Navegação por toque permanece ativa após trocar capítulos');
assert.match(read('aurora-novos-leitores.css'),/\.epub-page-image/);
console.log('EPUB: texto e imagens em ordem, capítulo vazio ignorado, páginas e toque preservados.');
