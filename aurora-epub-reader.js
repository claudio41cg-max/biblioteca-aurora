/* O EPUB usa o folheio St.PageFlip e a apresentação de leitura do PDF. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const formats=window.AuroraFormats;
  const query=new URLSearchParams(location.search);
  const txtTitle=query.get('txt');
  const id=txtTitle?'txt:'+txtTitle:query.get('livro');
  const stage=document.querySelector('.reader-stage');
  // Prova visual restrita ao EPUB Pai Rico, Pai Pobre; TXT e demais EPUBs intactos.
  const isRichDad=(value)=>/\bpai rico pai pobre\b/.test(String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').toLowerCase());
  let host=$('epubFlip');
  let epub=null,flip=null,book=null,chapter=0,page=0,pages=[],working=false,windowStart=0,windowLength=0,drawGeneration=0;
  const PAGE_WINDOW=24; // folhas opacas em alta resolução: limitar a memória no celular
  const settings=(()=>{try{return Object.assign({font:'Georgia',size:18,line:1.55,theme:'light'},JSON.parse(localStorage.getItem('aurora-epub-settings')||'{}'),JSON.parse(localStorage.getItem('aurora-reading-preferences-v2')||'{}'));}catch{return {font:'Georgia',size:18,line:1.55,theme:'light'};}})();
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
    const currentContent=pages[page];
    const accessible=$('epubAccessibleText');
    if(accessible)accessible.textContent=typeof currentContent==='string'?currentContent:(currentContent?.alt||'Ilustração deste livro');
    $('pageLabel').textContent='Arraste o canto da folha para virar. Sua leitura fica salva.';
    $('readLocation').textContent=(page+1)+' / '+pages.length;
    $('progress').value=pct();$('progressPercent').textContent=pct()+'%';
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
  // O PDF folheia um canvas opaco, não o texto HTML. Desenhamos o EPUB no mesmo
  // tipo de superfície: o verso da dobra não revela uma segunda folha embaixo.
  // A mesma medição determina as quebras e a pintura, sem cortar frases.
  const paperPalette=()=>({
    light:{paper:document.body.classList.contains('aurora-richdad-volume')?'#ffffff':'#fffdf8',ink:'#332a23',edge:document.body.classList.contains('aurora-richdad-volume')?'#f0f0ec':'#d6c9ae',number:'#97876f'},
    sepia:{paper:'#f0e1c6',ink:'#392c21',edge:'#c9b38d',number:'#8d7557'},
    night:{paper:'#24312f',ink:'#f0e5d0',edge:'#162320',number:'#aeb5a9'}
  }[settings.theme]);
  const pageInsets=()=>({top:innerWidth<=420?23:30,left:innerWidth<=420?20:27,bottom:42});
  const pageLineHeight=()=>settings.size*settings.line;
  function textLines(value,ctx,usableWidth){
    const lines=[];
    for(const raw of String(value||'').replace(/\r/g,'').split('\n')){
      if(!raw.trim()){lines.push('');continue;}
      let line='';
      for(const word of raw.trim().split(/\s+/)){
        const proposal=line?line+' '+word:word;
        if(ctx.measureText(proposal).width<=usableWidth){line=proposal;continue;}
        if(line){lines.push(line);line='';}
        // Palavras ou links extensos também precisam caber na largura da folha.
        for(const letter of word){
          if(line&&ctx.measureText(line+letter).width>usableWidth){lines.push(line);line='';}
          line+=letter;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  function paperContext(width,height){
    const canvas=document.createElement('canvas');
    const scale=Math.min(2,Math.max(1,window.devicePixelRatio||1));
    canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    canvas.className='epub-page-canvas';canvas.setAttribute('aria-hidden','true');
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)return {canvas,context:null};
    context.setTransform(scale,0,0,scale,0,0);
    const colors=paperPalette();
    context.fillStyle=colors.paper;context.fillRect(0,0,width,height);
    // Sombreamento discreto do papel. A sombra da dobra é feita pelo PageFlip.
    const edge=context.createLinearGradient(0,0,width,0);
    edge.addColorStop(0,colors.edge);edge.addColorStop(.025,colors.paper);
    edge.addColorStop(.96,colors.paper);edge.addColorStop(1,colors.edge);
    context.fillStyle=edge;context.fillRect(0,0,width,height);
    return {canvas,context};
  }
  function paintSheet(content,width,height,pageNumber){
    const {canvas,context}=paperContext(width,height);
    if(!context)return canvas;
    const colors=paperPalette();
    const inset=pageInsets();
    if(content?.type==='image'){
      const picture=new Image();
      canvas.ready=new Promise(resolve=>{
        picture.onload=()=>{
          const availableWidth=width-2*inset.left;
          const availableHeight=height-inset.top-inset.bottom;
          const ratio=Math.min(availableWidth/picture.naturalWidth,availableHeight/picture.naturalHeight);
          const w=picture.naturalWidth*ratio,h=picture.naturalHeight*ratio;
          context.drawImage(picture,(width-w)/2,inset.top+(availableHeight-h)/2,w,h);
          resolve();
        };
        picture.onerror=()=>{
          context.fillStyle=colors.ink;context.font='15px Georgia,serif';
          context.fillText('Ilustração indisponível',inset.left,inset.top);resolve();
        };
      });
      picture.src=content.src;
    }else{
      context.fillStyle=colors.ink;
      context.font=settings.size+'px '+settings.font;
      context.textBaseline='top';
      textLines(content,context,width-2*inset.left).forEach((line,index)=>{
        context.fillText(line,inset.left,inset.top+index*pageLineHeight());
      });
    }
    context.fillStyle=colors.number;
    context.font='11px Georgia,serif';context.textAlign='center';context.textBaseline='alphabetic';
    context.fillText(String(pageNumber),width/2,height-14);
    return canvas;
  }
  // Mede o conteúdo da página antes de pintar, com a própria métrica do canvas.
  function paginate(text,width,height){
    const context=document.createElement('canvas').getContext('2d');
    if(!context)return [text];
    context.font=settings.size+'px '+settings.font;
    const inset=pageInsets();
    const capacity=Math.max(1,Math.floor((height-inset.top-inset.bottom)/pageLineHeight()));
    const lines=textLines(text,context,width-2*inset.left);
    const result=[];
    for(let start=0;start<lines.length;start+=capacity){
      const slice=lines.slice(start,start+capacity).join('\n').trim();
      if(slice)result.push(slice);
    }
    return result;
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
  async function drawPages(){
    const currentDraw=++drawGeneration;
    const {width,height}=pageDimensions();
    const start=Math.floor(page/PAGE_WINDOW)*PAGE_WINDOW;
    const visible=pages.slice(start,start+PAGE_WINDOW);
    const elements=visible.map((content,index)=>{
      const sheet=document.createElement('div');sheet.className='epub-sheet';sheet.dataset.density='soft';
      sheet.append(paintSheet(content,width,height,start+index+1));
      // Texto acessível, separado do desenho visual para não criar transparência.
      const accessible=document.createElement('span');accessible.className='epub-accessible-content';
      accessible.textContent=typeof content==='string'?content:(content?.alt||'Ilustração deste livro');
      sheet.append(accessible);
      sheet.setAttribute('aria-label','Página '+(start+index+1));return sheet;
    });
    // O HTMLPage ainda sobrepunha camadas translúcidas no Android. O CanvasRender
    // do próprio St.PageFlip desenha o papel e o verso em uma única superfície;
    // imagens e textos são previamente convertidos em folhas JPEG sem alfa.
    await Promise.all(elements.map(sheet=>sheet.querySelector('canvas')?.ready||Promise.resolve()));
    if(currentDraw!==drawGeneration)return;
    const imagePages=[];
    try{for(const sheet of elements)imagePages.push(sheet.querySelector('canvas').toDataURL('image/jpeg',.97));}
    catch(error){console.warn('Conversão para papel físico indisponível:',error);}
    // St.PageFlip.destroy() pode remover o próprio host. Sempre recriar esse nó
    // evita o EPUB ficar em branco quando muda de capítulo, janela ou tamanho.
    if(flip){try{flip.destroy();}catch{}flip=null;}
    host=document.createElement('div');
    host.id='epubFlip';
    host.className='flip-host '+settings.theme;
    host.style.width=width+'px';host.style.height=height+'px';
    const accessible=document.createElement('span');accessible.id='epubAccessibleText';accessible.className='epub-accessible-content';
    stage.replaceChildren(host,accessible);
    if(document.body.classList.contains('aurora-richdad-volume')){
      // O mesmo miolo e acabamento do PDF, sempre medidos pela folha real do EPUB.
      const volume=document.createElement('div');volume.className='aurora-reader-volume';
      volume.style.width=width+'px';volume.style.height=height+'px';
      for(const part of ['cover','sheets','turned','cut','foot']){
        const element=document.createElement('div');element.className='aurora-reader-volume__'+part;volume.append(element);
      }
      const finish=document.createElement('div');finish.className='aurora-reader-finishing';
      finish.style.width=width+'px';finish.style.height=height+'px';
      for(const part of ['left','gutter','back','cut','bottom']){
        const element=document.createElement('div');element.className='aurora-reader-finishing__'+part;finish.append(element);
      }
      // Exatamente a mesma textura de corte usada no leitor PDF:
      // AuroraEditionSurfaces.paperEdgeCanvas + recorte readerPaperTrim.
      const paperTrim=(orientation)=>{
        try{
          const source=window.AuroraEditionSurfaces?.paperEdgeCanvas?.(orientation);
          if(!source)return '';
          const vertical=orientation==='vertical';
          const left=vertical?7:0,top=vertical?0:Math.round(source.height*.41);
          const w=vertical?Math.min(39,source.width-left):source.width;
          const h=vertical?source.height:Math.min(28,source.height-top);
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
          const context=canvas.getContext('2d',{alpha:false});
          if(!context)return '';
          context.drawImage(source,left,top,w,h,0,0,w,h);
          return 'url('+JSON.stringify(canvas.toDataURL('image/png'))+')';
        }catch(error){console.warn('Textura PDF indisponível no EPUB:',error);return '';}
      };
      const verticalTrim=paperTrim('vertical'),horizontalTrim=paperTrim('horizontal');
      for(const part of [volume.querySelector('.aurora-reader-volume__cut'),finish.querySelector('.aurora-reader-finishing__cut')]){
        if(part&&verticalTrim)part.style.setProperty('background-image',verticalTrim,'important');
      }
      for(const part of [volume.querySelector('.aurora-reader-volume__foot'),finish.querySelector('.aurora-reader-finishing__bottom')]){
        if(part&&horizontalTrim)part.style.setProperty('background-image',horizontalTrim,'important');
      }
      stage.prepend(volume);stage.append(finish);
    }
    windowStart=start;windowLength=visible.length;
    if(window.St?.PageFlip&&elements.length>1){
      try{
        flip=new St.PageFlip(host,{width,height,size:'fixed',showCover:false,drawShadow:true,maxShadowOpacity:.62,
          flippingTime:900,usePortrait:innerWidth<670,mobileScrollSupport:false,swipeDistance:20,autoSize:false});
        if(imagePages.length!==elements.length)throw new Error('Alguma folha não pôde ser convertida.');
        flip.loadFromImages(imagePages);
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
      if(host.parentElement!==stage)stage.replaceChildren(host,accessible);
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
      page=next;working=true;
      drawPages().finally(()=>{working=false;remember();stopSpeech();window.AuroraPageSound?.play();});
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
        const blocks=epub.plainText!==undefined
          ?[{type:'text',text:epub.plainText}]
          :await formats.epubChapterContent(epub,target);
        found=paginateContent(blocks,size.width,size.height);
        if(found.length)break;
        target+=direction;
      }
      if(!found.length)throw new Error('Não encontramos conteúdo legível nos capítulos restantes.');
      chapter=target;
      pages=found;
      page=Math.max(0,Math.min(pages.length-1,desired));
      await drawPages();remember();
    }catch(error){report('Erro ao abrir capítulo: '+error.message);}finally{working=false;}
  }
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
  $('bookmark').addEventListener('click',()=>{const was=$('bookmark').dataset.bookmarked==='true';$('bookmark').dataset.bookmarked=String(!was);$('bookmark').textContent='🔖';$('bookmark').setAttribute('aria-pressed',String(!was));remember();});
  const panel=$('settings');
  function panelOpen(open){panel.hidden=!open;$('settingsButton').setAttribute('aria-expanded',String(open));}
  $('settingsButton').addEventListener('click',()=>panelOpen(panel.hidden));
  $('closeSettings').addEventListener('click',()=>panelOpen(false));
  panel.addEventListener('click',event=>{if(event.target===panel)panelOpen(false);});
  function saveSettings(){try{
    localStorage.setItem('aurora-epub-settings',JSON.stringify(settings));
    localStorage.setItem('aurora-reading-preferences-v2',JSON.stringify({font:settings.font,size:settings.size,line:settings.line,theme:settings.theme}));
  }catch{}}
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
  themeButtons.forEach(button=>button.addEventListener('click',()=>{
    settings.theme=button.dataset.theme;saveSettings();applyTheme();
    if(epub&&pages.length)void drawPages(); // atualizar também a tinta do canvas
  }));
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
      if(txtTitle){
        const texts=JSON.parse(localStorage.getItem('aurora-books')||'{}');
        const source=texts[txtTitle];
        if(typeof source!=='string'||!source.trim())throw new Error('Este TXT não foi encontrado neste aparelho.');
        book={id,format:'txt',name:txtTitle};
        epub={spine:[{path:'texto.txt'}],plainText:source};
      }else{
        book=await formats.readRecord('books',id);
        if(!book||book.format!=='epub')throw new Error('Este EPUB não foi encontrado neste aparelho.');
        epub=await formats.openEpub(book.data);
      }
      $('bookTitle').textContent=window.AuroraTitles?.display(book.name)||book.name;
      if(book.format==='epub'&&isRichDad(book.name||book.title)){
        document.body.classList.add('aurora-richdad-volume');
        stage.setAttribute('aria-label','Livro aberto com lombada, folha esquerda parcialmente visível e bordas de papel');
      }
      const saved=await formats.readRecord('progress',id).catch(()=>null);
      if(Number.isInteger(saved?.bookmark)){$('bookmark').dataset.bookmarked='true';$('bookmark').textContent='🔖';$('bookmark').setAttribute('aria-pressed','true');}
      await loadChapter(Math.max(0,Math.min(epub.spine.length-1,saved?.chapter||0)),saved?.page||0);
      if(txtTitle&&!saved){
        const old=Number(localStorage.getItem('aurora-page-v2:'+txtTitle)||0);
        const restored=Math.max(0,Math.min(pages.length-1,Math.round(old*560/epub.plainText.length*pages.length)));
        if(restored>0){page=restored;await drawPages();remember();}
      }
    }catch(error){report('Não foi possível abrir o livro: '+error.message);}
  })();
})();
