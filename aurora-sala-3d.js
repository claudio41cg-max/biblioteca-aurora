/* Um único volume WebGL acompanha todo o voo até o visor; não há navegação
   entre a estante e a inspeção. O leitor PDF permanece no arquivo existente. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const showcase=$('auroraShowcase');
  const scene=$('scene');
  const cssBook=$('book3d');
  const cover=$('cover3d');
  if(!showcase||!scene||!cssBook||!cover)return;
  const categories=['romance','adulto','ficcao','brasileiros','filmes'];
  let active=null;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const niceTitle=title=>window.AuroraTitles?.display(title)||String(title||'Livro sem título');
  const formatName={pdf:'PDF',epub:'EPUB',txt:'TXT',audio:'Audiolivro',online:'Leitura on-line',demo:'Demonstração'};
  function showBookDetails(session){
    if(!session)return;
    const book=session.book;
    const known=window.AuroraBookInfo?.find(book.title||book.name);
    $('auroraShowTitle').textContent=niceTitle(known?.title||book.title||book.name);
    $('auroraShowAuthor').textContent='por '+(known?.author||book.author||'Autor não informado');
    $('auroraDescriptionAuthor').textContent=known?.author||book.author||'Não informado';
    $('auroraDescriptionOrigin').textContent=known?.country||book.country||'Não informada';
    $('auroraDescriptionYear').textContent=known?.year||book.year||'Não informado';
    const total=Math.max(0,Number(book.total)||0);
    const pages=book.format==='pdf'
      ?total?total+' páginas nesta edição':'Não identificadas'
      :book.format==='epub'
        ?(known?.referencePages?known.referencePages+' páginas na edição impressa de referência; ':'')+
          'paginação ajustável'+(total?' ('+total+' partes no arquivo)':'')
        :book.format==='txt'?total?'Cerca de '+total+' páginas digitais':'Paginação ajustável'
        :'Não informadas';
    $('auroraDescriptionPages').textContent=pages;
    $('auroraDescriptionFormat').textContent=formatName[book.format]||String(book.format||'Não identificado').toUpperCase();
    const description=String(known?.description||book.description||'').trim();
    $('auroraDescriptionStory').textContent=description||'Esta edição não contém uma sinopse. Abra a descrição para consultar um trecho inicial, quando o formato permitir.';
    session.needsExcerpt=!description;
  }
  async function supplyInitialExcerpt(session){
    if(!session?.needsExcerpt||session.excerptRequested)return;
    session.excerptRequested=true;
    const book=session.book;
    let source='';
    try{
      if(book.format==='txt'){
        const texts=JSON.parse(localStorage.getItem('aurora-books')||'{}');
        source=texts[book.name]||texts[book.title]||'';
      }else if(book.format==='epub'&&window.AuroraFormats){
        const record=await window.AuroraFormats.readRecord('books',book.id);
        if(record?.data){
          const epub=await window.AuroraFormats.openEpub(record.data);
          for(let i=0;i<Math.min(epub.spine.length,7);i++){
            const blocks=await window.AuroraFormats.epubChapterContent(epub,i);
            source=blocks.filter(item=>item.type==='text').map(item=>item.text).join(' ').trim();
            if(source.length>170)break;
          }
        }
      }
      if(active!==session)return;
      source=source.replace(/\s+/g,' ').trim();
      if(source.length>100){
        const short=source.slice(0,370);
        const end=short.search(/[.!?…](?:\s|$)/);
        $('auroraDescriptionStory').textContent='Trecho inicial do arquivo (não é sinopse): '+
          (end>90?short.slice(0,end+1):short.replace(/\s+\S*$/,'')+'…');
      }else $('auroraDescriptionStory').textContent='Esta edição não contém uma sinopse. Não há dados suficientes para apresentar a história com segurança.';
    }catch(error){
      if(active===session){
        console.warn('Prévia da descrição indisponível:',error);
        $('auroraDescriptionStory').textContent='Esta edição não contém uma sinopse. Você pode abrir o livro para conhecer a história.';
      }
    }
  }
  const readerURL=book=>book.format==='online'
    ?(/^(\.\/)?ler-online\.html\?/.test(book.readerURL||'')?book.readerURL:'./explorar-livros.html')
    :book.format==='txt'
    ?'./ler-epub.html?txt='+encodeURIComponent(book.name||book.title)+'&v=8'
    :book.format==='epub'
    ?'./ler-epub.html?livro='+encodeURIComponent(book.id)+'&v=8'
    :book.format==='audio'?'./ouvir-livro.html?livro='+encodeURIComponent(book.id)+'&v=1'
    :'./meus-livros.html?livro='+encodeURIComponent(book.id)+'&open=1&v=28';
  const editionURL=book=>['epub','txt','audio','online'].includes(book.format)?readerURL(book):'./meus-livros.html?livro='+encodeURIComponent(book.id)+'&v=28';
  let fallbackPose={x:-.09,y:.28};

  function setPose(x,y){
    if(scene.classList.contains('three-ready') && !scene.classList.contains('aurora-force-css') && window.Aurora3D?.setPose)
      window.Aurora3D.setPose(x,y);
    else{
      fallbackPose={x,y};
      cssBook.style.transform=`rotateX(${x}rad) rotateY(${y}rad)`;
    }
  }
  function close(fromHistory=false){
    const session=active;
    if(!session)return;
    active=null;
    clearTimeout(session.fallback);
    session.motion?.cancel();
    if(session.frame)cancelAnimationFrame(session.frame);
    scene.style.transform='';
    scene.style.opacity='';
    scene.classList.remove('aurora-force-css');
    showcase.classList.remove('arriving','preparing','settled');
    showcase.hidden=true;
    session.button.style.visibility='';
    document.body.classList.remove('aurora-showcase-open');
    window.__auroraSelectedBook=null;
    if(!fromHistory && history.state?.auroraViewerId===session.book.id)history.back();
    session.button.focus({preventScroll:true});
  }

  function enterReader(){
    const session=active;
    if(!session?.finished)return;
    if(typeof session.book.openReader==='function'){
      const action=session.book.openReader;
      close();
      action();
      return;
    }
    location.href=readerURL(session.book);
  }

  function finishFlight(session){
    if(active!==session)return;
    scene.style.transform='';
    session.motion?.cancel();
    session.motion=null;
    setPose(-.09,.28);
    showcase.classList.add('settled');
    session.finished=true;
    // O mesmo renderer continua na tela, agora livre para girar com o dedo.
  }

  function beginFlight(session){
    if(active!==session || session.started)return;
    session.started=true;
    clearTimeout(session.fallback);
    requestAnimationFrame(()=>{
      if(active!==session)return;
      const bounds=scene.getBoundingClientRect();
      const origin=session.origin;
      const dx=origin.left+origin.width/2-(bounds.left+bounds.width/2);
      const dy=origin.top+origin.height/2-(bounds.top+bounds.height/2);
      const scale=clamp(origin.height/(bounds.height*.75),.29,.72);
      const first=`translate3d(${dx}px,${dy}px,0) scale(${scale})`;
      scene.style.transform=first;
      setPose(-.04,1.34);
      session.button.style.visibility='hidden';
      document.body.classList.add('aurora-showcase-open');
      showcase.classList.add('arriving');
      const reduced=window.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
      if(reduced||!scene.animate){finishFlight(session);return;}
      const duration=1080;
      session.motion=scene.animate([
        {transform:first,offset:0},
        {transform:`translate3d(${dx*.80}px,${dy*.77-24}px,0) scale(${scale*1.10})`,offset:.24},
        {transform:`translate3d(${dx*.24}px,${dy*.23-20}px,0) scale(.88)`,offset:.76},
        {transform:'translate3d(0,0,0) scale(1)',offset:1}
      ],{duration,fill:'forwards',easing:'cubic-bezier(.28,.05,.18,1)'});
      const start=performance.now();
      function turn(now){
        if(active!==session)return;
        const t=clamp((now-start)/duration,0,1);
        const eased=t*t*(3-2*t);
        setPose(-.04-.05*eased,1.34+( .28-1.34)*eased);
        if(t<1)session.frame=requestAnimationFrame(turn);
      }
      session.frame=requestAnimationFrame(turn);
      session.motion.finished.then(()=>finishFlight(session)).catch(()=>{});
    });
  }

  function open(button,book){
    if(active)return;
    // Toda edição adicionada passa pelo mesmo visor, mesmo quando não traz capa.
    if(book&&!book.cover&&window.AuroraFormats?.createDigitalCover){
      book.cover=window.AuroraFormats.createDigitalCover(window.AuroraTitles?.display(book.title||book.name)||book.title||book.name,book.author,book.format);
      book.coverSource='generated';
    }
    if(!book?.cover){location.href=editionURL(book);return;}
    const session={button,book,origin:button.getBoundingClientRect(),started:false,finished:false};
    active=session;
    showcase.hidden=false;
    showcase.classList.remove('arriving','settled');
    showcase.classList.add('preparing');
    scene.style.transform='';
    scene.classList.remove('three-ready');
    scene.classList.remove('aurora-force-css');
    scene.classList.add('cover-loading');
    const displayTitle=niceTitle(window.AuroraBookInfo?.find(book.title||book.name)?.title||book.title||book.name);
    showBookDetails(session);
    $('auroraShowCategory').value=categories.includes(book.category)?book.category:'ficcao';
    $('auroraShowCategory').disabled=book.format==='demo';
    // A sinopse já fica visível ao pegar o livro; pode ser recolhida ao toque.
    $('auroraShowDescription').open=true;
    showcase.scrollTop=0;
    const ratio=clamp(Number(book.ratio)||.72,.59,.84);
    cssBook.style.setProperty('--book-ratio',String(ratio));
    const halfDepth=clamp(23+(Number(book.total)||180)/70,22,41);
    cssBook.style.setProperty('--half-depth',halfDepth+'px');
    cssBook.style.setProperty('--depth',(halfDepth*2)+'px');
    cssBook.style.width='min('+(65*ratio/.72).toFixed(1)+'vw,'+Math.round(326*ratio/.72)+'px)';
    cssBook.querySelector('.volume-back').style.backgroundImage=book.back?'url('+JSON.stringify(book.back)+')':'';
    cssBook.querySelector('.volume-spine').style.backgroundImage=book.spine?'url('+JSON.stringify(book.spine)+')':'';
    // A textura usada no primeiro quadro é a mesma que seguirá no modelo WebGL.
    window.__auroraSelectedBook={id:book.id,name:book.name||book.title,
      title:displayTitle,author:book.author,description:book.description,
      format:book.format,cover:book.cover,back:book.back,spine:book.spine,ratio,total:book.total};
    cover.alt=(book.coverSource==='generated'?'Capa ilustrativa de ':'Capa da edição ')+displayTitle;
    cover.src=book.cover;
    window.dispatchEvent(new CustomEvent('aurora:book-selected',{detail:window.__auroraSelectedBook}));
    if(cover.complete&&cover.naturalWidth)scene.classList.remove('cover-loading');
    // Se WebGL não inicializar neste aparelho, o volume CSS tem seis faces 3D.
    session.fallback=setTimeout(()=>{
      if(active!==session||session.started)return;
      if(!cover.naturalWidth&&window.AuroraFormats?.createDigitalCover){
        book.cover=window.AuroraFormats.createDigitalCover(displayTitle,book.author,book.format);
        book.coverSource='generated';
        cover.alt='Capa ilustrativa de '+displayTitle;
        cover.src=book.cover;
        window.__auroraSelectedBook.cover=book.cover;
      }
      scene.classList.remove('cover-loading');
      scene.classList.add('aurora-force-css');
      beginFlight(session);
    },2300);
    try{history.pushState({auroraViewerId:book.id},'',location.href);}catch{}
  }

  cover.addEventListener('load',()=>{
    if(!active || cover.getAttribute('src')!==active.book.cover)return;
    scene.classList.remove('cover-loading');
  });
  window.addEventListener('aurora:book-ready',event=>{
    if(active?.book.id===event.detail?.id)beginFlight(active);
  });
  window.addEventListener('aurora:open-book',()=>{
    enterReader();
  });
  let drag=null;
  cssBook.addEventListener('pointerdown',event=>{
    if(!active?.finished || scene.classList.contains('three-ready')&&!scene.classList.contains('aurora-force-css'))return;
    drag={x:event.clientX,y:event.clientY,rx:fallbackPose.x,ry:fallbackPose.y,id:event.pointerId,moved:false};
    cssBook.setPointerCapture(event.pointerId);
  });
  cssBook.addEventListener('pointermove',event=>{
    if(!drag || event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>9)drag.moved=true;
    if(drag.moved)setPose(clamp(drag.rx+dy*.005,-.85,.85),drag.ry+dx*.012);
  });
  cssBook.addEventListener('pointerup',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const moved=drag.moved;
    drag=null;
    if(!moved)enterReader();
  });
  cssBook.addEventListener('pointercancel',()=>{drag=null;});
  cssBook.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&active?.finished&&(!scene.classList.contains('three-ready')||scene.classList.contains('aurora-force-css'))){
      event.preventDefault();enterReader();
    }
  });
  $('auroraShowBack').addEventListener('click',()=>close());
  $('auroraShowDescription').addEventListener('toggle',()=>{
    if(active&&$('auroraShowDescription').open)void supplyInitialExcerpt(active);
  });
  // O Android pode restaurar a página inteira da memória ao usar Voltar.
  // Reaplicar a limpeza no retorno impede o título bruto do arquivo reaparecer.
  window.addEventListener('pageshow',()=>{if(active)showBookDetails(active);});
  window.addEventListener('popstate',()=>{
    if(!active)return;
    if(history.state?.auroraViewerId===active.book.id)showBookDetails(active);
    else close(true);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active?.finished && !event.target?.closest?.('details'))close();
  });
  $('auroraShowCategory').addEventListener('change',event=>{
    const session=active;
    const category=event.target.value;
    if(!session||!categories.includes(category))return;
    const moveToCategory=()=>{
      session.book.category=category;
      const target=$('shelf-'+category);
      if(target){
        const old=session.button.closest('.bookrow')?.id?.slice(6);
        target.append(session.button);
        window.AuroraShelf?.refreshCount(old);
        window.AuroraShelf?.refreshCount(category);
      }
    };
    if(typeof session.book.updateCategory==='function'){
      Promise.resolve().then(()=>session.book.updateCategory(category)).then(moveToCategory).catch(error=>{
        console.warn('Categoria não salva:',error);
        event.target.value=session.book.category;
      });
      return;
    }
    const request=indexedDB.open('aurora-pdf-library',2);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction('books','readwrite');
      const store=tx.objectStore('books');
      const get=store.get(session.book.id);
      get.onsuccess=()=>{
        if(!get.result)return;
        get.result.category=category;
        store.put(get.result);
      };
      tx.oncomplete=()=>{
        moveToCategory();
        db.close();
      };
      tx.onerror=()=>{db.close();event.target.value=session.book.category;};
    };
    request.onerror=()=>{event.target.value=session.book.category;};
  });
  window.AuroraShelfViewer={open,close};
})();
