/* O EPUB usa o folheio St.PageFlip e a apresentação de leitura do PDF. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const formats=window.AuroraFormats;
  const id=new URLSearchParams(location.search).get('livro');
  const stage=document.querySelector('.reader-stage');
  let host=$('epubFlip');
  let epub=null,flip=null,book=null,chapter=0,page=0,pages=[],working=false,windowStart=0,windowLength=0;
  const PAGE_WINDOW=48; // evita criar centenas de folhas de uma só vez em EPUBs longos
  const settings=(()=>{try{return Object.assign({font:'Georgia',size:18,line:1.55,theme:'light'},JSON.parse(localStorage.getItem('aurora-epub-settings')||'{}'));}catch{return {font:'Georgia',size:18,line:1.55,theme:'light'};}})();
  settings.size=Math.max(14,Math.min(28,Number(settings.size)||18));
  settings.line=Math.max(1.3,Math.min(2,Number(settings.line)||1.55));
  if(!['light','sepia','night'].includes(settings.theme))settings.theme='light';
  const pct=()=>Math.round(100*(chapter+page/Math.max(1,pages.length))/Math.max(1,epub?.spine.length||1));
  const report=message=>{$('pageLabel').textContent=message;};
  const remember=()=>{
    if(!book||!epub)return;
    formats.saveRecord('progress',{id:book.id,chapter,page,bookmark:$('bookmark').dataset.bookmarked==='true'?page:null,percent:pct(),updated:Date.now()}).catch(console.warn);
  };
  function refresh(){
    $('chapterLabel').textContent='Capítulo '+(chapter+1)+' de '+epub.spine.length;
    $('pageLabel').textContent='Arraste o canto da folha para virar. Sua leitura fica salva.';
    $('readLocation').textContent=(page+1)+' / '+pages.length;
    $('progress').value=pct();$('progressPercent').textContent=pct()+'%';
    $('previousChapter').disabled=chapter===0;
    $('nextChapter').disabled=chapter===epub.spine.length-1;
    $('previousPage').disabled=chapter===0&&page===0;
    $('nextPage').disabled=chapter===epub.spine.length-1&&page===pages.length-1;
  }
  function pageDimensions(){
    // A folha ocupa o espaço disponível, como no PDF, sem sobrar uma área escura enorme.
    const availableWidth=Math.max(165,stage.clientWidth-14);
    const availableHeight=Math.max(245,stage.clientHeight-18);
    const ratio=innerWidth<=670 ? .64 : .72;
    const width=Math.max(155,Math.floor(Math.min(availableWidth,availableHeight*ratio,450)));
    return {width,height:Math.floor(width/ratio)};
  }
  // Mede o conteúdo da página para que o texto ampliado não ultrapasse as bordas.
  function paginate(text,width,height){
    const mobile=innerWidth<=420;
    const block=document.createElement('div');
    block.className='epub-sheet-content';
    Object.assign(block.style,{position:'absolute',visibility:'hidden',height:'auto',width:width+'px',fontFamily:settings.font,fontSize:settings.size+'px',lineHeight:String(settings.line),padding:(mobile?'23px 20px':'30px 27px'),boxSizing:'border-box',whiteSpace:'pre-wrap',overflowWrap:'break-word'});
    document.body.append(block);
    // A medida usa a MESMA quebra de linha exibida; sobra lugar para o número da folha.
    const fits=value=>{block.textContent=value;return block.scrollHeight<=height-34;};
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
    add();block.remove();return result;
  }
  function paginateContent(blocks,width,height){
    const result=[];
    let text=[];
    const flush=()=>{
      if(text.length)result.push(...paginate(text.join('\n\n'),width,height));
      text=[];
    };
    for(const part of blocks){
      if(part.type==='image'){
        flush();
        result.push({type:'image',src:part.src,alt:part.alt||'Ilustração deste livro'});
      }else if(part.type==='text'&&part.text?.trim())text.push(part.text);
    }
    flush();
    return result;
  }
  function drawPages(){
    const {width,height}=pageDimensions();
    windowStart=Math.floor(page/PAGE_WINDOW)*PAGE_WINDOW;
    const visible=pages.slice(windowStart,windowStart+PAGE_WINDOW);
    windowLength=visible.length;
    const elements=visible.map((content,index)=>{
      const sheet=document.createElement('div');sheet.className='epub-sheet';sheet.dataset.density='soft';
      const inner=document.createElement('div');inner.className='epub-sheet-content';
      inner.style.fontFamily=settings.font;inner.style.fontSize=settings.size+'px';inner.style.lineHeight=String(settings.line);
      if(content?.type==='image'){
        inner.classList.add('epub-image-content');
        const picture=document.createElement('img');
        picture.className='epub-page-image';picture.src=content.src;picture.alt=content.alt;
        picture.loading='lazy';inner.append(picture);
      }else inner.textContent=content;
      sheet.append(inner);
      const number=document.createElement('span');number.className='epub-page-number';number.textContent=String(windowStart+index+1);
      sheet.append(number);sheet.setAttribute('aria-label','Página '+(windowStart+index+1));return sheet;
    });
    // St.PageFlip.destroy() pode remover o próprio host. Sempre recriar esse nó
    // evita o EPUB ficar em branco quando muda de capítulo, janela ou tamanho.
    if(flip){try{flip.destroy();}catch{}flip=null;}
    host=document.createElement('div');
    host.id='epubFlip';
    host.className='flip-host '+settings.theme;
    host.style.width=width+'px';host.style.height=height+'px';
    stage.replaceChildren(host);
    host.replaceChildren(...elements);
    if(window.St?.PageFlip&&elements.length>1){
      try{
        flip=new St.PageFlip(host,{width,height,size:'fixed',showCover:false,drawShadow:true,maxShadowOpacity:.18,
          flippingTime:900,usePortrait:innerWidth<670,mobileScrollSupport:false,swipeDistance:20,autoSize:false});
        flip.loadFromHTML(elements);
        let soundedDuringTurn=false;
        flip.on('changeState',event=>{
          if(event.data==='flipping'){
            window.AuroraPageSound?.play();
            soundedDuringTurn=true;
          }
        });
        flip.on('flip',event=>{
          const next=Math.min(pages.length-1,windowStart+Number(event.data));
          if(next!==page&&!soundedDuringTurn)window.AuroraPageSound?.play();
          soundedDuringTurn=false;
          page=next;refresh();remember();stopSpeech();
        });
        if(page>windowStart)flip.turnToPage(page-windowStart);
      }catch(error){console.warn('Folheio EPUB indisponível, leitor simples ativado.',error);try{flip?.destroy();}catch{}flip=null;}
    }
    if(!flip){
      if(host.parentElement!==stage)stage.replaceChildren(host);
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
    if(next<0){if(chapter>0)loadChapter(chapter-1,Infinity,-1);return;}
    if(next>=pages.length){if(chapter<epub.spine.length-1)loadChapter(chapter+1);return;}
    if(flip&&next>=windowStart&&next<windowStart+windowLength){
      direction>0?flip.flipNext():flip.flipPrev();
    }else{
      page=next;drawPages();remember();stopSpeech();window.AuroraPageSound?.play();
    }
  }
  async function loadChapter(index,desired=0,direction=desired===Infinity?-1:1){
    if(working||!epub)return;
    working=true;stopSpeech();report('Preparando as folhas…');
    try{
      const size=pageDimensions();
      let target=index;
      let found=[];
      // Frontispícios vazios e arquivos de navegação não são mostrados como
      // páginas de erro. Avança até encontrar texto ou imagem de verdade.
      while(target>=0&&target<epub.spine.length){
        const blocks=await formats.epubChapterContent(epub,target);
        found=paginateContent(blocks,size.width,size.height);
        if(found.length)break;
        target+=direction;
      }
      if(!found.length)throw new Error('Não encontramos conteúdo legível nos capítulos restantes.');
      chapter=target;
      pages=found;
      page=Math.max(0,Math.min(pages.length-1,desired));
      drawPages();remember();
    }catch(error){report('Erro ao abrir capítulo: '+error.message);}finally{working=false;}
  }
  $('previousChapter').addEventListener('click',()=>{if(chapter>0)loadChapter(chapter-1,0,-1);});
  $('nextChapter').addEventListener('click',()=>{if(chapter<epub.spine.length-1)loadChapter(chapter+1);});
  $('previousPage').addEventListener('click',()=>goPage(-1));
  $('nextPage').addEventListener('click',()=>goPage(1));
  // Mesmo sem o módulo de animação (ou ao terminar um capítulo), o dedo continua navegando.
  let touchStart=null;
  stage.addEventListener('touchstart',event=>{
    if(event.touches.length===1)touchStart={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  stage.addEventListener('touchend',event=>{
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
  $('lineHeight').value=String(Math.round(settings.line*10));
  $('lineValue').textContent=settings.line.toFixed(1).replace('.',',');
  $('fontChoice').addEventListener('change',event=>{settings.font=event.target.value;changeAppearance();});
  $('fontSize').addEventListener('change',event=>{settings.size=Number(event.target.value);$('sizeValue').textContent=settings.size;changeAppearance();});
  $('lineHeight').addEventListener('change',event=>{settings.line=Number(event.target.value)/10;$('lineValue').textContent=settings.line.toFixed(1).replace('.',',');changeAppearance();});
  const themeButtons=[...panel.querySelectorAll('.theme-controls [data-theme]')];
  function applyTheme(){
    document.body.dataset.readerTheme=settings.theme;
    // Preservar as classes internas que o St.PageFlip coloca no contêiner.
    // Substituir className quebrava o desenho e podia manter a cor anterior.
    if(host){host.classList.remove('light','sepia','night');host.classList.add(settings.theme);}
    themeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===settings.theme)));
    flip?.update?.();
  }
  applyTheme();
  themeButtons.forEach(button=>button.addEventListener('click',()=>{settings.theme=button.dataset.theme;saveSettings();applyTheme();}));
  let speech=null;
  function stopSpeech(){if('speechSynthesis' in window){speechSynthesis.cancel();speech=null;$('readAloud').textContent='♫ Ouvir o texto';}}
  $('readAloud').addEventListener('click',()=>{
    if(speech){stopSpeech();return;}
    if(!('speechSynthesis' in window)){report('A leitura em voz alta não está disponível neste aparelho.');return;}
    panelOpen(false);
    const content=pages[page];
    speech=new SpeechSynthesisUtterance(typeof content==='string'?content:(content?.alt||'Ilustração deste livro.'));
    speech.lang='pt-BR';speech.rate=1;
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
      $('bookTitle').textContent=window.AuroraTitles?.display(book.name)||book.name;
      epub=await formats.openEpub(book.data);
      const saved=await formats.readRecord('progress',id).catch(()=>null);
      if(Number.isInteger(saved?.bookmark)){$('bookmark').dataset.bookmarked='true';$('bookmark').textContent='🔖';}
      await loadChapter(Math.max(0,Math.min(epub.spine.length-1,saved?.chapter||0)),saved?.page||0);
    }catch(error){report('Não foi possível abrir o EPUB: '+error.message);}
  })();
})();
