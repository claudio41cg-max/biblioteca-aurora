/* Leitor de obras abertas dentro da Aurora. Arquivos locais e livro 3D não são alterados. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const type=params.get('tipo'),host=params.get('fonte'),bookTitle=params.get('titulo')||'';
  const id=params.get('identificador')||'',audioId=params.get('id')||'';
  const title=params.get('nome')||bookTitle||'Leitura online';
  const allowedWikis=['pt.wikisource.org','pt.wikibooks.org','en.wikisource.org'];
  const status=message=>{$('onlineStatus').textContent=message;};
  const json=async url=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),13000);
    try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response.json();}
    finally{clearTimeout(timer);}
  };
  $('onlineTitle').textContent=title.slice(0,180);
  let pages=[],currentPage=0,currentText='',chapterTitle=bookTitle;
  const pageSize=()=>window.matchMedia?.('(max-width:600px)').matches?1:2;
  function showPage(){
    if(!pages.length)return;
    const step=pageSize();
    $('onlineLeft').textContent=pages[currentPage]||'';
    $('onlineRight').textContent=pages[currentPage+1]||'';
    $('onlineCounter').textContent=(currentPage+1)+' de '+pages.length+' páginas';
    $('onlinePrev').disabled=currentPage<=0;
    $('onlineNext').disabled=currentPage+step>=pages.length;
    try{sessionStorage.setItem('aurora-online-page:'+host+':'+chapterTitle,String(currentPage));}catch{}
  }
  function splitPages(text){
    const blocks=text.split(/\n{2,}/).map(x=>x.trim()).filter(Boolean);
    let buffer='',parts=[];
    for(let block of blocks){
      while(block.length>950){if(buffer){parts.push(buffer);buffer='';}parts.push(block.slice(0,950));block=block.slice(950);}
      if(buffer.length+block.length>950&&buffer){parts.push(buffer);buffer='';}
      if(block)buffer+=(buffer?'\n\n':'')+block;
    }
    if(buffer)parts.push(buffer);
    return parts.length?parts:['Não foi possível extrair o texto desta página.'];
  }
  function cleanWikiHTML(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const root=doc.querySelector('.mw-parser-output')||doc.body;
    root.querySelectorAll('script,style,nav,form,table,.mw-editsection,.reference,.reflist,.toc,.navbox,.metadata,.noprint,.mw-collapsible,.plainlinks').forEach(node=>node.remove());
    const pieces=Array.from(root.querySelectorAll('h2,h3,p,blockquote,pre')).map(node=>node.textContent.trim()).filter(Boolean);
    return (pieces.length?pieces.join('\n\n'):root.textContent).replace(/[ \t]{2,}/g,' ').replace(/\n{4,}/g,'\n\n').trim().slice(0,300000);
  }
  async function wikiPage(page){
    chapterTitle=page;status('Abrindo as páginas do livro…');
    const q=new URLSearchParams({action:'parse',page,prop:'text',format:'json',formatversion:'2',origin:'*'});
    const data=await json('https://'+host+'/w/api.php?'+q);
    if(!data.parse?.text)throw Error('Não foi possível carregar este capítulo.');
    currentText=cleanWikiHTML(data.parse.text);
    pages=splitPages(currentText);
    const old=Number(sessionStorage.getItem('aurora-online-page:'+host+':'+page)||0);
    currentPage=Math.max(0,Math.min(Number.isFinite(old)?old:0,pages.length-1));
    $('wikiReader').hidden=false;showPage();
    status('Leitura online, sem arquivo salvo no celular.');
  }
  async function listChapters(){
    if(bookTitle.includes('/'))return [bookTitle];
    let chapters=[bookTitle],more='',attempts=0;
    do{
      const q=new URLSearchParams({action:'query',list:'allpages',apprefix:bookTitle+'/',apnamespace:'0',aplimit:'100',format:'json',formatversion:'2',origin:'*'});
      if(more)q.set('apcontinue',more);
      try{
        const data=await json('https://'+host+'/w/api.php?'+q);
        chapters.push(...(data.query?.allpages||[]).map(x=>x.title).filter(Boolean));
        more=data.continue?.apcontinue||'';
      }catch{more='';}
      attempts++;
    }while(more&&attempts<3);
    const order=new Intl.Collator('pt',{numeric:true,sensitivity:'base'});
    return [bookTitle,...[...new Set(chapters.slice(1))].sort(order.compare)];
  }
  async function openWiki(){
    if(!allowedWikis.includes(host)||!bookTitle||bookTitle.length>180)throw Error('Livro inválido.');
    $('onlineCredit').textContent='Texto do acervo colaborativo Wikisource/Wikilivros (Wikimedia). O material pode ser de domínio público ou ter licença livre com exigência de atribuição e compartilhamento.';
    const chaptersPromise=listChapters();
    await wikiPage(bookTitle);
    const chapters=await chaptersPromise;
    const selector=$('onlineChapter');
    selector.replaceChildren();
    for(const chapter of chapters){const option=document.createElement('option');option.value=chapter;option.textContent=chapter.replace(bookTitle+'/','');selector.append(option);}
    selector.value=bookTitle;
    $('onlineChapter').parentElement.hidden=chapters.length<=1;
    if(currentText.length<450&&chapters.length>1){selector.value=chapters[1];await wikiPage(chapters[1]);}
    selector.addEventListener('change',async()=>{
      try{await wikiPage(selector.value);}catch(error){status('Este capítulo não está disponível: '+error.message);}
    });
  }
  function showArchive(audio){
    if(!/^[a-zA-Z0-9_-]{3,100}$/.test(id))throw Error('Identificação de arquivo inválida.');
    $('embeddedReader').hidden=false;
    $('readerFrame').src='https://archive.org/'+(audio?'embed/':'stream/')+encodeURIComponent(id)+(audio?'':'?ui=embed');
    $('onlineCredit').textContent='Edição hospedada pelo Internet Archive. Para livros digitalizados, o leitor foi incorporado conforme as condições disponibilizadas pelo acervo. Consulte os direitos da obra antes de reutilizá-la.';
    status(audio?'Audiolivro disponível para reprodução online.':'Livro aberto no leitor da Aurora.');
  }
  function safeAudio(raw){
    try{
      const url=new URL(raw);if(url.protocol==='http:')url.protocol='https:';
      const domain=url.hostname;
      if(url.protocol==='https:'&&(domain==='archive.org'||domain.endsWith('.archive.org')||domain==='librivox.org'||domain.endsWith('.librivox.org')))return url.href;
    }catch{}
    return null;
  }
  async function openLibriVox(){
    if(!/^\d+$/.test(audioId))throw Error('Identificação de áudio inválida.');
    const url='https://librivox.org/api/feed/audiobooks/?id='+audioId+'&format=json&extended=1';
    const data=await json(url),book=data.books?.[0];
    if(!book)throw Error('Audiolivro indisponível.');
    const tracks=(book.sections||[]).map(part=>({title:part.title||'Faixa '+part.section_number,url:safeAudio(part.listen_url)})).filter(part=>part.url);
    if(!tracks.length)throw Error('Não há faixas de áudio acessíveis nesta edição.');
    $('onlineTitle').textContent=book.title||title;
    $('librivoxReader').hidden=false;
    const selector=$('audioChapter');
    for(const [index,part] of tracks.entries()){const option=document.createElement('option');option.value=String(index);option.textContent=(index+1)+'. '+part.title;selector.append(option);}
    const setTrack=()=>{$('onlineAudio').pause();$('onlineAudio').src=tracks[Number(selector.value)||0].url;$('onlineAudio').load();};
    selector.addEventListener('change',setTrack);setTrack();
    $('onlineCredit').textContent='Narração do LibriVox, projeto de audiolivros em domínio público. A obra permanece hospedada na fonte.';
    status('Escolha um capítulo e toque em reproduzir. O áudio não será baixado.');
  }
  $('onlinePrev').addEventListener('click',()=>{currentPage=Math.max(0,currentPage-pageSize());showPage();});
  $('onlineNext').addEventListener('click',()=>{currentPage=Math.min(pages.length-1,currentPage+pageSize());showPage();});
  window.addEventListener('resize',showPage);
  $('downloadCurrent').addEventListener('click',()=>{
    if(!currentText)return;
    const file=new Blob([currentText],{type:'text/plain;charset=utf-8'});
    const link=document.createElement('a');link.href=URL.createObjectURL(file);
    link.download=chapterTitle.replace(/[^\p{L}\p{N}-]+/gu,'_').slice(0,70)+'.txt';link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1500);
  });
  (async()=>{
    try{
      if(type==='wiki')await openWiki();
      else if(type==='arquivo'||type==='audio')showArchive(type==='audio');
      else if(type==='librivox')await openLibriVox();
      else throw Error('Escolha um livro na busca da Aurora.');
    }catch(error){console.warn('Leitura online:',error);status('Não foi possível abrir este exemplar. Volte à pesquisa e escolha outra edição.');}
  })();
})();
