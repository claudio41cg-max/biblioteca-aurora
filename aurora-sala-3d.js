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
  const categories=['romance','adulto','ficcao','brasileiros'];
  let active=null;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const readerURL=id=>'./meus-livros.html?livro='+encodeURIComponent(id)+'&open=1&v=18';
  const editionURL=id=>'./meus-livros.html?livro='+encodeURIComponent(id)+'&v=18';
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
    if(!book?.cover){location.href=editionURL(book.id);return;}
    const known=window.AuroraBookInfo?.find(book.title||book.name);
    const session={button,book,origin:button.getBoundingClientRect(),started:false,finished:false};
    active=session;
    showcase.hidden=false;
    showcase.classList.remove('arriving','settled');
    showcase.classList.add('preparing');
    scene.style.transform='';
    scene.classList.remove('three-ready');
    scene.classList.remove('aurora-force-css');
    scene.classList.add('cover-loading');
    $('auroraShowTitle').textContent=known?.title||book.title||book.name;
    $('auroraShowAuthor').textContent='por '+(known?.author||book.author||'Autor não informado');
    $('auroraShowCategory').value=categories.includes(book.category)?book.category:'ficcao';
    $('auroraDescriptionAuthor').textContent=known?.author||book.author||'Não informado';
    $('auroraDescriptionOrigin').textContent=known?.country||book.country||'Não informada';
    $('auroraDescriptionYear').textContent=known?.year||book.year||'Não informado';
    $('auroraDescriptionStory').textContent=known?.description||book.description||'Este livro ainda não tem sinopse cadastrada.';
    $('auroraShowDescription').open=false;
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
      cover:book.cover,back:book.back,spine:book.spine,ratio,total:book.total};
    cover.alt='Capa original de '+(book.title||book.name);
    cover.src=book.cover;
    window.dispatchEvent(new CustomEvent('aurora:book-selected',{detail:window.__auroraSelectedBook}));
    if(cover.complete&&cover.naturalWidth)scene.classList.remove('cover-loading');
    // Se WebGL não inicializar neste aparelho, o volume CSS tem seis faces 3D.
    session.fallback=setTimeout(()=>{
      if(active!==session||session.started)return;
      if(cover.naturalWidth){scene.classList.add('aurora-force-css');beginFlight(session);}
      else location.href=editionURL(book.id);
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
    if(active?.finished)location.href=readerURL(active.book.id);
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
    if(!moved && active?.finished)location.href=readerURL(active.book.id);
  });
  cssBook.addEventListener('pointercancel',()=>{drag=null;});
  cssBook.addEventListener('keydown',event=>{
    if((event.key==='Enter'||event.key===' ')&&active?.finished&&(!scene.classList.contains('three-ready')||scene.classList.contains('aurora-force-css'))){
      event.preventDefault();location.href=readerURL(active.book.id);
    }
  });
  $('auroraShowBack').addEventListener('click',()=>close());
  window.addEventListener('popstate',()=>{if(active)close(true);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&active?.finished && !event.target?.closest?.('details'))close();
  });
  $('auroraShowCategory').addEventListener('change',event=>{
    const session=active;
    const category=event.target.value;
    if(!session||!categories.includes(category))return;
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
        session.book.category=category;
        const target=$('shelf-'+category);
        if(target){
          const old=session.button.closest('.bookrow')?.id?.slice(6);
          target.append(session.button);
          window.AuroraShelf?.refreshCount(old);
          window.AuroraShelf?.refreshCount(category);
        }
        db.close();
      };
      tx.onerror=()=>{db.close();event.target.value=session.book.category;};
    };
    request.onerror=()=>{event.target.value=session.book.category;};
  });
  window.AuroraShelfViewer={open,close};
})();
