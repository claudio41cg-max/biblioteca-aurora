import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=read('index.html'),explore=read('explorar-livros.html'),reader=read('ler-online.html');
assert.match(main,/href="\.\/explorar-livros.html"/);
assert.match(main,/aurora-online-estante\.js\?v=2/);
assert.match(main,/id="book3d"/);
assert.match(main,/id="openbook"/);
assert.match(explore,/id="tabBooks"/);
assert.match(explore,/id="tabAudio"/);
assert.doesNotMatch(explore,/href="https:\/\//);
assert.match(reader,/id="onlineLeft"/);
assert.match(reader,/id="onlineAudio"/);
assert.match(reader,/id="onlineFontUp"/);
assert.match(reader,/id="onlineTheme"/);
assert.match(reader,/Fonte e direitos desta edição/);
assert.match(read('sw.js'),/aurora-leitura-online\.js\?v=5/);
assert.match(read('aurora-avancado.js'),/source==='online'/);

class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.handlers={};this.dataset={};this.hidden=false;this.value='';this.textContent='';this.classList={add(){},toggle(){}};}
  append(...nodes){for(const node of nodes){if(node.tag==='fragment')this.children.push(...node.children);else this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  addEventListener(type,fn){this.handlers[type]=fn;}
  setAttribute(){}
  querySelectorAll(){return this.children;}
}
const ids=new Map();
const element=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const fakeDoc={getElementById:element,createElement:t=>new Element(t),createDocumentFragment:()=>new Element('fragment'),querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){}};
const storage=new Map(),calls=[];
const fakeStorage={getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)};
const fetchMock=async url=>{
  calls.push(String(url));
  if(url.includes('wikisource.org'))throw Error('Fonte indisponível');
  if(url.includes('openlibrary.org'))return {ok:true,json:async()=>({docs:[{
    key:'/works/OL123W',title:'Retórica e Persuasão',author_name:['Jane Austen'],
    public_scan_b:true,ebook_access:'public',ia:['PersuasionArchive123'],cover_i:22,language:['por']
  }]})};
  if(url.includes('wikibooks.org'))return {ok:true,json:async()=>({query:{search:[]}})};
  if(url.includes('librivox.org'))throw Error('Áudio indisponível');
  return {ok:true,json:async()=>({response:{docs:url.includes('librivoxaudio')?[{
    identifier:'LibrivoxAudio456',title:'Persuasão narrada',creator:'Jane Austen',language:'Portuguese'
  }]:[]}})};
};
const context={document:fakeDoc,localStorage:fakeStorage,fetch:fetchMock,location:{search:''},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console:{warn(){}}};
vm.runInNewContext(read('aurora-online.js'),context);
const settle=()=>new Promise(resolve=>setTimeout(resolve,15));
element('languageChoice').value='pt';
element('searchText').value='Persuasão';
element('searchForm').handlers.submit({preventDefault(){}});
await settle();
assert(calls.some(x=>x.includes('wikisource.org')));
assert(calls.some(x=>x.includes('openlibrary.org')));
assert.equal(element('results').children.length,1,'segunda biblioteca funciona após falha da primeira');
assert.equal(element('alternateBox').hidden,false,'sugere título original quando não há edição exata em português');
assert.equal(element('alternateButton').dataset.originalTitle,'Persuasion');
const book=element('results').children[0].children[1];
const actions=book.children.find(x=>x.className==='result-actions');
assert.match(actions.children[0].href,/^\.\/ler-online\.html\?tipo=arquivo/);
assert.doesNotMatch(actions.children[0].href,/https:\/\//);
actions.children[1].handlers.click();
const saved=JSON.parse(storage.get('aurora-online-books-v1'));
assert.equal(saved[0].source,'openlibrary');
assert.equal(saved[0].category,'romance');
assert.equal(saved[0].archiveId,'PersuasionArchive123');
assert(!calls.some(x=>x.includes('/download/')),'não baixa o arquivo automaticamente');
element('alternateButton').handlers.click();
await settle();
assert.equal(element('languageChoice').value,'all');
assert.equal(element('searchText').value,'Persuasion');

element('tabAudio').handlers.click();
await settle();
assert(calls.some(x=>x.includes('librivox.org')));
assert(calls.some(x=>x.includes('archive.org')));
assert.equal(element('results').children.length,1,'fonte alternativa encontra audiolivro');
const audioActions=element('results').children[0].children[1].children.find(x=>x.className==='result-actions');
assert.match(audioActions.children[0].href,/tipo=audio/);
audioActions.children[1].handlers.click();
assert.equal(JSON.parse(storage.get('aurora-online-books-v1')).length,2);

const rows=new Map([['shelf-romance',new Element()],['shelf-ficcao',new Element()],['shelf-adulto',new Element()],['shelf-brasileiros',new Element()]]);
const shelf={getCategory:id=>id,normalize:s=>s.toLowerCase(),makeSpine:item=>{
  const node=new Element('button');node.dataset.source=item.source;node.dataset.title=item.title.toLowerCase();return node;
},refreshCount(){}};
const fakeLocation={href:''};
const shelfDoc={getElementById:id=>rows.get(id),addEventListener(){},dispatchEvent(){}};
vm.runInNewContext(read('aurora-online-estante.js'),{document:shelfDoc,window:{AuroraShelf:shelf,addEventListener(){}},location:fakeLocation,localStorage:fakeStorage,URLSearchParams,Event:class{}});
assert.equal(rows.get('shelf-romance').children.length,2);
rows.get('shelf-romance').children[0].handlers.click();
assert.match(fakeLocation.href,/^\.\/ler-online\.html/,'lombada abre apenas a Aurora');
console.log('Busca em múltiplos acervos, fallback, audiolivro e leitura interna validados.');
