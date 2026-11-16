/* Catálogo visual de cada prateleira: nenhuma cópia dos arquivos é criada.
   Cada cartão aponta para o mesmo livro que já abre em 3D na estante. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const overlay=$('auroraCatalogOverlay');
  const grid=$('auroraCatalogGrid');
  const more=$('auroraCatalogMore');
  if(!overlay||!grid||!more||!window.AuroraShelf)return;
  const shelf=window.AuroraShelf;
  const savedGenerated=new Map();
  const PAGE_SIZE=9;
  let current=null,visible=PAGE_SIZE,returnFocus=null;
  const showCount=count=>count===1?'1 livro':count+' livros';

  function buttonsInCategory(category){
    const row=$('shelf-'+category);
    return row?Array.from(row.querySelectorAll('.book-spine')):[];
  }
  function getTitle(button){
    const text=button.querySelector('.spine-title')?.textContent?.trim();
    return text||button.dataset.rawTitle||'Livro sem título';
  }
  function generatedCover(button,title){
    const format=button.dataset.source||'demo';
    const key=button.dataset.bookId||format+':'+button.dataset.rawTitle;
    if(savedGenerated.has(key))return savedGenerated.get(key);
    let image='';
    try{image=window.AuroraFormats?.createDigitalCover?.(title,button.dataset.author,format)||'';}
    catch(error){console.warn('Capa ilustrativa indisponível:',error);}
    if(image)savedGenerated.set(key,image);
    return image;
  }
  function fillImage(holder,button,title){
    const existing=button.querySelector('.shelf-book-cover img');
    const cover=existing?.getAttribute('src')||generatedCover(button,title);
    if(!cover){
      const text=document.createElement('span');text.className='aurora-catalog-fallback';
      text.textContent=title;holder.append(text);return;
    }
    const image=document.createElement('img');
    image.src=cover;
    image.loading='lazy';image.decoding='async';
    image.alt=(existing?'Capa de ':'Capa ilustrativa de ')+title;
    image.addEventListener('error',()=>{
      // Nunca fazer uma imagem quebrada parecer a capa verdadeira do arquivo.
      if(image.dataset.fallback==='1'){
        const text=document.createElement('span');text.className='aurora-catalog-fallback';
        text.textContent=title;image.replaceWith(text);return;
      }
      const fallback=generatedCover(button,title);
      if(!fallback||fallback===image.src){
        const text=document.createElement('span');text.className='aurora-catalog-fallback';
        text.textContent=title;image.replaceWith(text);return;
      }
      image.dataset.fallback='1';image.src=fallback;image.alt='Capa ilustrativa de '+title;
    });
    holder.append(image);
  }
  function cardFor(button){
    const title=getTitle(button);
    const card=document.createElement('button');
    card.type='button';card.className='aurora-catalog-card';
    card.setAttribute('aria-label','Abrir '+title+' em 3D');
    const holder=document.createElement('span');holder.className='aurora-catalog-cover';
    fillImage(holder,button,title);
    const name=document.createElement('span');name.className='aurora-catalog-name';name.textContent=title;
    const type=document.createElement('span');type.className='aurora-catalog-type';
    const labels={pdf:'PDF',epub:'EPUB',txt:'TXT',audio:'AUDIOLIVRO',online:'ON-LINE',demo:'DEMONSTRAÇÃO'};
    type.textContent=labels[button.dataset.source]||'LIVRO';
    card.append(holder,name,type);
    card.addEventListener('click',()=>{
      close(false);
      // Reaproveita a entrada real: voo, giro, descrição e leitor do mesmo livro.
      button.click();
    });
    return card;
  }
  function render(){
    if(!current||overlay.hidden)return;
    const category=shelf.categories.find(item=>item.id===current);
    if(!category)return;
    const books=buttonsInCategory(current);
    $('auroraCatalogTitle').textContent=category.name;
    $('auroraCatalogTotal').textContent=showCount(books.length);
    const cards=books.slice(0,visible).map(cardFor);
    if(!cards.length){
      const empty=document.createElement('p');empty.className='aurora-catalog-empty';
      empty.textContent='Esta prateleira ainda não tem livros. Importe um livro para vê-lo aqui.';
      cards.push(empty);
    }
    grid.replaceChildren(...cards);
    more.hidden=books.length<=visible;
  }
  function close(restore=true){
    if(overlay.hidden)return;
    overlay.hidden=true;document.body.classList.remove('aurora-catalog-open');
    current=null;
    if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }
  function open(category){
    if(!shelf.categories.some(item=>item.id===category))return;
    if(!overlay.hidden)close(false);
    returnFocus=document.activeElement;
    current=category;visible=PAGE_SIZE;
    overlay.hidden=false;document.body.classList.add('aurora-catalog-open');
    render();overlay.scrollTop=0;
    $('auroraCatalogBack').focus({preventScroll:true});
  }
  $('auroraCatalogBack').addEventListener('click',()=>close());
  more.addEventListener('click',()=>{
    visible+=PAGE_SIZE;render();
    // Preserva o foco no controle caso ele ainda esteja visível.
    if(!more.hidden)more.focus({preventScroll:true});
    else grid.lastElementChild?.focus?.({preventScroll:true});
  });
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const all=Array.from(overlay.querySelectorAll('button:not([hidden]):not([disabled])'));
    if(!all.length)return;
    const first=all[0],last=all[all.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  // PDF, EPUB, áudio e títulos on-line entram nas prateleiras de modo assíncrono.
  // Quando a linha recebe ou perde um livro, o catálogo aberto se atualiza.
  const library=$('library');
  if(library&&typeof MutationObserver!=='undefined'){
    new MutationObserver(()=>{if(current&&!overlay.hidden)render();})
      .observe(library,{subtree:true,childList:true});
  }
  window.AuroraCatalogos={open,close};
})();
