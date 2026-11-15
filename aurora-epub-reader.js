/* Novo leitor EPUB. O folheio PDF existente não é alterado. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const formats=window.AuroraFormats;
  const id=new URLSearchParams(location.search).get('livro');
  const host=$('epubFlip');
  let epub=null,flip=null,book=null,chapter=0,page=0,pages=[],working=false,windowStart=0,windowLength=0;
  const PAGE_WINDOW=48; // evita criar centenas de folhas de uma só vez em EPUBs longos
  const settings=(()=>{try{return Object.assign({font:'Georgia',size:18,theme:'light'},JSON.parse(localStorage.getItem('aurora-epub-settings')||'{}'));}catch{return {font:'Georgia',size:18,theme:'light'};}})();
  const pct=()=>Math.round(100*(chapter+page/Math.max(1,pages.length))/Math.max(1,epub?.spine.length||1));
  const report=message=>{$('pageLabel').textContent=message;};
  const remember=()=>{
    if(!book||!epub)return;
    formats.saveRecord('progress',{id:book.id,chapter,page,bookmark:$('bookmark').dataset.bookmarked==='true'?page:null,percent:pct(),updated:Date.now()}).catch(console.warn);
  };
  function refresh(){
    $('chapterLabel').textContent='Capítulo '+(chapter+1)+' de '+epub.spine.length;
    $('pageLabel').textContent='Página '+(page+1)+' de '+pages.length+' • arraste o canto para folhear';
    $('readLocation').textContent=(page+1)+' / '+pages.length;
    $('progress').value=pct();$('progressPercent').textContent=pct()+'%';
    $('previousChapter').disabled=chapter===0;
    $('nextChapter').disabled=chapter===epub.spine.length-1;
    $('previousPage').disabled=chapter===0&&page===0;
    $('nextPage').disabled=chapter===epub.spine.length-1&&page===pages.length-1;
  }
  function pageDimensions(){
    return {width:Math.max(220,Math.min(450,innerWidth-12)),height:Math.max(280,Math.min(700,innerHeight-308))};
  }
  // Mede o conteúdo da página para que o texto ampliado não ultrapasse as bordas.
  function paginate(text,width,height){
    const mobile=innerWidth<=420;
    const padding=mobile?20:27;
    const block=document.createElement('div');
    block.className='epub-sheet-content';
    Object.assign(block.style,{position:'absolute',visibility:'hidden',height:'auto',width:(width)+'px',fontFamily:settings.font,fontSize:settings.size+'px',lineHeight:'1.55',padding:(mobile?'23px 20px':'30px 27px'),boxSizing:'border-box'});
    document.body.append(block);
    const fits=value=>{block.textContent=value;return block.scrollHeight<=height-3;};
    const result=[];let current='';
    const add=()=>{if(current.trim())result.push(current.trim());current='';};
    for(const paragraph of text.split(/\n\s*\n/).map(part=>part.trim()).filter(Boolean)){
      const joined=current?current+'\n\n'+paragraph:paragraph;
      if(fits(joined)){current=joined;continue;}
      add();
      if(fits(paragraph)){current=paragraph;continue;}
      const words=paragraph.split(/\s+/);
      let offset=0;
      while(offset<words.length){
        let low=1,high=words.length-offset,maximum=1;
        while(low<=high){
          const mid=(low+high)>>1;
          if(fits(words.slice(offset,offset+mid).join(' '))){maximum=mid;low=mid+1;}
          else high=mid-1;
        }
        result.push(words.slice(offset,offset+maximum).join(' '));
        offset+=maximum;
      }
    }
    add();block.remove();return result.length?result:['Este capítulo não contém texto selecionável.'];
  }
  function drawPages(){
    const {width,height}=pageDimensions();
    windowStart=Math.floor(page/PAGE_WINDOW)*PAGE_WINDOW;
    const visible=pages.slice(windowStart,windowStart+PAGE_WINDOW);
    windowLength=visible.length;
    host.style.width=(innerWidth>width*2+40?width*2:width)+'px';
    host.style.height=height+'px';
    host.className='flip-host '+settings.theme;
    host.style.overflow='';
    const elements=visible.map((content,index)=>{
      const sheet=document.createElement('div');sheet.className='epub-sheet';sheet.dataset.density='soft';
      const inner=document.createElement('div');inner.className='epub-sheet-content';
      inner.style.fontFamily=settings.font;inner.style.fontSize=settings.size+'px';
      inner.textContent=content;sheet.append(inner);sheet.setAttribute('aria-label','Página '+(windowStart+index+1));return sheet;
    });
    if(flip){try{flip.destroy();}catch{}flip=null;}
    host.replaceChildren(...elements);
    if(window.St?.PageFlip&&elements.length>1){
      try{
        flip=new St.PageFlip(host,{width,height,size:'fixed',showCover:false,drawShadow:true,maxShadowOpacity:.55,
          flippingTime:850,usePortrait:true,mobileScrollSupport:false,swipeDistance:20,autoSize:false});
        flip.loadFromHTML(elements);
        flip.on('flip',event=>{page=Math.min(pages.length-1,windowStart+Number(event.data));refresh();remember();stopSpeech();});
        if(page>windowStart)flip.turnToPage(page-windowStart);
      }catch(error){console.warn('Folheio EPUB indisponível, leitor simples ativado.',error);try{flip?.destroy();}catch{}flip=null;}
    }
    if(!flip){
      host.replaceChildren(...elements);
      host.classList.add('epub-static');
      elements.forEach((sheet,i)=>{sheet.classList.toggle('is-current',windowStart+i===page);sheet.style.width=width+'px';sheet.style.height=height+'px';});
      $('pageLabel').textContent='Use Anterior e Próxima para navegar pelas páginas.';
    }
    refresh();
  }
  function goPage(direction){
    if(!epub||working)return;
    const next=page+direction;
    if(next<0){if(chapter>0)loadChapter(chapter-1,Infinity);return;}
    if(next>=pages.length){if(chapter<epub.spine.length-1)loadChapter(chapter+1);return;}
    if(flip&&next>=windowStart&&next<windowStart+windowLength){
      direction>0?flip.flipNext():flip.flipPrev();
    }else{
      page=next;drawPages();remember();stopSpeech();
    }
  }
  async function loadChapter(index,desired=0){
    if(working||!epub)return;
    working=true;stopSpeech();
    try{
      const content=await formats.epubChapter(epub,index);
      chapter=index;
      const size=pageDimensions();
      pages=paginate(content,size.width,size.height);
      page=Math.max(0,Math.min(pages.length-1,desired));
      drawPages();remember();
    }catch(error){report('Erro ao abrir capítulo: '+error.message);}finally{working=false;}
  }
  $('previousChapter').addEventListener('click',()=>{if(chapter>0)loadChapter(chapter-1);});
  $('nextChapter').addEventListener('click',()=>{if(chapter<epub.spine.length-1)loadChapter(chapter+1);});
  $('previousPage').addEventListener('click',()=>goPage(-1));
  $('nextPage').addEventListener('click',()=>goPage(1));
  // Mesmo sem o módulo de animação (ou ao terminar um capítulo), o dedo continua navegando.
  let touchStart=null;
  host.addEventListener('touchstart',event=>{
    if(event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  host.addEventListener('touchend',event=>{
    if(!touchStart||!event.changedTouches.length)return;
    const dx=event.changedTouches[0].clientX-touchStart.x;
    const dy=event.changedTouches[0].clientY-touchStart.y;
    touchStart=null;
    if(Math.abs(dx)<50||Math.abs(dx)<Math.abs(dy)*1.3)return;
    if(!flip||(dx<0&&page===windowStart+windowLength-1)||(dx>0&&page===windowStart))goPage(dx<0?1:-1);
  },{passive:true});
  $('progress').addEventListener('change',event=>{if(epub)loadChapter(Math.min(epub.spine.length-1,Math.floor(Number(event.target.value)*epub.spine.length/100)));});
  $('bookmark').addEventListener('click',()=>{const was=$('bookmark').dataset.bookmarked==='true';$('bookmark').dataset.bookmarked=String(!was);$('bookmark').textContent=was?'♧':'🔖';remember();});
  const panel=$('settings');
  function panelOpen(open){panel.hidden=!open;$('settingsButton').setAttribute('aria-expanded',String(open));}
  $('settingsButton').addEventListener('click',()=>panelOpen(panel.hidden));
  $('closeSettings').addEventListener('click',()=>panelOpen(false));
  panel.addEventListener('click',event=>{if(event.target===panel)panelOpen(false);});
  function saveSettings(){try{localStorage.setItem('aurora-epub-settings',JSON.stringify(settings));}catch{}}
  const changeAppearance=()=>{saveSettings();if(epub)loadChapter(chapter,page);};
  $('fontChoice').value=settings.font;
  $('fontSize').value=settings.size;
  $('sizeValue').textContent=settings.size;
  $('fontChoice').addEventListener('change',event=>{settings.font=event.target.value;changeAppearance();});
  $('fontSize').addEventListener('change',event=>{settings.size=Number(event.target.value);$('sizeValue').textContent=settings.size;changeAppearance();});
  panel.querySelectorAll('[data-theme]').forEach(button=>button.addEventListener('click',()=>{settings.theme=button.dataset.theme;saveSettings();host.className='flip-host '+settings.theme;}));
  let speech=null;
  function stopSpeech(){if('speechSynthesis' in window){speechSynthesis.cancel();speech=null;$('readAloud').textContent='♫ Ouvir o texto';}}
  $('readAloud').addEventListener('click',()=>{
    if(speech){stopSpeech();return;}
    if(!('speechSynthesis' in window)){report('A leitura em voz alta não está disponível neste aparelho.');return;}
    speech=new SpeechSynthesisUtterance(pages[page]||'');speech.lang='pt-BR';speech.rate=1;
    speech.onend=stopSpeech;speech.onerror=stopSpeech;
    speechSynthesis.speak(speech);$('readAloud').textContent='■ Parar voz';
  });
  document.addEventListener('keydown',event=>{
    if(!epub||!panel.hidden)return;
    if(event.key==='ArrowRight'){event.preventDefault();goPage(1);}
    if(event.key==='ArrowLeft'){event.preventDefault();goPage(-1);}
  });
  window.addEventListener('pagehide',()=>{remember();stopSpeech();});
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(epub)loadChapter(chapter,page);},250);});
  (async()=>{
    try{
      if(!id)throw new Error('Nenhum livro foi selecionado.');
      book=await formats.readRecord('books',id);
      if(!book||book.format!=='epub')throw new Error('Este EPUB não foi encontrado neste aparelho.');
      $('bookTitle').textContent=book.name;
      epub=await formats.openEpub(book.data);
      const saved=await formats.readRecord('progress',id).catch(()=>null);
      if(Number.isInteger(saved?.bookmark)){$('bookmark').dataset.bookmarked='true';$('bookmark').textContent='🔖';}
      await loadChapter(Math.max(0,Math.min(epub.spine.length-1,saved?.chapter||0)),saved?.page||0);
    }catch(error){report('Não foi possível abrir o EPUB: '+error.message);}
  })();
})();
