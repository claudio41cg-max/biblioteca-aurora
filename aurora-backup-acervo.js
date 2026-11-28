/* Backup e restauração local do acervo LIBRIA - BOOK. Nenhum dado é enviado à rede. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const format='libria-acervo-backup';
  const version=1;
  const DB_NAME='aurora-pdf-library';
  const DB_VERSION=2;
  const allowed=key=>/^(aurora-|libria-|shelf-)/i.test(String(key||''));
  const status=$('backupStatus');
  const exportButton=$('exportLibraryBackup');
  const restoreButton=$('restoreLibraryBackup');
  const input=$('restoreLibraryFile');
  const progress=$('backupProgress');
  const report=message=>{if(status)status.textContent=message;};
  const showProgress=value=>{if(progress){progress.hidden=false;progress.value=Math.max(0,Math.min(100,value));}};
  function openDatabase(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('books'))db.createObjectStore('books',{keyPath:'id'});
        if(!db.objectStoreNames.contains('progress'))db.createObjectStore('progress',{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Não foi possível abrir o banco de livros.'));
      request.onblocked=()=>reject(new Error('Feche outras abas do LIBRIA - BOOK e tente novamente.'));
    });
  }
  function readAll(db,store){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly'),request=tx.objectStore(store).getAll();
      request.onsuccess=()=>resolve(request.result||[]);
      request.onerror=()=>reject(request.error||new Error('Falha ao ler '+store+'.'));
      tx.onabort=()=>reject(tx.error||new Error('Leitura interrompida.'));
    });
  }
  function readLocalStorage(){
    const values=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(allowed(key))values.push([key,localStorage.getItem(key)]);
    }
    return values;
  }
  function bytesOf(value){
    if(value instanceof ArrayBuffer)return new Uint8Array(value);
    if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    return null;
  }
  async function readDatabase(){
    const db=await openDatabase();
    try{
      const [storedBooks,progressRecords]=await Promise.all([readAll(db,'books'),readAll(db,'progress')]);
      return {storedBooks,progressRecords};
    }finally{db.close();}
  }
  function safeFilename(){
    const date=new Date().toISOString().slice(0,10);
    return 'LIBRIA-BOOK-backup-'+date+'.zip';
  }
  async function exportBackup(){
    if(!window.JSZip)throw new Error('O módulo de compactação não carregou. Atualize a página e tente novamente.');
    exportButton.disabled=true;restoreButton.disabled=true;showProgress(0);
    try{
      report('Lendo livros, progresso e personalizações deste aparelho…');
      const localStorageEntries=readLocalStorage();
      const {storedBooks,progressRecords}=await readDatabase();
      const zip=new JSZip();
      const books=[];
      let totalBytes=0;
      for(let index=0;index<storedBooks.length;index++){
        const item=storedBooks[index];
        const record={...item};
        const data=record.data;
        delete record.data;
        let dataPath=null;
        const bytes=bytesOf(data);
        if(bytes){
          dataPath='books/'+String(index+1).padStart(6,'0')+'.bin';
          zip.file(dataPath,bytes,{binary:true,compression:'STORE'});
          totalBytes+=bytes.byteLength;
        }else if(data instanceof Blob){
          dataPath='books/'+String(index+1).padStart(6,'0')+'.bin';
          zip.file(dataPath,await data.arrayBuffer(),{binary:true,compression:'STORE'});
          totalBytes+=data.size;
        }else if(data!==undefined&&data!==null){
          throw new Error('O formato binário de um livro não pôde ser incluído no backup: '+(item.name||item.id));
        }
        books.push({record,dataPath});
        showProgress(5+Math.round(35*(index+1)/Math.max(1,storedBooks.length)));
        if(index%8===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(totalBytes>300*1024*1024&&!window.confirm('O backup contém aproximadamente '+(totalBytes/1024/1024).toFixed(0)+' MB de arquivos. A criação pode exigir bastante memória do celular. Deseja continuar?'))return;
      const manifest={
        format,version,application:'LIBRIA - BOOK',createdAt:new Date().toISOString(),
        localStorage:localStorageEntries,books,progress:progressRecords,
        summary:{books:books.length,progress:progressRecords.length,localStorageKeys:localStorageEntries.length,binaryBytes:totalBytes}
      };
      zip.file('libria-backup.json',JSON.stringify(manifest));
      report('Compactando backup. Mantenha esta tela aberta…');
      const blob=await zip.generateAsync({type:'blob',compression:'STORE',streamFiles:true},metadata=>{
        showProgress(40+Math.round(metadata.percent*.55));
        if(metadata.percent%20<1)report('Preparando arquivo de backup: '+Math.round(metadata.percent)+'%…');
      });
      const url=URL.createObjectURL(blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=safeFilename();anchor.style.display='none';
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      showProgress(100);
      report('Backup criado: '+books.length+' livros, '+progressRecords.length+' registros de leitura e '+localStorageEntries.length+' configurações. Guarde o ZIP em outro local seguro.');
    }finally{
      exportButton.disabled=false;restoreButton.disabled=false;
    }
  }
  function validateManifest(value){
    if(!value||value.format!==format||value.version!==version||!Array.isArray(value.books)||
      !Array.isArray(value.progress)||!Array.isArray(value.localStorage)){
      throw new Error('Este arquivo não é um backup LIBRIA - BOOK compatível.');
    }
    if(value.books.some(entry=>!entry?.record||!entry.record.id))throw new Error('O backup contém um registro de livro inválido.');
    if(value.progress.some(entry=>!entry||!entry.id))throw new Error('O backup contém um registro de progresso inválido.');
    if(value.localStorage.some(entry=>!Array.isArray(entry)||entry.length!==2||!allowed(entry[0])||typeof entry[1]!=='string'))
      throw new Error('O backup contém configurações inválidas.');
  }
  async function restoreBackup(file){
    if(!window.JSZip)throw new Error('O módulo de restauração não carregou.');
    if(!file||!/\.zip$/i.test(file.name))throw new Error('Selecione um arquivo ZIP de backup do LIBRIA - BOOK.');
    restoreButton.disabled=true;exportButton.disabled=true;showProgress(0);
    try{
      report('Verificando o arquivo de backup…');
      const zip=await JSZip.loadAsync(file);
      const manifestFile=zip.file('libria-backup.json');
      if(!manifestFile)throw new Error('O arquivo ZIP não contém o manifesto do LIBRIA - BOOK.');
      const manifest=JSON.parse(await manifestFile.async('string'));
      validateManifest(manifest);
      const restoredBooks=[];
      for(let index=0;index<manifest.books.length;index++){
        const entry=manifest.books[index],record={...entry.record};
        if(entry.dataPath){
          const binary=zip.file(entry.dataPath);
          if(!binary)throw new Error('Está faltando um arquivo de livro no backup: '+entry.dataPath);
          const bytes=await binary.async('uint8array');
          record.data=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
        }
        restoredBooks.push(record);
        showProgress(Math.round(35*(index+1)/Math.max(1,manifest.books.length)));
        if(index%8===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(!window.confirm('Backup de '+restoredBooks.length+' livros encontrado. A restauração vai mesclar os dados: livros e configurações do backup serão recuperados; outros itens que já existem neste aparelho e não estão no backup serão mantidos. Continuar?'))return;
      // Guarda os valores anteriores para desfazer a etapa local caso o IndexedDB falhe.
      const previous=new Map();
      try{
        for(const [key,value] of manifest.localStorage){
          previous.set(key,localStorage.getItem(key));
          localStorage.setItem(key,value);
        }
      }catch(error){
        for(const [key,value] of [...previous].reverse()){
          try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}
        }
        throw new Error('O armazenamento local não aceitou todas as configurações. Nenhum livro foi restaurado. Libere espaço e tente novamente.');
      }
      let db;
      try{
        db=await openDatabase();
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(['books','progress'],'readwrite');
          const booksStore=tx.objectStore('books'),progressStore=tx.objectStore('progress');
          for(const item of restoredBooks)booksStore.put(item);
          for(const item of manifest.progress)progressStore.put(item);
          tx.oncomplete=resolve;
          tx.onerror=()=>reject(tx.error||new Error('Falha ao gravar o acervo.'));
          tx.onabort=()=>reject(tx.error||new Error('A restauração do acervo foi interrompida.'));
        });
      }catch(error){
        for(const [key,value] of [...previous].reverse()){
          try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}
        }
        throw new Error('Não foi possível gravar os livros no banco local. As configurações anteriores foram mantidas. '+(error?.message||''));
      }finally{db?.close();}
      showProgress(100);
      report('Restauração concluída: '+restoredBooks.length+' livros e '+manifest.progress.length+' registros de leitura. Feche e abra o LIBRIA - BOOK para atualizar o catálogo.');
    }finally{
      restoreButton.disabled=false;exportButton.disabled=false;
      input.value='';
    }
  }
  exportButton?.addEventListener('click',()=>{
    exportBackup().catch(error=>{console.error(error);report(error?.message||'Não foi possível criar o backup.');});
  });
  restoreButton?.addEventListener('click',()=>input?.click());
  input?.addEventListener('change',()=>{
    const file=input.files?.[0];
    if(file)restoreBackup(file).catch(error=>{console.error(error);report(error?.message||'Não foi possível restaurar o backup.');});
  });
  window.LibriaBackup={isAppKey:allowed,readLocalStorage,exportBackup,restoreBackup};
})();
