/* Os PDFs do IndexedDB entram na mesma prateleira de cada gênero, sem cópias. */
(() => {
  'use strict';
  const shelf = window.AuroraShelf;
  if (!shelf) return;
  const request=indexedDB.open('aurora-pdf-library',2);
  request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains('books')) db.createObjectStore('books',{keyPath:'id'});
    if(!db.objectStoreNames.contains('progress')) db.createObjectStore('progress',{keyPath:'id'});
  };
  request.onerror=()=>console.warn('Não foi possível consultar os PDFs guardados neste aparelho.');
  const readerPath=book=>book.format==='epub'?'ler-epub.html':book.format==='audio'?'ouvir-livro.html':'meus-livros.html';
  function showEdition(button,book){
    const fresh=shelf.makeSpine({...book,source:book.format});
    for(const key of ['realSpine','coverDerived','coverSource','hasRealCover','shelf3dTitle','shelf3dPilot']){
      if(fresh.dataset[key])button.dataset[key]=fresh.dataset[key];
      else delete button.dataset[key];
    }
    for(const key of ['shelfPreview','spineCrisp','lombada'])delete button.dataset[key];
    button.style.backgroundImage=fresh.style.backgroundImage;
    button.style.setProperty('--book-width',fresh.style.getPropertyValue('--book-width'));
    button.replaceChildren(...fresh.childNodes);
    document.dispatchEvent(new CustomEvent('aurora:book-cover-updated',{detail:{id:book.id,coverSource:book.coverSource}}));
  }

  const tasks=new Map();
  function needsEdition(book){
    if(!['epub','pdf','audio'].includes(book.format))return false;
    if(book.editionArtVersion!==1)return true;
    if(book.coverSource==='generated'&&book.format==='epub')return book.coverCheckedVersion!==52;
    return false;
  }
  async function recoverEdition(button,book){
    if(!needsEdition(book))return;
    if(tasks.has(book.id))return tasks.get(book.id);
    const task=(async()=>{
      const formats=window.AuroraFormats;
      const stored=await formats.readRecord('books',book.id);
      if(!stored?.data)return;
      let art={};
      if(book.format==='epub'){
        const epub=await formats.openEpub(stored.data);
        art={cover:epub.cover,back:epub.back,spine:epub.spineImage,spineAspect:epub.spineAspect};
      }else if(book.format==='audio'){
        art=await formats.audioMetadata(stored.data,stored.mime?.includes('mp4')?'livro.m4b':stored.name);
      }else{
        if(!window.pdfjsLib||!window.AuroraPDFCovers)return;
        pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf=await pdfjsLib.getDocument({data:new Uint8Array(stored.data.slice(0))}).promise;
        try{
          art=await window.AuroraPDFCovers.edition(pdf);
          if(!stored.back&&!stored.backChecked&&!art.back)
            art.back=await window.AuroraPDFCovers.extractBack(pdf,window.AuroraPDFCovers.renderImage);
          if(!art.cover&&!stored.cover)Object.assign(art,await window.AuroraPDFCovers.front(pdf,book.title,book.author));
        }finally{await pdf.destroy();}
      }
      if(art.cover&&!art.ratio){
        const panel=await window.AuroraEditionArt.decode(art.cover).catch(()=>null);
        if(panel)art.ratio=panel.naturalWidth/panel.naturalHeight;
      }
      let fallback=null;
      if(!art.cover&&(!stored.cover||stored.coverSource==='generated')){
        if(book.format==='epub')fallback=await formats.catalogCover?.(book.name,book.author);
        if(!fallback)fallback={cover:stored.cover||formats.createDigitalCover(book.title,book.author,book.format),coverSource:'generated'};
      }
      const latest=await formats.updateBookArt(book.id,current=>{
        if(art.cover&&!current.customCover&&current.coverSource!=='custom'){
          current.cover=art.cover;current.coverSource=art.coverSource||'original';
        }else if(fallback&&(!current.cover||current.coverSource==='generated')){
          Object.assign(current,fallback);
        }
        if(art.back&&!current.back)current.back=art.back;
        if(art.spine&&!current.spine){current.spine=art.spine;current.spineAspect=art.spineAspect;}
        if(art.ratio&&!current.customCover)current.ratio=art.ratio;
        current.backChecked=true;
        current.editionArtVersion=1;
        current.coverCheckedVersion=current.coverSource==='generated'&&formats.catalogCoverURL?.(book.name,book.author)?51:52;
      });
      if(!latest)return;
      const changed=book.cover!==latest.cover||book.spine!==(latest.spine||'')||book.back!==(latest.back||'');
      for(const key of ['cover','spine','back','spineAspect','ratio','coverSource','backChecked','editionArtVersion','coverCheckedVersion'])
        if(latest[key]!==undefined)book[key]=latest[key];
      if(changed&&button.isConnected)showEdition(button,book);
    })();
    tasks.set(book.id,task);
    try{await task;}finally{tasks.delete(book.id);}
  }
  async function takeBookFromShelf(button,book){
    if(button.disabled)return;
    button.disabled=true;
    try{await recoverEdition(button,book);}
    catch(error){console.warn('Arte da edição indisponível:',error);}
    finally{button.disabled=false;}
    if(window.AuroraShelfViewer?.open)window.AuroraShelfViewer.open(button,book);
    else location.href='./'+readerPath(book)+'?livro='+encodeURIComponent(book.id);
  }
  request.onsuccess=()=>{
    const db=request.result;
    const readAll=store=>new Promise(resolve=>{
      const tx=db.transaction(store,'readonly');
      const query=tx.objectStore(store).getAll();
      query.onsuccess=()=>resolve(query.result||[]);
      query.onerror=()=>resolve([]);
    });
    Promise.all([readAll('books'),readAll('progress')]).then(([books,progress])=>{
      db.close();
      const lastPages=new Map(progress.map(item=>[item.id,item]));
      const imported=books.map(book=>({
        ...shelf.importedItem(book,lastPages.get(book.id)),
        format:book.format||'pdf',
        country:book.country||'',
        year:book.year||'',
        description:book.description||'',
        coverCheckedVersion:book.coverCheckedVersion||0,
        back:book.back||'',
        backChecked:book.backChecked===true,
        editionArtVersion:book.editionArtVersion||0,
        status:book.status||'quero-ler',
        created:book.created||0
      })).sort((a,b)=>a.created-b.created);
      const usedDemo=new Set();
      const recoverQueue=[];
      for(const book of imported){
        const row=document.getElementById('shelf-'+book.category);
        if(!row) continue;
        const button=shelf.makeSpine(book);
        if(needsEdition(book)){
          recoverQueue.push({button,book});
        }
        button.title=book.title+(book.coverSource==='generated'?' • capa ilustrativa; tocar para abrir em 3D':' • tocar para ver a edição em 3D');
        button.addEventListener('click',()=>{
          takeBookFromShelf(button,book).catch(error=>{
            console.warn('Não foi possível preparar a capa EPUB:',error);
            if(window.AuroraShelfViewer?.open)window.AuroraShelfViewer.open(button,book);
            else location.href='./'+readerPath(book)+'?livro='+encodeURIComponent(book.id);
          });
        });
        // Um título do catálogo demonstrativo dá lugar à edição realmente baixada.
        const duplicate=Array.from(row.querySelectorAll('.book-spine')).find(node=>
          !usedDemo.has(node) &&
          node.dataset.title===shelf.normalize(book.title) &&
          !['pdf','epub','audio'].includes(node.dataset.source)
        );
        if(duplicate){
          usedDemo.add(duplicate);
          duplicate.replaceWith(button);
        } else {
          row.append(button);
        }
        shelf.refreshCount(book.category);
      }
      // Recuperação gradual na estante: não é necessário abrir cada EPUB.
      // Trabalha em sequência para não descompactar vários livros ao mesmo tempo.
      if(recoverQueue.length){
        const recoverInBackground=async()=>{
          for(const {button,book} of recoverQueue){
            try{
              await recoverEdition(button,book);
            }catch(error){console.warn('Arte da edição pendente:',error);}
            await new Promise(resolve=>setTimeout(resolve,60));
          }
        };
        if(typeof requestIdleCallback==='function')requestIdleCallback(()=>recoverInBackground(),{timeout:3000});
        else setTimeout(recoverInBackground,600);
      }
      window.AuroraImportedBooks=imported;
      window.AuroraImportedProgress=progress;
      document.dispatchEvent(new CustomEvent('aurora:library-data',{detail:{books:imported,progress}}));
    }).catch(error=>console.warn('Não foi possível montar os livros importados:',error));
  };
})();
