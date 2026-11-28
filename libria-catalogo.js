/* Catálogo inicial do LIBRIA - BOOK: livros 3D, gêneros e paginação independente. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const home=$('libriaCatalogHome'),tabs=$('libriaGenreGrid'),books=$('libriaHomeBooks');
  const search=$('libriaGenreSearch'),searchWrap=$('libriaHomeSearchWrap'),searchToggle=$('libriaSearchToggle');
  const formatFilter=$('libriaFormatFilter'),sortOrder=$('libriaSortOrder');
  const count=$('libriaCatalogTotal'),heading=$('libriaCatalogHeading');
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
  const preview=window.AuroraCatalogPreview;
  if(!home||!tabs||!books||!search||!window.AuroraShelf||!preview)return;
  const PAGE_SIZE=preview.homePageSize;
  let genre='',tabSignature='',view='',lastShelfId='',frame=0;
  const visibleByGenre=new Map();
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
  const searchIndex=new WeakMap();
  let cardObserver=null;
  const countText=n=>n===1?'1 livro':n+' livros';
  const categories=()=>window.AuroraShelf.categories||[];
  function booksIn(category){
    const row=$('shelf-'+category);
    return row?[...row.querySelectorAll('.book-spine')]:[];
  }
  function indexedBook(button){
    const data=button.dataset;
    const raw=String(data.rawTitle||data.title||button.querySelector('.spine-title')?.textContent||'');
    const author=String(data.author||'');
    const cached=searchIndex.get(button);
    if(cached&&cached.raw===raw&&cached.author===author)return cached;
    const title=window.AuroraTitles?.display(raw)||raw;
    const entry={raw,author,title,search:normalize(title+' '+author),created:Number(data.created||0)};
    searchIndex.set(button,entry);
    return entry;
  }
  function collectBooks(categoryId){
    const result=[],seen=new Set(),term=normalize(search.value),format=formatFilter?.value||'',order=sortOrder?.value||'title';
    for(const button of booksIn(categoryId)){
      const d=button.dataset;
      const source=d.source||'demo';
      if(format&&source!==format)continue;
      const key=(d.bookId&&source!=='online'?'arquivo':source)+':'+(d.bookId||d.rawTitle||d.title||'');
      const indexed=indexedBook(button);
      if(seen.has(key)||!indexed.search.includes(term))continue;
      seen.add(key);result.push(button);
    }
    result.sort((a,b)=>{
      const left=indexedBook(a),right=indexedBook(b);
      if(order==='recent')return right.created-left.created||collator.compare(left.title,right.title);
      if(order==='author')return collator.compare(left.author,right.author)||collator.compare(left.title,right.title);
      return collator.compare(left.title,right.title);
    });
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
  function hydrateVisibleSections(sections){
    cardObserver?.disconnect();
    cardObserver=null;
    const pending=sections.filter(section=>section.dataset.cardsPending==='true');
    if(!pending.length)return;
    if(typeof IntersectionObserver==='undefined'){
      pending.forEach(section=>preview.hydrateHomeSection?.(section));
      return;
    }
    cardObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        cardObserver?.unobserve(entry.target);
        preview.hydrateHomeSection?.(entry.target);
      }
    },{root:null,rootMargin:'520px 0px'});
    pending.forEach(section=>cardObserver.observe(section));
  }
  function render(){
    if(home.hidden)return;
    renderTabs();
    const selected=categories().find(c=>c.id===genre);
    heading.textContent=selected?selected.name:'Meu catálogo';
    const chosen=genre?categories().filter(c=>c.id===genre):categories();
    const sections=[];
    let total=0;
    for(const category of chosen){
      const items=collectBooks(category.id);
      total+=items.length;
      if(!items.length&&!genre)continue;
      sections.push(preview.homeSectionFor(category,items,{
        deferCards:true,
        limit:visibleByGenre.get(category.id)||PAGE_SIZE,
        emptyMessage:search.value.trim()||formatFilter?.value
          ?'Nenhum livro corresponde à pesquisa ou aos filtros selecionados.'
          :'Ainda não há livros neste gênero. Importe um livro para começar.'
      }));
    }
    count.textContent=countText(total);
    books.replaceChildren(...sections);
    hydrateVisibleSections(sections);
    if(!total){
      const empty=document.createElement('p');empty.className='libria-catalog-empty';
      empty.textContent=search.value.trim()||formatFilter?.value?'Nenhum livro corresponde à pesquisa ou aos filtros selecionados.':'Seu catálogo está vazio. Toque em + para importar um livro.';
      books.append(empty);
    }
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
    if(reset){genre='';search.value='';if(formatFilter)formatFilter.value='';if(sortOrder)sortOrder.value='title';visibleByGenre.clear();}
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
    else if(search.value||formatFilter?.value||sortOrder?.value!=='title'){
      search.value='';if(formatFilter)formatFilter.value='';if(sortOrder)sortOrder.value='title';
      visibleByGenre.clear();render();
    }
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
    genre=button.dataset.genre||'';render();
  });
  search.addEventListener('input',()=>{visibleByGenre.clear();render();});
  formatFilter?.addEventListener('change',()=>{visibleByGenre.clear();render();});
  sortOrder?.addEventListener('change',()=>{visibleByGenre.clear();render();});
  books.addEventListener('click',event=>{
    const button=event.target.closest('button[data-more-genre]');
    if(!button||!books.contains(button))return;
    const id=button.dataset.moreGenre;
    visibleByGenre.set(id,(visibleByGenre.get(id)||PAGE_SIZE)+PAGE_SIZE);
    render();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeMenu();if(!home.hidden&&!searchWrap.hidden&&document.activeElement===search)setSearchOpen(false);}
  });
  for(const name of ['aurora:library-data','aurora:shelves-drawn','aurora:online-books-ready','aurora:book-cover-updated','aurora:shelf-visibility']){
    document.addEventListener(name,schedule);
  }
  // Novos arquivos são desenhados na linha do gênero escolhido e aparecem aqui sem cópia.
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
    genre='';search.value='';if(formatFilter)formatFilter.value='';if(sortOrder)sortOrder.value='title';visibleByGenre.clear();
  }
  syncView();
})();
