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
    button.style.backgroundImage='url('+JSON.stringify(book.cover)+')';
    button.dataset.coverDerived='true';
    button.dataset.coverSource=book.coverSource||'original';
    if(!button.querySelector('.shelf-book-cover')){
      const face=document.createElement('span');face.className='shelf-book-cover';
      face.setAttribute('aria-hidden','true');
      const img=document.createElement('img');img.src=book.cover;img.alt='';
      face.append(img);
      const pages=document.createElement('span');pages.className='shelf-book-pages';
      pages.setAttribute('aria-hidden','true');
      button.prepend(face,pages);
    }
    button.dataset.hasRealCover='true';
  }
  async function recoverMissingEpubCover(book){
    const formats=window.AuroraFormats;
    if(!formats)return;
    const stored=await formats.readRecord('books',book.id);
    if(!stored)return;
    let cover=stored.cover||'';
    let coverSource=stored.coverSource||'original';
    if(!cover&&stored.data){
      try{
        const epub=await formats.openEpub(stored.data);
        cover=epub.cover;
      }catch(error){console.warn('Capa embutida no EPUB indisponível:',error);}
      coverSource=cover?'original':'generated';
    }
    if(!cover){cover=formats.createEpubCover(book.name,book.author);coverSource='generated';}
    book.cover=cover;
    book.coverSource=coverSource;
    if(stored.cover!==cover||stored.coverSource!==coverSource){
      stored.cover=cover;stored.coverSource=coverSource;
      await formats.saveRecord('books',stored).catch(error=>console.warn('Capa temporária não salva:',error));
    }
  }
  // O livro físico segue no MESMO visor WebGL até o centro da tela.
  async function takeBookFromShelf(button,book){
    if(button.disabled)return;
    if(book.format==='epub'&&!book.cover){
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
        back:book.back||'',
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
      document.dispatchEvent(new CustomEvent('aurora:library-data',{detail:{books:imported,progress}}));
    }).catch(error=>console.warn('Não foi possível montar os livros importados:',error));
  };
})();
