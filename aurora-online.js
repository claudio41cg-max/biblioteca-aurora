/* Catálogos públicos: somente metadados e links. Nenhum download automático. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const STORAGE='aurora-online-books-v1';
  const categories=[['romance','Romances'],['adulto','Romances picantes'],['ficcao','Ficção e aventuras'],['brasileiros','Autores brasileiros']];
  let mode='books',nextPage='',lastTerm='',serial=0;
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const status=message=>{$('searchStatus').textContent=message;};
  const readSaved=()=>{try{const data=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(data)?data:[];}catch{return [];}};
  const safeURL=(raw,domain)=>{
    try{const url=new URL(raw);return url.protocol==='https:'&&(url.hostname===domain||url.hostname.endsWith('.'+domain))?url.href:null;}catch{return null;}
  };
  const guessCategory=(title,author)=>{
    const text=normalize(title+' '+author);
    if(/machado de assis|aluisio azevedo|jose de alencar|dom casmurro|memorias postumas|o cortico|iracema/.test(text))return 'brasileiros';
    if(/austen|orgulho|preconceito|sensibilidade|moreninha|romance|amor/.test(text))return 'romance';
    return 'ficcao';
  };
  const sourceLink=()=>mode==='audio'?'https://librivox.org/search/':'https://www.gutenberg.org/ebooks/search/?query='+encodeURIComponent(lastTerm);
  const create=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node;};

  async function requestJSON(url){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('Falha na consulta ('+response.status+').');
      return await response.json();
    }finally{clearTimeout(timeout);}
  }
  function normalizeBooks(data){
    return (Array.isArray(data.results)?data.results:[]).filter(item=>Number.isInteger(item.id)&&item.id>0&&item.copyright!==true).map(item=>({
      key:'gutenberg:'+item.id,title:String(item.title||'Livro sem título'),
      author:(item.authors||[]).map(a=>a.name).filter(Boolean).join(', ')||'Autor não informado',
      language:(item.languages||[]).join(', ')||'Não informado',
      url:'https://www.gutenberg.org/ebooks/'+item.id,
      provider:'Project Gutenberg',kind:'book',symbol:'▤'
    }));
  }
  function normalizeAudio(data){
    return (Array.isArray(data.books)?data.books:[]).filter(item=>/^\d+$/.test(String(item.id))&&safeURL(item.url_librivox,'librivox.org')).map(item=>({
      key:'librivox:'+item.id,title:String(item.title||'Audiolivro sem título'),
      author:(item.authors||[]).map(a=>[a.first_name,a.last_name].filter(Boolean).join(' ')).filter(Boolean).join(', ')||'Autor não informado',
      language:String(item.language||'Não informado'),url:safeURL(item.url_librivox,'librivox.org'),
      provider:'LibriVox',kind:'audio',symbol:'♫',duration:item.totaltime||''
    }));
  }
  function updateSavedButton(button,key){
    if(readSaved().some(book=>book.key===key)){
      button.textContent='✓ Na estante';button.disabled=true;button.classList.add('added');
    }
  }
  function card(item){
    const article=create('article','result-card');
    const cover=create('div','result-cover');
    cover.setAttribute('aria-hidden','true');
    cover.append(create('span','',item.symbol),create('small','',item.kind==='audio'?'AUDIOLIVRO':'LIVRO ONLINE'));
    const body=create('div','result-body');
    body.append(create('h2','',item.title),create('p','',item.author),create('p','',item.provider+' · '+item.language));
    if(item.duration)body.append(create('p','',item.duration));
    const place=create('label','result-category-label','Guardar em: ');
    const select=create('select');
    for(const [value,label] of categories){const option=create('option','',label);option.value=value;select.append(option);}
    select.value=guessCategory(item.title,item.author);
    place.append(select);body.append(place);
    const actions=create('div','result-actions');
    const open=create('a','',item.kind==='audio'?'♫ Ouvir no LibriVox ↗':'▤ Ler no Gutenberg ↗');
    open.href=item.url;open.target='_blank';open.rel='noopener noreferrer';
    const save=create('button','secondary','＋ Adicionar à estante');
    save.type='button';updateSavedButton(save,item.key);
    save.addEventListener('click',()=>{
      try{
        const items=readSaved();
        if(!items.some(book=>book.key===item.key)){
          items.push({key:item.key,title:item.title.slice(0,180),author:item.author.slice(0,180),
            category:select.value,url:item.url,kind:item.kind,provider:item.provider,addedAt:Date.now()});
          localStorage.setItem(STORAGE,JSON.stringify(items));
        }
        updateSavedButton(save,item.key);
        status('Link de “'+item.title+'” guardado. Toque em “Minha estante” para encontrá-lo. Nenhum livro foi baixado.');
      }catch{status('O celular não permitiu salvar o link. Verifique o espaço e as permissões do navegador.');}
    });
    actions.append(open,save);body.append(actions);article.append(cover,body);
    return article;
  }
  function render(items,append=false){
    if(!append)$('results').replaceChildren();
    const fragment=document.createDocumentFragment();
    for(const item of items)fragment.append(card(item));
    $('results').append(fragment);
  }
  function setBusy(value){$('searchButton').disabled=value;$('searchButton').textContent=value?'Buscando…':'⌕ Buscar';$('moreResults').disabled=value;}
  function showFallback(error){
    $('fallback').hidden=false;
    $('publicSearchLink').href=sourceLink();
    $('publicSearchLink').textContent=mode==='audio'?'Pesquisar diretamente no LibriVox ↗':'Pesquisar diretamente no Gutenberg ↗';
    status(error==='empty'?'Nenhum resultado encontrado com esses filtros. Experimente outro título ou escolha “Todos os idiomas”.':'A consulta online está indisponível no momento. Use o link oficial abaixo.');
  }
  async function search(append=false){
    const query=$('searchText').value.trim();
    if(query.length<2){status('Digite pelo menos duas letras.');return;}
    if(!append){lastTerm=query;nextPage='';$('results').replaceChildren();}
    const thisRequest=++serial;
    $('fallback').hidden=true;$('pager').hidden=true;setBusy(true);
    status(append?'Carregando mais resultados…':'Buscando no catálogo público…');
    try{
      let items=[];
      if(mode==='books'){
        const url=append&&nextPage?nextPage:'https://gutendex.com/books/?search='+encodeURIComponent(query)+($('languageChoice').value==='pt'?'&languages=pt':'');
        if(!safeURL(url,'gutendex.com'))throw new Error('Endereço de catálogo inválido.');
        const data=await requestJSON(url);
        if(thisRequest!==serial)return;
        items=normalizeBooks(data);
        nextPage=safeURL(data.next,'gutendex.com')||'';
        $('pager').hidden=!nextPage;
      }else{
        const url='https://librivox.org/api/feed/audiobooks/?title='+encodeURIComponent(query)+'&format=json&limit=50';
        const data=await requestJSON(url);
        if(thisRequest!==serial)return;
        items=normalizeAudio(data);
        if($('languageChoice').value==='pt')items=items.filter(book=>/portugu|português/i.test(book.language));
      }
      render(items,append);
      if(!items.length&&!append){showFallback('empty');return;}
      status(items.length+(items.length===1?' resultado encontrado.':' resultados nesta página.')+' Toque em “Ler” ou “Ouvir” para acessar a obra sem baixar.');
    }catch(error){
      if(thisRequest!==serial)return;
      console.warn('Busca online da Aurora:',error);
      showFallback(error);
    }finally{if(thisRequest===serial)setBusy(false);}
  }
  function changeMode(value){
    serial++;mode=value;nextPage='';$('results').replaceChildren();$('fallback').hidden=true;$('pager').hidden=true;
    $('tabBooks').classList.toggle('active',mode==='books');$('tabAudio').classList.toggle('active',mode==='audio');
    $('tabBooks').setAttribute('aria-pressed',String(mode==='books'));
    $('tabAudio').setAttribute('aria-pressed',String(mode==='audio'));
    status(mode==='audio'?'Procure um audiolivro pelo título no LibriVox.':'Procure um livro pelo título ou autor no Project Gutenberg.');
    if($('searchText').value.trim().length>1)search();
  }
  $('searchForm').addEventListener('submit',event=>{event.preventDefault();search();});
  $('tabBooks').addEventListener('click',()=>changeMode('books'));
  $('tabAudio').addEventListener('click',()=>changeMode('audio'));
  $('languageChoice').addEventListener('change',()=>{serial++;if($('searchText').value.trim().length>1)search();});
  $('moreResults').addEventListener('click',()=>{if(nextPage)search(true);});
  document.querySelectorAll('[data-search-example]').forEach(button=>button.addEventListener('click',()=>{
    $('searchText').value=button.dataset.searchExample;search();
  }));
})();
