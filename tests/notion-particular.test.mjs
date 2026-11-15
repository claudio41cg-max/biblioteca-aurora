import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const page=read('minha-biblioteca-privada.html');
const code=read('aurora-notion-privado.js');
assert.match(read('index.html'),/href="\.\/minha-biblioteca-privada\.html"/);
assert.match(read('explorar-livros.html'),/href="\.\/minha-biblioteca-privada\.html"/);
assert.match(page,/id="notionOutside"/);
assert.match(page,/id="notionUrl"/);
assert.doesNotMatch(page+code+read('sw.js'),/fresh-cart-13d|1bb6c85ec4978320bdb5810664167c39/i,'acesso pago não pode ir ao GitHub');
assert.match(read('sw.js'),/aurora-notion-privado\.js\?v=2/);

class Element{
  constructor(){this.handlers={};this.value='';this.src='';this.href='';this.hidden=true;this.open=true;this.textContent='';}
  addEventListener(type,handler){this.handlers[type]=handler;}
  removeAttribute(name){if(name==='src')this.src='';}
}
const elements=new Map(),get=id=>{
  if(!elements.has(id))elements.set(id,new Element());
  return elements.get(id);
};
const saved=new Map(),historyCalls=[];
const localStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};
const privateUrl='https://example-library.notion.site/0123456789abcdef?view=books';
const location={hash:'#conectar='+encodeURIComponent(privateUrl),pathname:'/biblioteca-aurora/minha-biblioteca-privada.html',search:''};
vm.runInNewContext(code,{
  document:{getElementById:get},localStorage,URL,URLSearchParams,location,
  history:{replaceState(...args){historyCalls.push(args);}}
});
assert.equal(saved.get('aurora-private-notion-link-v1'),privateUrl);
assert.equal(get('notionOutside').href,privateUrl,'atalho particular é exibido apenas no aparelho');
assert.equal(get('privateNotionReader').hidden,false);
assert.equal(get('notionConfiguration').open,false);
assert.equal(historyCalls.length,1,'fragmento de conexão deve ser removido do histórico');
get('notionUrl').value='https://notion.site.evil.example/catalogo';
get('notionConnectForm').handlers.submit({preventDefault(){}});
assert.equal(saved.get('aurora-private-notion-link-v1'),privateUrl,'não aceita endereços externos');
get('notionDisconnect').handlers.click();
assert.equal(saved.size,0,'desconectar limpa o endereço local');
assert.equal(get('privateNotionReader').hidden,true);
console.log('Notion: integração privada, validação de domínio, conexão e exclusão local validadas.');
