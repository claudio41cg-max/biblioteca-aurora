import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script=readFileSync(new URL('../aurora-estantes-salvas.js',import.meta.url),'utf8');
const listKey='aurora-estantes-personalizadas-v1';
const legacyKey='aurora-nova-estante-v1';

function openTab(values,setItem=(key,value)=>values.set(key,value)){
  const window={};
  const localStorage={getItem:key=>values.get(key)??null,setItem};
  vm.runInNewContext(script,{window,localStorage,Date:{now:()=>1000}});
  return window.AuroraEstantesSalvas;
}

test('dois rascunhos entram na biblioteca pela ordem de conclusão, inclusive no mesmo instante',()=>{
  const tab=openTab(new Map());
  const first=tab.save({id:'romances',name:'Romances'});
  const second=tab.save({id:'contos',name:'Contos'});
  assert.deepEqual(Array.from(tab.read().filter(item=>item.published)),[]);
  const one=tab.save(second,true);
  const two=tab.save(first,true);
  assert.ok(one.publishedAt<two.publishedAt);
  assert.deepEqual(Array.from(tab.read().sort((a,b)=>a.publishedAt-b.publishedAt),item=>item.id),['contos','romances']);
});

test('editar em outra aba conserva o primeiro vínculo e o ID da estante',()=>{
  const values=new Map();
  const editor=openTab(values),secondTab=openTab(values);
  const draft=editor.save({id:'estante-1',name:'Romances'});
  const published=secondTab.save(secondTab.read()[0],true);
  const renamed=editor.save({...draft,name:'Meus romances'});
  assert.equal(renamed.published,true);
  assert.equal(renamed.publishedAt,published.publishedAt);
  const result=secondTab.save(renamed,true);
  assert.equal(result.id,'estante-1');
  assert.equal(secondTab.read().length,1);
  assert.equal(secondTab.read()[0].name,'Meus romances');
});

test('um registro anterior ao vínculo continua sendo um rascunho com a mesma identidade',()=>{
  const legacy={id:'acervo-antigo',name:'Favoritos',wall:'ripas'};
  const values=new Map([[legacyKey,JSON.stringify(legacy)]]);
  const editor=openTab(values);
  const [draft]=editor.read();
  assert.equal(draft.id,legacy.id);assert.equal(draft.published,false);
  editor.save({id:'outra',name:'Outra estante'});
  assert.equal(editor.read().find(item=>item.id===legacy.id).wall,'ripas');
  editor.save(draft,true);
  assert.equal(editor.read().length,2);
});

test('falta de espaço ao concluir preserva o rascunho e as outras estantes',()=>{
  const values=new Map(),writer=openTab(values);
  writer.save({id:'pronta',name:'Já vinculada'},true);
  const draft=writer.save({id:'rascunho',name:'Em edição'});
  const before=values.get(listKey);
  const full=openTab(values,()=>{throw new DOMException('Armazenamento cheio','QuotaExceededError');});
  assert.throws(()=>full.save(draft,true),{name:'QuotaExceededError'});
  assert.equal(values.get(listKey),before);
  assert.equal(draft.published,false);
  assert.equal(writer.read().find(shelf=>shelf.id==='rascunho').published,false);
});

test('dados ilegíveis não são substituídos por uma lista vazia',()=>{
  const values=new Map([[listKey,'{incompleto']]);
  const editor=openTab(values);
  assert.throws(()=>editor.save({id:'outro'},true));
  assert.equal(values.get(listKey),'{incompleto');
});
