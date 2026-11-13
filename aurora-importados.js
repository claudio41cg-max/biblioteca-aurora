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
    const destination='./meus-livros.html?livro='+encodeURIComponent(book.id)+'&v=14';
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced || !button.animate || !book.cover){location.href=destination;return;}
    const rect=button.getBoundingClientRect();
    const targetHeight=Math.min(window.innerHeight*.47,365);
    const targetWidth=targetHeight*Math.max(.59,Math.min(.84,Number(book.ratio)||.72));
    const targetCenter={x:window.innerWidth/2,y:window.innerHeight*.49};
    const scale=rect.height/targetHeight;
    const dx=rect.left+rect.width/2-targetCenter.x;
    const dy=rect.top+rect.height/2-targetCenter.y;
    const depth=Math.max(25,Math.min(42,28+Number(book.total||180)/38));
    const shade=document.createElement('div');
    shade.className='aurora-flight-backdrop';
    const layer=document.createElement('div');
    layer.className='aurora-flight-layer';
    const volume=document.createElement('div');
    volume.className='aurora-flight-volume';
    volume.style.width=targetWidth+'px';
    volume.style.height=targetHeight+'px';
    volume.style.left=(targetCenter.x-targetWidth/2)+'px';
    volume.style.top=(targetCenter.y-targetHeight/2)+'px';
    volume.style.setProperty('--flight-depth',depth+'px');
    volume.style.setProperty('--flight-half-depth',(depth/2)+'px');
    const back=document.createElement('div');
    back.className='aurora-flight-back';
    back.style.backgroundImage=book.back?'url('+JSON.stringify(book.back)+')':'linear-gradient(#150f12a6,#150f1240),url('+JSON.stringify(book.cover)+')';
    const pages=document.createElement('div');
    pages.className='aurora-flight-pages';
    const spine=document.createElement('div');
    spine.className='aurora-flight-spine';
    spine.style.backgroundImage=book.spine?'url('+JSON.stringify(book.spine)+')':'linear-gradient(90deg,#0009,#0002 50%,#0008),url('+JSON.stringify(book.cover)+')';
    if(!book.spine){
      const title=document.createElement('span');
      title.textContent=book.title;
      spine.append(title);
    }
    const front=document.createElement('div');
    front.className='aurora-flight-front';
    const cover=button.querySelector('.shelf-book-cover img')?.cloneNode(true)||document.createElement('img');
    cover.src=book.cover;
    cover.loading='eager';
    cover.alt='';
    front.append(cover);
    volume.append(back,pages,spine,front);
    layer.append(volume);
    document.body.append(shade,layer);
    button.style.visibility='hidden';
    const duration=850;
    shade.animate([{opacity:0},{opacity:1}],{duration,fill:'forwards',easing:'ease-out'});
    // Começa como lombada, sai da madeira, vira com profundidade real e chega de frente.
    const flight=volume.animate([
      {transform:`translate3d(${dx}px,${dy}px,0) scale(${scale}) rotateX(0deg) rotateY(85deg)`,offset:0},
      {transform:`translate3d(${dx*.82}px,${dy*.78-35}px,75px) scale(${scale*1.13}) rotateX(-3deg) rotateY(72deg)`,offset:.27},
      {transform:`translate3d(${dx*.24}px,${dy*.23-30}px,125px) scale(.86) rotateX(-5deg) rotateY(32deg)`,offset:.74},
      {transform:'translate3d(0,0,0) scale(1) rotateX(-4deg) rotateY(16deg)',offset:1}
    ],{duration,fill:'forwards',easing:'cubic-bezier(.32,.02,.16,1)'});
    let navigated=false;
    const finish=()=>{
      if(navigated)return;
      navigated=true;
      try{sessionStorage.setItem('aurora-arriving-book',JSON.stringify({id:book.id,at:Date.now()}));}catch{}
      location.href=destination;
    };
    flight.finished.then(finish,finish);
    setTimeout(finish,duration+250);
    window.addEventListener('pageshow',()=>{
      button.style.visibility='';
      shade.remove();layer.remove();navigating=false;
    },{once:true});
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
