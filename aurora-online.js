/* Busca federada: sem abrir outros sites nem baixar livros automaticamente. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const STORE='aurora-online-books-v1';
  const shelves=[['romance','Romances'],['adulto','Romances picantes'],['ficcao','Ficção e aventuras'],['brasileiros','Autores brasileiros']];
  const allowedWikis=['pt.wikisource.org','pt.wikibooks.org','en.wikisource.org'];
  let mode='book',token=0,results=[],shown=12;
  const clean=s=>String(s||'').trim().slice(0,180);
  const norm=s=>clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const element=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node;};
  const status=s=>{$('searchStatus').textContent=s;};
  const saved=()=>{try{const value=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(value)?value:[];}catch{return [];}};
  const category=(title,author)=>{
    const name=norm(title+' '+author);
    if(/machado de assis|aluisio azevedo|jose de alencar|dom casmurro|memorias postumas|o cortico|iracema/.test(name))return 'brasileiros';
    if(/austen|orgulho|preconceito|sensibilidade|moreninha|romance|amor|persuasao/.test(name))return 'romance';
    return 'ficcao';
  };
  const readerURL=item=>{
    const q=new URLSearchParams();
    if(item.source==='wikisource'||item.source==='wikibooks'){
      if(!allowedWikis.includes(item.wikiHost)||!item.wikiTitle)return '';
      q.set('tipo','wiki');q.set('fonte',item.wikiHost);q.set('titulo',item.wikiTitle);
    }else if(['openlibrary','archive','archive-audio'].includes(item.source)){
      if(!/^[a-zA-Z0-9_-]{3,100}$/.test(item.archiveId||''))return '';
      q.set('tipo',item.kind==='audio'?'audio':'arquivo');q.set('identificador',item.archiveId);
    }else if(item.source==='librivox'){
      if(!/^\d+$/.test(String(item.librivoxId)))return '';
      q.set('tipo','librivox');q.set('id',String(item.librivoxId));
    }else return '';
    q.set('nome',item.title||'');return './ler-online.html?'+q.toString();
  };
  async function json(url){
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),8500);
    try{const response=await fetch(url,{signal:ctrl.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.json();}
    finally{clearTimeout(timeout);}
  }
  async function wiki(host,query){
    const params=new URLSearchParams({action:'query',list:'search',srsearch:query,srnamespace:'0',srlimit:'24',format:'json',formatversion:'2',origin:'*'});
    const data=await json('https://'+host+'/w/api.php?'+params);
    const source=host.includes('wikibooks')?'wikibooks':'wikisource';
    const wanted=norm(query);
    return (data.query?.search||[]).filter(x=>
      x.title&&Number.isInteger(x.pageid)&&(norm(x.title).includes(wanted)||norm(x.title.replace(/\//g,' ')).includes(wanted))
    ).map(x=>({
      key:source+':'+host+':'+x.pageid,title:clean(x.title.replace(/_/g,' ')),
      author:'Texto de acesso livre',source,wikiHost:host,wikiTitle:x.title,kind:'book',
      language:host.startsWith('pt')?'Português':'Inglês'
    }));
  }
  async function openLibrary(query,language){
    const params=new URLSearchParams({q:query,fields:'key,title,author_name,ia,cover_i,public_scan_b,ebook_access,language',limit:'30',lang:language==='pt'?'pt':'en'});
    const data=await json('https://openlibrary.org/search.json?'+params);
    return (data.docs||[]).filter(x=>x.public_scan_b===true&&
      (x.ebook_access==='public'||x.ebook_access==null)&&Array.isArray(x.ia)&&x.ia.length&&
      (language!=='pt'||!Array.isArray(x.language)||x.language.some(l=>['por','pt'].includes(l)))
    ).map(x=>({
      key:'openlibrary:'+x.key,title:clean(x.title),author:clean((x.author_name||[]).slice(0,2).join(', '))||'Autor não informado',
      source:'openlibrary',archiveId:String(x.ia[0]),kind:'book',language:'Edição digitalizada',
      cover:Number.isInteger(x.cover_i)&&x.cover_i>0?'https://covers.openlibrary.org/b/id/'+x.cover_i+'-M.jpg':''
    }));
  }
  async function archive(query,audio,language){
    const term=query.replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,60);
    const q=audio?'collection:librivoxaudio AND mediatype:audio AND (title:("'+term+'") OR creator:("'+term+'"))'
      :'collection:gutenberg AND mediatype:texts AND title:("'+term+'")';
    const params=new URLSearchParams({q,rows:'24',output:'json'});
    for(const field of ['identifier','title','creator','language'])params.append('fl[]',field);
    const data=await json('https://archive.org/advancedsearch.php?'+params);
    return (data.response?.docs||[]).filter(x=>{
      if(!/^[a-zA-Z0-9_-]{3,100}$/.test(x.identifier||''))return false;
      if(language!=='pt')return true;
      const available=Array.isArray(x.language)?x.language:[x.language||''];
      return available.some(l=>/portugu|^pt$|^por$/i.test(String(l)));
    }).map(x=>({
      key:'archive:'+x.identifier,title:clean(x.title),
      author:clean(Array.isArray(x.creator)?x.creator.join(', '):x.creator)||'Autor não informado',
      source:audio?'archive-audio':'archive',archiveId:x.identifier,kind:audio?'audio':'book',
      language:clean(Array.isArray(x.language)?x.language.join(', '):x.language)||'Idioma não informado'
    }));
  }
  async function librivox(query,language){
    const data=await json('https://librivox.org/api/feed/audiobooks/?title='+encodeURIComponent(query)+'&format=json&limit=50');
    return (data.books||[]).filter(x=>/^\d+$/.test(String(x.id))&&(language!=='pt'||/portugu/i.test(x.language||''))).map(x=>({
      key:'librivox:'+x.id,title:clean(x.title),
      author:clean((x.authors||[]).map(a=>[a.first_name,a.last_name].filter(Boolean).join(' ')).join(', '))||'Autor não informado',
      source:'librivox',librivoxId:String(x.id),kind:'audio',language:x.language||'Idioma não informado',duration:x.totaltime||''
    }));
  }
  function found(query){
    const seen=new Set(),term=norm(query);
    const items=results.filter(x=>{if(!x.title||!readerURL(x)||seen.has(x.key))return false;seen.add(x.key);return true;});
    const score=x=>{const s=norm(x.title);return s===term?0:s.startsWith(term)?1:s.includes(term)?2:norm(x.author).includes(term)?3:4;};
    return items.sort((a,b)=>score(a)-score(b));
  }
  function card(item){
    const card=element('article','result-card'),cover=element('div','result-cover');
    cover.setAttribute('aria-hidden','true');
    if(item.cover){
      const image=element('img','result-cover-image');image.src=item.cover;image.alt='';image.loading='lazy';
      image.onerror=()=>{image.remove();cover.append(element('span','',item.kind==='audio'?'♫':'▤'));};cover.append(image);
    }else cover.append(element('span','',item.kind==='audio'?'♫':'▤'));
    const body=element('div','result-body');
    body.append(element('h2','',item.title),element('p','',item.author),element('p','',item.kind==='audio'?'♫ Audiolivro disponível':'▤ Edição para ler online'));
    if(item.duration)body.append(element('p','',item.duration));
    const label=element('label','result-category-label','Guardar na estante: '),selector=element('select');
    for(const [id,name] of shelves){const option=element('option','',name);option.value=id;selector.append(option);}
    selector.value=category(item.title,item.author);label.append(selector);body.append(label);
    const actions=element('div','result-actions'),open=element('a','',item.kind==='audio'?'♫ Ouvir na Aurora':'▤ Ler na Aurora');
    open.href=readerURL(item);
    const save=element('button','secondary','＋ Adicionar à estante');save.type='button';
    const mark=()=>{save.textContent='✓ Na estante';save.disabled=true;save.classList.add('added');};
    if(saved().some(x=>x.key===item.key))mark();
    save.addEventListener('click',()=>{
      try{const records=saved();if(!records.some(x=>x.key===item.key)){
        records.push({...item,category:selector.value,addedAt:Date.now()});
        localStorage.setItem(STORE,JSON.stringify(records));
      }mark();status('“'+item.title+'” foi adicionado à estante. Nenhum arquivo foi baixado.');
      }catch{status('Não foi possível salvar o livro no celular. Verifique o armazenamento.');}
    });
    actions.append(open,save);body.append(actions);card.append(cover,body);return card;
  }
  function render(query){
    const items=found(query);
    $('results').replaceChildren();
    const fragment=document.createDocumentFragment();for(const item of items.slice(0,shown))fragment.append(card(item));
    $('results').append(fragment);$('pager').hidden=items.length<=shown;
    if(items.length)status(items.length+(items.length===1?' resultado disponível.':' resultados disponíveis.')+' Escolha um para abrir na Aurora.');
  }
  const busy=value=>{$('searchButton').disabled=value;$('searchButton').textContent=value?'Buscando…':'⌕ Buscar';};
  async function search(){
    const query=$('searchText').value.trim();if(query.length<2){status('Digite pelo menos duas letras.');return;}
    const request=++token,language=$('languageChoice').value;results=[];shown=12;
    $('results').replaceChildren();$('pager').hidden=true;busy(true);status('Buscando nas bibliotecas disponíveis…');
    const sources=mode==='audio'?[()=>librivox(query,language),()=>archive(query,true,language)]:[
      ()=>wiki('pt.wikisource.org',query),()=>openLibrary(query,language),
      ()=>wiki('pt.wikibooks.org',query),()=>archive(query,false,language)
    ];
    if(mode==='book'&&language==='all')sources.push(()=>wiki('en.wikisource.org',query));
    let failures=0,completed=0;
    await Promise.all(sources.map(async load=>{
      try{const books=await load();if(request!==token)return;results.push(...books);render(query);}
      catch(error){failures++;console.warn('Fonte indisponível:',error);}
      finally{completed++;if(request===token&&completed<sources.length&&!results.length)status('Tentando outras bibliotecas…');}
    }));
    if(request!==token)return;busy(false);
    if(!found(query).length)status(failures===sources.length?'Os catálogos não responderam. Tente novamente mais tarde.'
      :'Não encontramos uma edição com leitura dentro da Aurora. Experimente outro título ou todos os idiomas.');
    else render(query);
  }
  function switchMode(value){
    token++;mode=value;results=[];$('results').replaceChildren();$('pager').hidden=true;busy(false);
    $('tabBooks').classList.toggle('active',mode==='book');$('tabAudio').classList.toggle('active',mode==='audio');
    $('tabBooks').setAttribute('aria-pressed',String(mode==='book'));$('tabAudio').setAttribute('aria-pressed',String(mode==='audio'));
    status(mode==='book'?'Procure um livro pelo título ou autor.':'Procure um audiolivro pelo título.');
    if($('searchText').value.trim().length>1)search();
  }
  $('searchForm').addEventListener('submit',e=>{e.preventDefault();search();});
  $('tabBooks').addEventListener('click',()=>switchMode('book'));
  $('tabAudio').addEventListener('click',()=>switchMode('audio'));
  $('languageChoice').addEventListener('change',()=>{token++;if($('searchText').value.trim().length>1)search();});
  $('moreResults').addEventListener('click',()=>{shown+=12;render($('searchText').value.trim());});
  document.querySelectorAll('[data-search-example]').forEach(button=>button.addEventListener('click',()=>{$('searchText').value=button.dataset.searchExample;search();}));
  const initial=new URLSearchParams(location.search).get('q');
  if(initial){$('searchText').value=initial.slice(0,90);search();}
})();
