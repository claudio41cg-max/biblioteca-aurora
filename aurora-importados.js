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
  // A retirada é uma transição visual: os arquivos continuam no IndexedDB.
  let navigating=false;
  function takeBookFromShelf(button,book){
    if(navigating)return;
    navigating=true;
    const destination='./meus-livros.html?livro='+encodeURIComponent(book.id)+'&v=13';
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced || !button.animate){location.href=destination;return;}
    const rect=button.getBoundingClientRect();
    const coverWidth=Math.min(window.innerWidth*.58,245);
    const targetHeight=Math.min(window.innerHeight*.49,350);
    const scale=targetHeight/Math.max(rect.height,1);
    const targetX=window.innerWidth/2-(rect.left+rect.width/2);
    const targetY=window.innerHeight*.49-(rect.top+rect.height/2);
    const shade=document.createElement('div');
    shade.className='aurora-flight-backdrop';
    const clone=button.cloneNode(true);
    clone.classList.add('aurora-book-flight');
    clone.style.cssText+=`;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;position:fixed;transform:rotateY(-5deg)`;
    // A mesma imagem de capa acompanha o livro até o visor 3D.
    const face=clone.querySelector('.shelf-book-cover');
    if(face){
      face.style.transform='rotateY(0deg)';
      face.style.left='100%';
      face.style.width=Math.max(coverWidth/scale,70)+'px';
    }
    document.body.append(shade,clone);
    button.style.visibility='hidden';
    const duration=680;
    shade.animate([{opacity:0},{opacity:1}],{duration,fill:'forwards',easing:'ease-out'});
    const flight=clone.animate([
      {transform:'translate3d(0,0,0) scale(1) rotateY(-5deg)',opacity:1,offset:0},
      {transform:`translate3d(${targetX*.6}px,${targetY*.65-22}px,0) scale(${Math.max(1,scale*.7)}) rotateY(-28deg)`,opacity:1,offset:.55},
      {transform:`translate3d(${targetX}px,${targetY}px,0) scale(${scale}) rotateY(-18deg)`,opacity:1,offset:1}
    ],{duration,fill:'forwards',easing:'cubic-bezier(.22,.75,.18,1)'});
    const finish=()=>{location.href=destination;};
    flight.finished.then(finish,finish);
    setTimeout(finish,duration+300);
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
          takeBookFromShelf(button,book);
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
