import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const source=readFileSync(new URL('../aurora-acoes-livro.js',import.meta.url),'utf8');
function setup(){
 const map=new Map(),window={};
 const localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size}};
 runInNewContext(source,{window,localStorage,console});
 return {a:window.AuroraBookActions,window,localStorage};
}
test('retirar e devolver não exclui arquivo nem progresso',()=>{
 const {a,localStorage}=setup();const key=a.keyOf('epub','1','Livro');
 localStorage.setItem('aurora-page:Livro','7');
 a.setHidden(key,true);assert.equal(a.isHidden(key),true);
 assert.equal(a.isHidden(a.keyOf('epub','2','Livro')),false);
 assert.equal(localStorage.getItem('aurora-page:Livro'),'7');
 a.setHidden(key,false);assert.equal(a.isHidden(key),false);
});
test('reação é por edição e pode ser desmarcada',()=>{
 const {a}=setup();const key=a.keyOf('pdf','1','Livro');
 a.setReaction(key,'like');assert.equal(a.reaction(key),'like');
 a.setReaction(key,'cry');assert.equal(a.reaction(key),'cry');
 assert.equal(a.reaction('arquivo:2'),'');a.setReaction(key,'cry');assert.equal(a.reaction(key),'');
});
test('excluir arquivo usa transação conjunta de livro e progresso e limpa referências',async()=>{
 const {a,window,localStorage}=setup();const deleted=[];
 window.AuroraFormats={database:async()=>({close(){},transaction(stores,mode){
  assert.deepEqual(Array.from(stores),['books','progress']);assert.equal(mode,'readwrite');
  const tx={objectStore:store=>({delete:id=>deleted.push([store,id])})};
  queueMicrotask(()=>tx.oncomplete());return tx;
 }})};
 const key='arquivo:1',membership='aurora-estante-exemplares-v1:teste';
 localStorage.setItem(membership,JSON.stringify([{key,section:0},{key:'arquivo:2',section:0,pose:{stackOn:key,y:10}}]));
 await a.erase({source:'pdf',id:'1',title:'Livro',key});
 assert.deepEqual(deleted,[['books','1'],['progress','1']]);
 const members=JSON.parse(localStorage.getItem(membership));assert.equal(members.length,1);assert.equal(members[0].key,'arquivo:2');assert.equal(members[0].pose.stackOn,undefined);
});

test('falha no IndexedDB restaura vínculos, reações e o estado de retirada',async()=>{
  const {a,window,localStorage}=setup();
  const key=a.keyOf('epub','alvo','Livro');
  const membership='aurora-estante-exemplares-v1:teste';
  const original=JSON.stringify([{key,section:0}]);
  localStorage.setItem(membership,original);
  a.setHidden(key,true);
  a.setReaction(key,'like');
  a.toggleFavorite(key);
  window.AuroraFormats={database:async()=>{throw new Error('Banco indisponível');}};
  await assert.rejects(a.erase({source:'epub',id:'alvo',title:'Livro',key}),/Banco indisponível/);
  assert.equal(localStorage.getItem(membership),original);
  assert.equal(a.reaction(key),'like');
  assert.equal(a.isFavorite(key),true);
  assert.equal(a.isHidden(key),true);
});
