/* Perfis locais do LIBRIA - BOOK.
   Separa preferências no localStorage e livros/progresso no IndexedDB.
   Não é autenticação: os perfis organizam o aparelho, mas não têm senha. */
(()=> {
  'use strict';
  const ACTIVE_KEY='libria-active-profile-v1';
  const REGISTRY_KEY='libria-profiles-v1';
  const PROFILE_KEY='libria-profile-v1';
  const LEGACY_NAME_KEY='aurora-perfil-nome';
  const DB_NAME='aurora-pdf-library';
  const STORAGE_PREFIX='__libria_profile_v1__:';
  const GLOBAL_KEYS=new Set([ACTIVE_KEY,REGISTRY_KEY]);
  const APP_KEY=/^(aurora-|libria-|shelf-)/i;
  const storage=window.localStorage;
  const storageProto=Object.getPrototypeOf(storage);
  const original={
    getItem:storageProto.getItem,
    setItem:storageProto.setItem,
    removeItem:storageProto.removeItem,
    key:storageProto.key,
    clear:storageProto.clear,
    length:Object.getOwnPropertyDescriptor(storageProto,'length')?.get
  };
  const rawGet=key=>original.getItem.call(storage,key);
  const rawSet=(key,value)=>original.setItem.call(storage,key,String(value));
  const rawRemove=key=>original.removeItem.call(storage,key);
  const rawKeys=()=>{
    const result=[];
    const total=original.length?original.length.call(storage):0;
    for(let i=0;i<total;i++){
      const key=original.key.call(storage,i);
      if(key!==null)result.push(key);
    }
    return result;
  };
  const namespace=id=>STORAGE_PREFIX+id+':';
  const parse=(value,fallback)=>{
    try{return JSON.parse(value||'')??fallback;}catch{return fallback;}
  };
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function migrateLegacyStorage(){
    const currentRegistry=parse(rawGet(REGISTRY_KEY),null);
    if(Array.isArray(currentRegistry)&&currentRegistry.some(item=>item?.id))return currentRegistry;
    const oldKeys=rawKeys().filter(key=>APP_KEY.test(key)&&!GLOBAL_KEYS.has(key)&&!key.startsWith(STORAGE_PREFIX));
    const oldProfile=parse(rawGet(PROFILE_KEY),{});
    const oldName=rawGet(LEGACY_NAME_KEY)||oldProfile.name||'';
    const id='principal';
    const prefix=namespace(id);
    // Primeiro copia tudo. Só remove as chaves antigas depois que a cópia terminou.
    try{
      for(const key of oldKeys){
        const value=rawGet(key);
        if(value!==null)rawSet(prefix+key,value);
      }
      let profile=parse(rawGet(prefix+PROFILE_KEY),oldProfile||{});
      profile={
        ...profile,
        name:String(profile.name||oldName||'').trim(),
        country:profile.country||'BR',
        language:profile.language||'pt-BR',
        setupComplete:profile.setupComplete===true||oldKeys.some(key=>['aurora-estantes-personalizadas-v1','aurora-books','aurora-perfil-nome'].includes(key)),
        migratedFromLegacy:oldKeys.length>0||profile.migratedFromLegacy===true
      };
      rawSet(prefix+PROFILE_KEY,JSON.stringify(profile));
      if(profile.name)rawSet(prefix+LEGACY_NAME_KEY,profile.name);
      const registry=[{id,name:profile.name||'Minha biblioteca',createdAt:Date.now()}];
      rawSet(REGISTRY_KEY,JSON.stringify(registry));
      rawSet(ACTIVE_KEY,id);
      for(const key of oldKeys)rawRemove(key);
      return registry;
    }catch(error){
      console.error('Não foi possível preparar os perfis locais. O acervo antigo foi mantido.',error);
      return null;
    }
  }
  let registry=migrateLegacyStorage();
  if(!registry)return;
  let activeId=rawGet(ACTIVE_KEY)||registry[0]?.id||'principal';
  if(!registry.some(item=>item?.id===activeId)){
    activeId=registry[0]?.id||'principal';
    rawSet(ACTIVE_KEY,activeId);
  }
  const profilePrefix=namespace(activeId);
  const profileKey=key=>profilePrefix+String(key);
  const scopedKeys=target=>{
    const result=[];
    const total=original.length?original.length.call(target):0;
    for(let i=0;i<total;i++){
      const key=original.key.call(target,i);
      if(key?.startsWith(profilePrefix))result.push(key.slice(profilePrefix.length));
    }
    return result;
  };
  const define=(name,value)=>Object.defineProperty(storageProto,name,{
    configurable:true,writable:true,value
  });
  define('getItem',function(key){
    if(this!==storage)return original.getItem.call(this,key);
    const name=String(key);
    return GLOBAL_KEYS.has(name)?rawGet(name):rawGet(profileKey(name));
  });
  define('setItem',function(key,value){
    if(this!==storage)return original.setItem.call(this,key,value);
    const name=String(key);
    if(GLOBAL_KEYS.has(name))return rawSet(name,value);
    return rawSet(profileKey(name),value);
  });
  define('removeItem',function(key){
    if(this!==storage)return original.removeItem.call(this,key);
    const name=String(key);
    return GLOBAL_KEYS.has(name)?rawRemove(name):rawRemove(profileKey(name));
  });
  define('key',function(index){
    if(this!==storage)return original.key.call(this,index);
    return scopedKeys(this)[Number(index)]??null;
  });
  define('clear',function(){
    if(this!==storage)return original.clear.call(this);
    for(const key of scopedKeys(this))rawRemove(profileKey(key));
  });
  if(original.length){
    Object.defineProperty(storageProto,'length',{
      configurable:true,
      enumerable:true,
      get(){return this===storage?scopedKeys(this).length:original.length.call(this);}
    });
  }
  // O banco principal antigo continua sendo o perfil principal. Cada novo perfil
  // recebe outro banco IndexedDB, preservando PDF, EPUB, áudio e progresso sem migração binária.
  const factoryProto=window.indexedDB?Object.getPrototypeOf(window.indexedDB):window.IDBFactory?.prototype;
  if(factoryProto?.open){
    const originalOpen=factoryProto.open;
    Object.defineProperty(factoryProto,'open',{
      configurable:true,writable:true,
      value:function(name,version){
        if(String(name)!==DB_NAME)return originalOpen.apply(this,arguments);
        const safeId=activeId.replace(/[^a-z0-9-]/gi,'');
        const databaseName=activeId==='principal'?DB_NAME:DB_NAME+'--'+safeId;
        return version===undefined?originalOpen.call(this,databaseName):originalOpen.call(this,databaseName,version);
      }
    });
  }
  function readRegistry(){
    const value=parse(rawGet(REGISTRY_KEY),[]);
    return Array.isArray(value)?value.filter(item=>item&&typeof item.id==='string'):[];
  }
  function readMeta(id){
    return parse(rawGet(namespace(id)+PROFILE_KEY),{name:'',country:'BR',language:'pt-BR',setupComplete:true});
  }
  function writeRegistry(next){
    registry=next;
    rawSet(REGISTRY_KEY,JSON.stringify(next));
  }
  function list(){
    return readRegistry().map(item=>({...item,active:item.id===activeId}));
  }
  function active(){
    const item=readRegistry().find(entry=>entry.id===activeId)||{id:activeId,name:'Minha biblioteca'};
    return {...item,profile:readMeta(activeId)};
  }
  function renameActive(name){
    const clean=String(name||'').trim().slice(0,48);
    const next=readRegistry().map(item=>item.id===activeId?{...item,name:clean||'Minha biblioteca'}:item);
    writeRegistry(next);
    return active();
  }
  function create(name){
    const clean=String(name||'').trim().slice(0,48);
    if(!clean)throw new Error('Digite um nome para o novo perfil.');
    const items=readRegistry();
    if(items.some(item=>normalize(item.name)===normalize(clean)))throw new Error('Já existe um perfil com esse nome.');
    const uuid=window.crypto?.randomUUID?.()||('p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
    const id='p-'+String(uuid).replace(/[^a-z0-9-]/gi,'');
    const entry={id,name:clean,createdAt:Date.now()};
    rawSet(namespace(id)+PROFILE_KEY,JSON.stringify({
      name:clean,country:'BR',language:'pt-BR',setupComplete:true,createdAt:Date.now()
    }));
    rawSet(namespace(id)+LEGACY_NAME_KEY,clean);
    writeRegistry([...items,entry]);
    return entry;
  }
  function switchTo(id){
    const target=readRegistry().find(item=>item.id===id);
    if(!target)throw new Error('Este perfil não está disponível neste aparelho.');
    if(id===activeId)return false;
    rawSet(ACTIVE_KEY,id);
    window.location.reload();
    return true;
  }
  window.LibriaProfiles={
    ready:true,
    list,active,create,switchTo,renameActive,
    get activeId(){return activeId;}
  };
  window.addEventListener?.('storage',event=>{
    if(event.key===ACTIVE_KEY&&event.newValue&&event.newValue!==activeId)window.location.reload();
  });
})();