import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const script=read('libria-perfis.js');
const settings=read('configuracoes.html');
const backup=read('aurora-backup-acervo.js');
const sw=read('sw.js');
const htmlFiles=[
  'index.html','configuracoes.html','nova-estante.html','meus-livros.html',
  'ler-epub.html','ouvir-livro.html','ler-online.html','explorar-livros.html',
  'minha-biblioteca-privada.html'
];

function runtime(entries=[]){
  class FakeStorage{
    constructor(values=[]){this.data=new Map(values);}
    getItem(key){key=String(key);return this.data.has(key)?this.data.get(key):null;}
    setItem(key,value){this.data.set(String(key),String(value));}
    removeItem(key){this.data.delete(String(key));}
    key(index){return [...this.data.keys()][Number(index)]??null;}
    clear(){this.data.clear();}
    get length(){return this.data.size;}
  }
  class FakeIDBFactory{
    open(name,version){return {name,version};}
  }
  const localStorage=new FakeStorage(entries);
  let reloads=0;
  const window={
    localStorage,indexedDB,Storage:FakeStorage,IDBFactory:FakeIDBFactory,
    crypto:{randomUUID:()=> '11111111-2222-4333-8444-555555555555'},
    location:{reload(){reloads++;}},
    addEventListener(){}
  };
  const indexedDB=new FakeIDBFactory();
  runInNewContext(script,{window,localStorage,Storage:FakeStorage,IDBFactory:FakeIDBFactory,indexedDB,console,Date,JSON,Map,Set,Array,String,Number,Math});
  return {window,localStorage,indexedDB,get reloads(){return reloads;}};
}

test('a primeira execução migra o acervo antigo para o perfil principal sem apagar dados externos',()=>{
  const oldProfile={name:'Flavio',country:'BR',language:'pt-BR',setupComplete:true};
  const appBooks='{"Meu livro":"texto"}';
  const appShelves='[{"id":"romance"}]';
  const rt=runtime([
    ['aurora-books',appBooks],
    ['aurora-estantes-personalizadas-v1',appShelves],
    ['libria-profile-v1',JSON.stringify(oldProfile)],
    ['aurora-perfil-nome','Flavio'],
    ['another-app-key','preservar']
  ]);
  assert.equal(rt.window.LibriaProfiles.ready,true);
  assert.equal(rt.window.LibriaProfiles.active().id,'principal');
  assert.equal(rt.window.LibriaProfiles.active().name,'Flavio');
  assert.equal(rt.localStorage.getItem('aurora-books'),appBooks);
  assert.equal(rt.localStorage.getItem('aurora-estantes-personalizadas-v1'),appShelves);
  assert.equal(rt.localStorage.getItem('another-app-key'),null);
  assert.equal(rt.localStorage.data.get('another-app-key'),'preservar');
  assert.equal(rt.localStorage.data.has('aurora-books'),false);
  assert.ok(rt.localStorage.data.has('__libria_profile_v1__:principal:aurora-books'));
});

test('novo perfil recebe localStorage e IndexedDB independentes e o perfil principal continua intacto',()=>{
  const owner=runtime([['aurora-books','{"livro":"do Flavio"}']]);
  const created=owner.window.LibriaProfiles.create('Suely');
  assert.match(created.id,/^p-/);
  assert.equal(owner.window.LibriaProfiles.list().length,2);
  assert.equal(owner.window.LibriaProfiles.switchTo(created.id),true);
  assert.equal(owner.reloads,1);

  const wife=runtime([...owner.localStorage.data.entries()]);
  assert.equal(wife.window.LibriaProfiles.active().name,'Suely');
  assert.equal(wife.localStorage.getItem('aurora-books'),null);
  wife.localStorage.setItem('aurora-books','{"livro":"da Suely"}');
  assert.equal(wife.indexedDB.open('aurora-pdf-library',2).name,'aurora-pdf-library--'+created.id);

  wife.window.LibriaProfiles.switchTo('principal');
  const restoredOwner=runtime([...wife.localStorage.data.entries()]);
  assert.equal(restoredOwner.localStorage.getItem('aurora-books'),'{"livro":"do Flavio"}');
  assert.equal(restoredOwner.indexedDB.open('aurora-pdf-library',2).name,'aurora-pdf-library');
});

test('enumeração, clear e chaves globais respeitam o perfil ativo',()=>{
  const rt=runtime([['aurora-books','owner'],['aurora-perfil-nome','Flavio']]);
  rt.localStorage.setItem('aurora-reading-preferences-v2','{}');
  const keys=Array.from({length:rt.localStorage.length},(_,i)=>rt.localStorage.key(i));
  assert.deepEqual(new Set(keys),new Set(['aurora-books','libria-profile-v1','aurora-perfil-nome','aurora-reading-preferences-v2']));
  assert.ok(rt.localStorage.getItem('libria-profiles-v1'));
  rt.localStorage.clear();
  assert.equal(rt.localStorage.getItem('aurora-books'),null);
  assert.ok(rt.localStorage.getItem('libria-profiles-v1'));
  assert.equal(rt.localStorage.data.has('libria-profiles-v1'),true);
});

test('o backup não exporta nem substitui o nome do perfil de destino',()=>{
  assert.match(backup,/profileIdentityKey/);
  assert.match(backup,/!profileIdentityKey\(key\)/);
  assert.match(backup,/if\(profileIdentityKey\(key\)\)continue/);
  assert.match(backup,/libria-active-profile-v1/);
});

test('as páginas funcionais carregam o isolamento antes dos scripts de dados',()=>{
  for(const path of htmlFiles){
    const html=read(path);
    assert.match(html,/libria-perfis\.js\?v=1/,'falta gerenciador em '+path);
    assert.ok(html.indexOf('libria-perfis.js')<html.indexOf('</head>'),'gerenciador deve carregar no head: '+path);
  }
  assert.match(settings,/id="profileSwitcher"/);
  assert.match(settings,/id="createProfileForm"/);
  assert.match(sw,/const CACHE = 'libria-v130'/);
  for(const page of ['./meus-livros.html','./ler-epub.html','./ouvir-livro.html'])assert.ok(sw.includes(page));
  assert.match(sw,/for \(const \[pageResponse,pageURL\] of pageResponses\)/);
});

test('o gerenciador de perfis tem sintaxe válida',()=>{
  assert.doesNotThrow(()=>new Script(script));
});
