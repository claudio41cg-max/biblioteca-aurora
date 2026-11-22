/* Resolve as referências da estante pessoal diretamente no acervo deste aparelho. */
(() => {
  'use strict';
  const shelf=window.AuroraShelf;

  function localItems(keys,items){
    const state=shelf.readLocalBooks();
    for(const category of shelf.categories){
      for(const book of shelf.localBooks(category,state)){
        const key=book.source+':'+book.title;
        if(keys.has(key))items.set(key,{...book,category:category.id});
      }
    }
  }

  function onlineItems(keys,items){
    let records;
    try { records=JSON.parse(localStorage.getItem('aurora-online-books-v1')||'[]'); }
    catch { return; }
    if(!Array.isArray(records))return;
    for(const book of records){
      if(!book||typeof book.key!=='string'||typeof book.title!=='string')continue;
      const key='online:'+book.key;
      if(keys.has(key))items.set(key,{id:book.key,title:book.title,author:book.author||'',source:'online',
        cover:book.cover||'',ratio:.72,category:shelf.getCategory(book.category,book.title)});
    }
  }

  function readEdition(db,id){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['books','progress'],'readonly');
      const book=tx.objectStore('books').get(id);
      const progress=tx.objectStore('progress').get(id);
      tx.oncomplete=()=>{
        try { resolve(book.result?shelf.importedItem(book.result,progress.result):null); }
        catch(error){ reject(error); }
      };
      tx.onabort=()=>reject(tx.error||new Error('Não foi possível ler o exemplar.'));
    });
  }

  async function load(references,onProgress,previous){
    const keys=new Set(references);
    const items=new Map();
    const files=[];
    let local=false,online=false;
    for(const key of keys){
      if(typeof key!=='string')continue;
      if(key.startsWith('arquivo:'))files.push(key);
      else if(key.startsWith('online:'))online=true;
      else if(key.startsWith('txt:')||key.startsWith('demo:'))local=true;
    }
    if(local)localItems(keys,items);
    if(online)onlineItems(keys,items);
    if(!files.length)return items;
    if(items.size)onProgress?.(items);
    const keepPrevious=key=>{
      if(previous?.has(key))items.set(key,previous.get(key));
    };
    let db;
    try { db=await window.AuroraFormats.database(); }
    catch(error){
      console.warn('Acervo indisponível no editor.',error);
      files.forEach(keepPrevious);
      return items;
    }
    let lastUpdate=-Infinity;
    try {
      // Cada registro pode conter um PDF grande. Leia somente um exemplar por vez.
      for(const key of files){
        try {
          const id=key.slice('arquivo:'.length);
          let book=await readEdition(db,id);
          if(!book&&String(Number(id))===id&&Number.isFinite(Number(id)))book=await readEdition(db,Number(id));
          if(!book)continue;
          items.set(key,book);
        } catch(error){
          console.warn('Não foi possível ler este exemplar.',error);
          keepPrevious(key);
        }
        const now=Date.now();
        if(onProgress&&now-lastUpdate>=120){
          onProgress(items);
          lastUpdate=now;
        }
      }
    } finally { db.close(); }
    return items;
  }

  window.AuroraEditorAcervo={load,makeSpine:shelf.makeSpine};
})();
