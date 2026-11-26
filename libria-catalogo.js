/* Tela inicial: um único acervo, filtros de gênero e navegação para as estantes. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const home=$('libriaCatalogHome'),tabs=$('libriaGenreGrid'),books=$('libriaHomeBooks');
  const search=$('libriaGenreSearch'),searchWrap=$('libriaHomeSearchWrap'),searchToggle=$('libriaSearchToggle');
  const more=$('libriaCatalogMore'),count=$('libriaCatalogTotal'),heading=$('libriaCatalogHeading');
  const menu=$('libriaAppMenu'),menuToggle=$('libriaMenuToggle');
  function closeMenu(){if(!menu||!menuToggle)return;menu.hidden=true;menuToggle.setAttribute('aria-expanded','false');}
  menuToggle?.addEventListener('click',()=>{
    if(!menu)return;
    menu.hidden=!menu.hidden;
    menuToggle.setAttribute('aria-expanded',String(!menu.hidden));
  });
  menu?.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
  document.addEventListener('click',event=>{
    if(menu&&!menu.hidden&&!menu.contains(event.target)&&!menuToggle?.contains(event.target))closeMenu();
  });
  if(!home||!tabs||!books||!search||!more||!window.AuroraShelf)return;
  const PAGE_SIZE=24;
  let genre='',visible=PAGE_SIZE,tabSignature='',view='',lastShelfId='',frame=0;
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const countText=n=>n===1?'1 livro':n+' livros';
  const categories=()=>window.AuroraShelf.categories||[];
  function booksIn(category){
    const row=$('shelf-'+category);
    return row?[...row.querySelectorAll('.book-spine')]:[];
  }
  function collectBooks(){
    const result=[],seen=new Set();
    const chosen=genre?categories().filter(c=>c.id===genre):categories();
    const term=normalize(search.value);
    for(const category of chosen){
      for(const button of booksIn(category.id)){
        const d=button.dataset;
        const source=d.source||'demo';
        const key=(d.bookId&&source!=='online'?'arquivo':source)+':'+(d.bookId||d.rawTitle||d.title||'');
        const title=window.AuroraTitles?.display(d.rawTitle)||d.rawTitle||button.querySelector('.spine-title')?.textContent||'';
        if(seen.has(key)||!normalize(title+' '+(d.author||'')).includes(term))continue;
        seen.add(key);result.push(button);
      }
    }
    return result;
  }
  function renderTabs(){
    const entries=[{id:'',name:'Todos'},...categories()];
    const signature=JSON.stringify(entries.map(c=>[c.id,c.name]));
    if(signature!==tabSignature){
      tabSignature=signature;
      tabs.replaceChildren();
      for(const entry of entries){
        const button=document.createElement('button');button.type='button';button.className='libria-genre-tab';
        button.dataset.genre=entry.id;button.textContent=entry.name;tabs.append(button);
      }
    }
    if(genre&&!entries.some(c=>c.id===genre))genre='';
    for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.genre===genre));
  }
  function render(){
    if(home.hidden)return;
    renderTabs();
    const items=collectBooks();
    const selected=categories().find(c=>c.id===genre);
    heading.textContent=selected?selected.name:'Meu catálogo';
    count.textContent=countText(items.length);
    const cards=items.slice(0,visible).map(button=>window.AuroraCatalogPreview?.homeCardFor(button)).filter(Boolean);
    books.replaceChildren(...cards);
    if(!items.length){
      const empty=document.createElement('p');empty.className='libria-catalog-empty';
      empty.textContent=search.value.trim()?'Nenhum livro corresponde à pesquisa.':genre?'Ainda não há livros neste gênero. Importe um livro para começar.':'Seu catálogo está vazio. Toque em + para importar um livro.';
      books.append(empty);
    }
    more.hidden=items.length<=visible;
  }
  function schedule(){
    if(home.hidden||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;render();});
  }
  function shelfView(url){
    return url.searchParams.get('estantes')==='1'||url.searchParams.has('estante')||url.searchParams.get('livros')==='1';
  }
  function syncView(refreshShelf=false){
    const url=new URL(location.href);
    const next=shelfView(url)?'shelves':'catalog';
    const changed=view!==next;
    view=next;
    home.hidden=next!=='catalog';
    document.body.classList.toggle('libria-catalog-view',next==='catalog');
    if(next==='shelves'){
      lastShelfId=url.searchParams.get('estante')||'';
      if(refreshShelf)window.AuroraMinhasEstantes?.refresh();
      if(changed||refreshShelf)requestAnimationFrame(()=>window.AuroraEstanteExemplares?.layout());
    }else render();
    if(changed)window.scrollTo(0,0);
  }
  function goCatalog(reset=false){
    const url=new URL(location.href);
    if(shelfView(url))lastShelfId=url.searchParams.get('estante')||'';
    for(const key of ['estante','estantes','livros','catalogo','importado'])url.searchParams.delete(key);
    if(reset){genre='';search.value='';visible=PAGE_SIZE;}
    if(url.href!==location.href)history.pushState(null,'',url);
    closeMenu();syncView();
  }
  function goShelves(){
    const url=new URL(location.href);
    for(const key of ['catalogo','importado','livros','estante'])url.searchParams.delete(key);
    url.searchParams.set('estantes','1');
    if(lastShelfId)url.searchParams.set('estante',lastShelfId);
    if(url.href!==location.href)history.pushState(null,'',url);
    closeMenu();syncView(true);
  }
  function setSearchOpen(open){
    searchWrap.hidden=!open;
    searchToggle?.setAttribute('aria-expanded',String(open));
    if(open)search.focus({preventScroll:true});
    else if(search.value){search.value='';visible=PAGE_SIZE;render();}
  }
  $('openCatalogButton')?.addEventListener('click',()=>goCatalog());
  $('libriaGoShelves')?.addEventListener('click',goShelves);
  $('shelfCatalogButton')?.addEventListener('click',()=>window.AuroraEstanteExemplares?.openPicker());
  searchToggle?.addEventListener('click',()=>{
    if(home.hidden){goCatalog();setSearchOpen(true);}
    else setSearchOpen(searchWrap.hidden);
  });
  tabs.addEventListener('click',event=>{
    const button=event.target.closest('button[data-genre]');
    if(!button||!tabs.contains(button))return;
    genre=button.dataset.genre||'';visible=PAGE_SIZE;render();
  });
  search.addEventListener('input',()=>{visible=PAGE_SIZE;render();});
  more.addEventListener('click',()=>{visible+=PAGE_SIZE;render();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeMenu();if(!home.hidden&&!searchWrap.hidden&&document.activeElement===search)setSearchOpen(false);}
  });
  for(const name of ['aurora:library-data','aurora:shelves-drawn','aurora:online-books-ready','aurora:book-cover-updated','aurora:shelf-visibility']){
    document.addEventListener(name,schedule);
  }
  // A mudança de gênero no leitor move a mesma referência entre os grupos.
  if(typeof MutationObserver!=='undefined'&&$('library')){
    new MutationObserver(schedule).observe($('library'),{childList:true,subtree:true});
  }
  window.addEventListener('popstate',()=>syncView());
  window.addEventListener('pageshow',()=>syncView());
  window.LibriaCatalogo={open:()=>goCatalog(true),close:goShelves,refresh:render};
  const params=new URLSearchParams(location.search);
  if(params.get('catalogo')==='1'){
    const url=new URL(location.href);
    for(const key of ['catalogo','importado','estantes','estante','livros'])url.searchParams.delete(key);
    history.replaceState(history.state,'',url);
  }
  syncView();
})();
