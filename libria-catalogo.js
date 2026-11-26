/* Catálogo geral compartilhado por todas as estantes do LIBRIA - BOOK.
   Os gêneros e livros continuam vindo do acervo atual; este módulo não duplica arquivos. */
(()=> {
  'use strict';
  const $=id=>document.getElementById(id);
  const overlay=$('libriaCatalogHome'),grid=$('libriaGenreGrid'),search=$('libriaGenreSearch');
  const menu=$('libriaAppMenu'),menuToggle=$('libriaMenuToggle');
  function closeMenu(){if(!menu||!menuToggle)return;menu.hidden=true;menuToggle.setAttribute('aria-expanded','false');}
  menuToggle?.addEventListener('click',()=>{
    if(!menu)return;
    menu.hidden=!menu.hidden;
    menuToggle.setAttribute('aria-expanded',String(!menu.hidden));
  });
  menu?.addEventListener('click',event=>{
    if(event.target.closest('a')||event.target.closest('#statsButton'))closeMenu();
  });
  document.addEventListener('click',event=>{
    if(menu&&!menu.hidden&&!menu.contains(event.target)&&!menuToggle?.contains(event.target))closeMenu();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  const countLabel=$('libriaCatalogTotal');
  if(!overlay||!grid||!window.AuroraShelf)return;
  const icons={romance:'♡',adulto:'✦',ficcao:'◇',brasileiros:'✒',filmes:'▣',veterinaria:'♧'};
  let returnFocus=null;
  const countText=n=>n===1?'1 livro':n+' livros';
  function booksIn(category){
    const row=$('shelf-'+category);
    return row?[...row.querySelectorAll('.book-spine')]:[];
  }
  function render(){
    const categories=window.AuroraShelf.categories||[];
    const term=String(search.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const entries=categories.map(category=>({category,count:booksIn(category.id).length}))
      .filter(entry=>!term||entry.category.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(term));
    const total=new Set(categories.flatMap(category=>booksIn(category.id).map(button=>{
      const d=button.dataset;return d.bookId||((d.source||'demo')+':'+(d.rawTitle||d.title||''));
    }))).size;
    countLabel.textContent=countText(total);
    grid.replaceChildren();
    if(!entries.length){
      const empty=document.createElement('p');empty.className='libria-catalog-empty';empty.textContent='Nenhum gênero encontrado.';
      grid.append(empty);return;
    }
    for(const {category,count} of entries){
      const button=document.createElement('button');button.type='button';button.className='libria-genre-card';
      button.dataset.genre=category.id;
      const icon=document.createElement('span');icon.className='libria-genre-icon';icon.setAttribute('aria-hidden','true');icon.textContent=icons[category.id]||'▤';
      const info=document.createElement('span');info.className='libria-genre-info';
      const name=document.createElement('strong');name.textContent=category.name;
      const amount=document.createElement('small');amount.textContent=countText(count);
      info.append(name,amount);
      const arrow=document.createElement('span');arrow.className='libria-genre-arrow';arrow.textContent='›';
      button.append(icon,info,arrow);grid.append(button);
    }
  }
  function open(){
    returnFocus=document.activeElement;
    render();overlay.hidden=false;document.body.classList.add('libria-catalog-open');
    search.value='';render();search.focus({preventScroll:true});
  }
  function close(){
    overlay.hidden=true;document.body.classList.remove('libria-catalog-open');
    if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }
  $('openCatalogButton')?.addEventListener('click',open);
  $('shelfCatalogButton')?.addEventListener('click',()=>window.AuroraEstanteExemplares?.openPicker());
  $('libriaCatalogClose')?.addEventListener('click',close);
  search.addEventListener('input',render);
  grid.addEventListener('click',event=>{
    const button=event.target.closest('button[data-genre]');
    if(!button)return;
    const category=button.dataset.genre;
    close();
    window.AuroraCatalogos?.open(category);
  });
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!overlay.hidden)close();});
  for(const name of ['aurora:library-data','aurora:shelves-drawn','aurora:online-books-ready','aurora:book-cover-updated']){
    document.addEventListener(name,()=>{if(!overlay.hidden)render();});
  }
  window.LibriaCatalogo={open,close,refresh:render};
  const params=new URLSearchParams(location.search);
  if(params.get('catalogo')==='1'){
    params.delete('catalogo');params.delete('importado');
    const clean=location.pathname+(params.toString()?'?'+params.toString():'')+location.hash;
    history.replaceState(history.state,'',clean);
    requestAnimationFrame(open);
  }
})();
