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
        title:window.AuroraBookInfo?.find(book.name)?.title||book.name||'Livro sem título',
        cover:book.cover||'',
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
        const button=shelf.makeSpine({
          title:book.title,
          source:'pdf',
          total:book.total,
          cover:book.cover,
          spine:book.spine,
          spineAspect:book.spineAspect,
          ratio:book.ratio,
          bookmarked:book.bookmarked
        });
        button.dataset.bookId=book.id;
        button.title=book.title+' • tocar para ver a capa original em 3D';
        button.addEventListener('click',()=>{
          location.href='./meus-livros.html?livro='+encodeURIComponent(book.id)+'&v=10';
        });
        // Um título do catálogo demonstrativo dá lugar à edição realmente baixada.
        const duplicate=Array.from(row.querySelectorAll('.book-spine')).find(node=>
          !usedDemo.has(node) &&
          node.dataset.title===shelf.normalize(book.title) &&
          node.dataset.source!=='pdf'
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
