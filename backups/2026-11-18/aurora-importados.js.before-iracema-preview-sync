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
  function showRecoveredEpubCover(button,book){
    if(!book.cover)return;
    if(!book.spine){
      button.style.backgroundImage='url('+JSON.stringify(book.cover)+')';
      button.dataset.coverDerived='true';
      delete button.dataset.lombada;
      delete button.dataset.spineCrisp;
    }
    button.dataset.coverSource=book.coverSource||'original';
    let image=button.querySelector('.shelf-book-cover img');
    if(!image){
      const face=document.createElement('span');face.className='shelf-book-cover';
      face.setAttribute('aria-hidden','true');
      image=document.createElement('img');image.alt='';image.loading='lazy';
      face.append(image);
      const pages=document.createElement('span');pages.className='shelf-book-pages';
      pages.setAttribute('aria-hidden','true');
      button.prepend(face,pages);
    }
    if(image.getAttribute('src')!==book.cover)image.src=book.cover;
    button.dataset.hasRealCover='true';
  }
  // Reexamina o arquivo original uma vez nesta versão, mesmo quando há uma
  // capa ilustrativa antiga. A arte embutida tem prioridade absoluta.
  const coverTasks=new Map();
  async function recoverMissingEpubCover(book){
    if(coverTasks.has(book.id))return coverTasks.get(book.id);
    const task=(async()=>{
      const formats=window.AuroraFormats;
      if(!formats)return false;
      const stored=await formats.readRecord('books',book.id);
      if(!stored)return false;
      let cover=stored.cover||'';
      let coverSource=stored.coverSource||'original';
      let backRecovered=false;
      if((coverSource==='generated'||!cover)&&stored.data){
        try{
          const epub=await formats.openEpub(stored.data);
          if(epub.cover){cover=epub.cover;coverSource='original';}
          if(epub.back&&!stored.back){
            book.back=epub.back;book.backChecked=true;
            stored.back=epub.back;stored.backChecked=true;
            backRecovered=true;
          }
        }catch(error){console.warn('Capa embutida neste EPUB indisponível:',error);}
      }
      // Edição conhecida: se o EPUB realmente não trouxe uma imagem legível,
      // recuperar a capa publicada e guardá-la no próprio aparelho.
      if(!cover||coverSource==='generated'){
        const catalog=await formats.catalogCover?.(book.title||book.name,book.author);
        if(catalog?.cover){cover=catalog.cover;coverSource=catalog.coverSource;}
      }
      if(!cover||coverSource==='generated'){
        // Uma capa provisória antiga não deve prender todos os livros ao
        // mesmo verde. Se não houve imagem embutida, atualiza a ilustração.
        cover=formats.createEpubCover(book.title||book.name,book.author);
        coverSource='generated';
      }
      book.cover=cover;
      book.coverSource=coverSource;
      book.coverCheckedVersion=coverSource==='generated'&&formats.catalogCoverURL?.(book.title||book.name,book.author)?51:52;
      const changed=stored.cover!==cover||stored.coverSource!==coverSource||
        stored.coverCheckedVersion!==book.coverCheckedVersion||backRecovered;
      if(changed){
        stored.cover=cover;stored.coverSource=coverSource;
        stored.coverCheckedVersion=book.coverCheckedVersion;
        await formats.saveRecord('books',stored).catch(error=>console.warn('Capa recuperada não salva:',error));
      }
      return coverSource==='original';
    })();
    coverTasks.set(book.id,task);
    try{return await task;}finally{coverTasks.delete(book.id);}
  }
  // Recupera a contracapa real de EPUBs que foram importados antes deste ajuste.
  // Roda só no primeiro toque no exemplar para não reabrir todos os arquivos da estante.
  async function recoverEpubBack(book){
    if(book.back||book.backChecked||book.format!=='epub')return;
    const formats=window.AuroraFormats;
    if(!formats)return;
    const stored=await formats.readRecord('books',book.id);
    if(!stored)return;
    if(stored.back){book.back=stored.back;}
    else if(stored.data){
      const epub=await formats.openEpub(stored.data);
      book.back=epub.back||'';
    }
    book.backChecked=true;
    stored.back=book.back||'';
    stored.backChecked=true;
    await formats.saveRecord('books',stored);
  }
  // O livro físico segue no MESMO visor WebGL até o centro da tela.
  async function takeBookFromShelf(button,book){
    if(button.disabled)return;
    if(book.format==='epub'&&(!book.cover||book.coverSource==='generated')&&book.coverCheckedVersion!==52){
      button.disabled=true;
      button.setAttribute('aria-busy','true');
      try{
        await recoverMissingEpubCover(book);
        showRecoveredEpubCover(button,book);
      }finally{
        button.disabled=false;
        button.removeAttribute('aria-busy');
      }
    }
    if(book.format==='epub'&&!book.back&&!book.backChecked){
      try{await recoverEpubBack(book);}
      catch(error){console.warn('Contracapa embutida no EPUB indisponível:',error);}
    }
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
        id:book.id,
        format:book.format||'pdf',
        title:window.AuroraTitles?.display(window.AuroraBookInfo?.find(book.name)?.title||book.name)||book.name||'Livro sem título',
        name:book.name||'Livro sem título',
        author:book.author||'',
        country:book.country||'',
        year:book.year||'',
        description:book.description||'',
        cover:book.cover||'',
        coverSource:book.coverSource||'original',
        coverCheckedVersion:book.coverCheckedVersion||0,
        back:book.back||'',
        backChecked:book.backChecked===true,
        spine:book.spine||'',
        spineAspect:book.spineAspect||0,
        ratio:book.ratio||.72,
        total:book.total||0,
        status:book.status||'quero-ler',
        category:shelf.getCategory(book.category,book.name),
        created:book.created||0,
        bookmarked:Number.isInteger(lastPages.get(book.id)?.bookmark)
      })).sort((a,b)=>a.created-b.created);
      const usedDemo=new Set();
      const recoverQueue=[];
      for(const book of imported){
        const row=document.getElementById('shelf-'+book.category);
        if(!row) continue;
        // Capas ilustrativas antigas podem conter o nome bruto do arquivo.
        // Recriar apenas essas capas; capas originais das edições são intocáveis.
        if(book.coverSource==='generated'&&book.title!==book.name&&window.AuroraFormats?.createDigitalCover){
          book.cover=window.AuroraFormats.createDigitalCover(book.title,book.author,book.format);
        }
        const button=shelf.makeSpine({
          title:book.title,
          author:book.author,
          source:book.format||'pdf',
          total:book.total,
          cover:book.cover,
          coverSource:book.coverSource,
          spine:book.spine,
          spineAspect:book.spineAspect,
          ratio:book.ratio,
          bookmarked:book.bookmarked
        });
        button.dataset.bookId=book.id;
        if(book.format==='epub'&&(!book.cover||book.coverSource==='generated')&&book.coverCheckedVersion!==52){
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
              const original=await recoverMissingEpubCover(book);
              if(button.isConnected){
                // Atualiza tanto a capa real recuperada quanto a nova
                // ilustração individual quando a edição não possui foto.
                showRecoveredEpubCover(button,book);
                document.dispatchEvent(new CustomEvent('aurora:book-cover-updated',{detail:{id:book.id,coverSource:book.coverSource,original}}));
              }
            }catch(error){console.warn('Capa de EPUB pendente:',error);}
            await new Promise(resolve=>setTimeout(resolve,60));
          }
        };
        if(typeof requestIdleCallback==='function')requestIdleCallback(()=>recoverInBackground(),{timeout:3000});
        else setTimeout(recoverInBackground,600);
      }
      document.dispatchEvent(new CustomEvent('aurora:library-data',{detail:{books:imported,progress}}));
    }).catch(error=>console.warn('Não foi possível montar os livros importados:',error));
  };
})();
