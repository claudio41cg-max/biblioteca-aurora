import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const main=read('index.html');
const page=read('explorar-livros.html');
assert.match(main,/href="\.\/explorar-livros\.html"/);
assert.match(main,/aurora-online-estante\.js\?v=1/);
assert.match(main,/id="book3d"/);
assert.match(main,/id="openbook"/);
assert.match(page,/id="tabBooks"/);
assert.match(page,/id="tabAudio"/);
assert.match(page,/id="searchText"/);
assert.match(read('sw.js'),/aurora-online\.js\?v=1/);
assert.match(read('aurora-avancado.js'),/source==='online'/);

class Element {
  constructor(tag='div') {this.tag=tag;this.children=[];this.handlers={};this.dataset={};this.hidden=false;this.value='';this.textContent='';this.classList={add(){},toggle(){}};}
  append(...values){for(const value of values){if(value.tag==='fragment')this.children.push(...value.children);else this.children.push(value);}}
  replaceChildren(...values){this.children=[];this.append(...values);}
  addEventListener(name,fn){this.handlers[name]=fn;}
  setAttribute(){}
  querySelectorAll(){return this.children;}
}
const ids=new Map();
const element=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const storage=new Map();
const urls=[];
const requests=[];
const fakeDocument={getElementById:element,createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element('fragment'),querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){}};
const fakeLocalStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
const mockBooks={next:null,results:[{id:123,title:'Dom Casmurro',authors:[{name:'Machado de Assis'}],languages:['pt'],copyright:false}]};
const mockAudio={books:[{id:'52',title:'Dom Casmurro (audiolivro)',language:'Portuguese',authors:[{first_name:'Machado',last_name:'de Assis'}],url_librivox:'https://librivox.org/dom-casmurro/'}]};
const fakeFetch=async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('gutendex')?mockBooks:mockAudio};};
const context={document:fakeDocument,localStorage:fakeLocalStorage,fetch:fakeFetch,URL,AbortController,setTimeout,clearTimeout,console};
vm.runInNewContext(read('aurora-online.js'),context);
const settle=()=>new Promise(resolve=>setTimeout(resolve,5));

element('searchText').value='Dom Casmurro';
element('languageChoice').value='pt';
element('searchForm').handlers.submit({preventDefault(){}});
await settle();
assert.match(requests[0],/gutendex\.com\/books\/\?search=Dom%20Casmurro&languages=pt/);
assert.equal(element('results').children.length,1);
const bookCard=element('results').children[0];
const bookBody=bookCard.children[1];
const bookSave=bookBody.children.find(child=>child.className==='result-actions').children[1];
bookSave.handlers.click();
assert.equal(JSON.parse(storage.get('aurora-online-books-v1'))[0].url,'https://www.gutenberg.org/ebooks/123');
assert.equal(JSON.parse(storage.get('aurora-online-books-v1'))[0].category,'brasileiros');
assert.equal(urls.length,0,'não baixa nem abre o livro automaticamente');

element('tabAudio').handlers.click();
await settle();
assert.match(requests.at(-1),/librivox\.org\/api\/feed\/audiobooks/);
assert.equal(element('results').children.length,1);
const audioCard=element('results').children[0];
const audioSave=audioCard.children[1].children.find(child=>child.className==='result-actions').children[1];
audioSave.handlers.click();
assert.equal(JSON.parse(storage.get('aurora-online-books-v1')).length,2);
assert.equal(JSON.parse(storage.get('aurora-online-books-v1'))[1].kind,'audio');

const rows=new Map([['shelf-brasileiros',new Element()],['shelf-ficcao',new Element()],['shelf-romance',new Element()],['shelf-adulto',new Element()]]);
const fakeShelf={getCategory:(cat)=>cat,normalize:txt=>txt.toLowerCase(),makeSpine:book=>{
  const b=new Element('button');b.dataset.source=book.source;b.dataset.title=book.title.toLowerCase();return b;
},refreshCount(){}};
const fakeWindow={AuroraShelf:fakeShelf,open:(url)=>urls.push(url),addEventListener(){}};
const shelfDoc={getElementById:id=>rows.get(id),addEventListener(){},dispatchEvent(){}};
vm.runInNewContext(read('aurora-online-estante.js'),{document:shelfDoc,window:fakeWindow,localStorage:fakeLocalStorage,URL,Event:class{}});
assert.equal(rows.get('shelf-brasileiros').children.length,2);
rows.get('shelf-brasileiros').children[0].handlers.click();
assert.equal(urls[0],'https://www.gutenberg.org/ebooks/123');
console.log('Busca online, audiolivros, links sem download e lombadas da estante verificados.');
