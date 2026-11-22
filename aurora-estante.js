(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(e|de|da|do|dos|das)\b/g,'').replace(/[^a-z0-9]/g, '');
  const categories = [
    {id:'romance', name:'Romances', books:[
      ['Orgulho e Preconceito','Jane Austen'],['Razão e Sensibilidade','Jane Austen'],
      ['A Moreninha','Joaquim M. de Macedo'],['Senhora','José de Alencar']]},
    {id:'adulto', name:'Romance hot', books:[
      ['Entre Velas e Segredos','Conto original'],['Noites de Verão','Conto original'],
      ['Desejo e Distância','Conto original'],['Cartas ao Entardecer','Conto original']]},
    {id:'ficcao', name:'Ficção e aventuras', books:[
      ['A Máquina do Tempo','H. G. Wells'],['A Ilha Misteriosa','Jules Verne'],
      ['Viagem ao Centro da Terra','Jules Verne'],['Frankenstein','Mary Shelley']]},
    {id:'brasileiros', name:'Autores brasileiros', books:[
      ['Dom Casmurro','Machado de Assis'],['Memórias Póstumas','Machado de Assis'],
      ['O Cortiço','Aluísio Azevedo'],['Iracema','José de Alencar']]},
    {id:'filmes',name:'Filmes inspirado em livros',books:[]},
    {id:'veterinaria',name:'Medicina Veterinária',books:[]}
  ];
  const demo = 'Este volume é uma amostra visual da Biblioteca Aurora.\n\nA obra integral ainda não foi adicionada. Importe o seu PDF ou TXT para ler o livro completo com a capa original.\n\nOs seus arquivos ficam guardados neste aparelho.\n\nBoa leitura!';
  const safeRead = (key, fallback) => {
    try {return JSON.parse(localStorage.getItem(key) || '') || fallback;} catch {return fallback;}
  };
  const knownCategories = new Map();
  categories.forEach(cat => cat.books.forEach(([title]) => knownCategories.set(normalize(title),cat.id)));
  const guessCategory = title => {
    const name = normalize(title);
    if (knownCategories.has(name)) return knownCategories.get(name);
    if (/orgulho|preconceito|sensibilidade|austen|moreninha|senhora|romance|amor/.test(name)) return 'romance';
    if (/desejo|picante|seducao|erotico|sensual|noitesdeverao/.test(name)) return 'adulto';
    if (/domcasmurro|cortico|iracema|memoriaspostumas|machadodeassis/.test(name)) return 'brasileiros';
    return 'ficcao';
  };
  const getCategory = (category,title) => categories.some(c=>c.id===category) ? category : guessCategory(title);
  const hash = input => Array.from(input).reduce((sum,ch)=>((sum*31+ch.charCodeAt(0))|0),7)>>>0;
  function readLocalBooks() {
    const hidden=safeRead('aurora-hidden-books',[]);
    return {
      saved:safeRead('aurora-books',{}),
      txtCategories:safeRead('aurora-txt-categories',{}),
      hiddenTitles:new Set(Array.isArray(hidden)?hidden:[])
    };
  }
  function localBooks(category,{saved,txtCategories,hiddenTitles}) {
    const books=new Map(category.books
      .filter(([name])=>!hiddenTitles.has(normalize(name)))
      .map(([name,author])=>[normalize(name),{title:name,author,source:'demo'}]));
    for(const name of Object.keys(saved)){
      if(getCategory(txtCategories[name],name)===category.id)
        books.set(normalize(name),{title:name,author:'Meu arquivo',source:'txt'});
    }
    return books.values();
  }
  // Só os campos necessários para desenhar a lombada. O arquivo do livro fica no IndexedDB.
  function importedItem(book,progress) {
    const source=book.format||'pdf';
    const name=book.name||'Livro sem título';
    const title=window.AuroraTitles?.display(window.AuroraBookInfo?.find(name)?.title||name)||name;
    const author=book.author||'';
    const coverSource=book.coverSource||'original';
    let cover=book.cover||'';
    if(coverSource==='generated'&&title!==name&&window.AuroraFormats?.createDigitalCover){
      try { cover=window.AuroraFormats.createDigitalCover(title,author,source); }
      catch(error){ console.warn('Não foi possível atualizar a capa ilustrativa.',error); }
    }
    return {id:book.id,name,title,author,source,cover,coverSource,
      spine:book.spine||'',spineAspect:book.spineAspect||0,ratio:book.ratio||.72,total:book.total||0,
      category:getCategory(book.category,name),bookmarked:Number.isInteger(progress?.bookmark)};
  }
  function makeSpine(item) {
    const seed = hash(item.title);
    const displayTitle=window.AuroraTitles?.display(item.title)||item.title;
    const button = document.createElement('button');
    button.className = 'book-spine';
    button.type = 'button';
    button.dataset.title = normalize(displayTitle);
    button.dataset.rawTitle = item.title;
    button.dataset.author = item.author || '';
    button.dataset.source = item.source || 'demo';
    if(item.id!=null)button.dataset.bookId=item.id;
    if(item.cover&&item.source!=='demo')button.dataset.coverSource=item.coverSource||'original';
    button.title = displayTitle + (item.source === 'demo' ? ' • livro demonstrativo' : ' • tocar para pegar');
    button.setAttribute('aria-label', 'Pegar ' + displayTitle);
    const realPDF=['pdf','epub','audio'].includes(item.source)||
      (item.source!=='demo'&&Boolean(item.cover||item.spine));
    const pilotTitle=realPDF&&item.cover?[
      [/cinquentatonscinza|fiftyshadesofgrey/,'Cinquenta Tons de Cinza'],
      [/cinquentatonsmaisescuros|cinquentatonsescuros|fiftyshadesdarker/,'Cinquenta Tons Mais Escuros'],
      [/cinquentatonsliberdade|fiftyshadesfreed/,'Cinquenta Tons de Liberdade'],
      [/iracema/,'Iracema']
    ].find(([pattern])=>pattern.test(normalize(displayTitle+' '+item.title)))?.[1]||'':'';
    const fiftyShadesPilot=['Cinquenta Tons de Cinza','Cinquenta Tons Mais Escuros','Cinquenta Tons de Liberdade'].includes(pilotTitle);
    const pilotScale=fiftyShadesPilot?.92:1;
    const bookHeight=Math.round((realPDF?160+seed%17:151+seed%24)*pilotScale);
    const estimatedWidth=Math.round((realPDF?Math.max(28,Math.min(62,27+Number(item.total||0)/27)):37+seed%13)*pilotScale);
    const naturalWidthBase=item.spineAspect?Math.max(22,Math.min(68,bookHeight*Number(item.spineAspect))):estimatedWidth;
    const naturalWidth=Math.round(naturalWidthBase*(fiftyShadesPilot && !item.spine ? .85 : 1));
    const format=Math.max(.59,Math.min(.84,Number(item.ratio)||.72));
    button.style.setProperty('--book-width',naturalWidth+'px');
    button.style.setProperty('--book-height',bookHeight+'px');
    button.style.setProperty('--cover-width',Math.round(bookHeight*format)+'px');
    button.style.setProperty('--premium-height',((seed%25)-5)+'px');
    button.style.setProperty('--premium-width',((seed%11)-3)+'px');
    // Inclinação individual leve: volumes apoiados, não uma fila de réguas.
    button.style.setProperty('--premium-yaw',(-(seed%8)-3)+'deg');
    button.style.setProperty('--premium-lean',(((seed>>3)%7)-3)*.42+'deg');
    button.style.setProperty('--tilt',((seed%5)-2)*.35+'deg');
    button.style.setProperty('--spine-pos',((seed%8)/7*100)+'%');
    if(realPDF && item.spine){
      button.dataset.realSpine='true';
      button.style.backgroundImage='url('+JSON.stringify(item.spine)+')';
    } else if(realPDF && item.cover){
      button.dataset.coverDerived='true';
      button.style.backgroundImage='url('+JSON.stringify(item.cover)+')';
    }
    // A capa é uma face distinta do volume. EPUB sem imagem recebe uma capa
    // identificada como ilustrativa, nunca apresentada como capa original.
    if(realPDF && item.cover){
      const cover=document.createElement('span');
      cover.className='shelf-book-cover';
      cover.setAttribute('aria-hidden','true');
      const image=document.createElement('img');
      image.src=item.cover;
      image.alt='';
      image.loading='lazy';
      image.decoding='async';
      cover.append(image);
      button.append(cover);
      const pages=document.createElement('span');
      pages.className='shelf-book-pages';
      pages.setAttribute('aria-hidden','true');
      button.append(pages);
      button.dataset.hasRealCover='true';
    }
    const label=document.createElement('span');
    label.className='spine-title';
    label.textContent=pilotTitle||displayTitle.replace(/[-_]+/g,' ');
    button.append(label);
    if (item.source && item.source !== 'demo') {
      const source = document.createElement('span');
      source.className='spine-source';
      source.textContent=item.source.toUpperCase();
      button.append(source);
    }
    if (item.bookmarked) {
      const marker=document.createElement('span');
      marker.className='spine-bookmark';
      marker.textContent='◆';
      button.append(marker);
    }
    const hitArea=document.createElement('span');
    hitArea.className='shelf-book-hit-area';
    hitArea.setAttribute('aria-hidden','true');
    button.append(hitArea);
    return button;
  }
  function refreshCount(category) {
    const row=$('shelf-'+category);
    const count=$('count-'+category);
    if (row && count) count.textContent=row.childElementCount+' livros';
  }
  function draw() {
    const library=$('library');
    library.replaceChildren();
    categories.forEach((category,index) => {
      const section=document.createElement('section');
      section.className='category';
      section.id='category-'+category.id;
      section.classList.add('shelf-premium');
      const header=document.createElement('div');
      header.className='section-title';
      const title=document.createElement('h2');
      title.textContent=category.name;
      const count=document.createElement('span');
      count.className='count';
      count.id='count-'+category.id;
      const catalogButton=document.createElement('button');
      catalogButton.type='button';
      catalogButton.className='aurora-catalog-trigger';
      catalogButton.textContent='Catálogos';
      catalogButton.dataset.catalogCategory=category.id;
      catalogButton.setAttribute('aria-label','Abrir catálogo de '+category.name);
      catalogButton.addEventListener('click',()=>window.AuroraCatalogos?.open(category.id));
      header.append(title,catalogButton,count);
      const cabinet=document.createElement('div');
      cabinet.className='cabinet cabinet-'+index;
      const row=document.createElement('div');
      row.className='bookrow';
      row.id='shelf-'+category.id;
      row.setAttribute('aria-label','Livros de '+category.name);
      for (const book of localBooks(category,localState)){
        const openSharedTxt=()=>{location.href='./ler-epub.html?txt='+encodeURIComponent(book.title)+'&v=8';};
        const button=makeSpine(book);
        button.addEventListener('click',()=>{
          if(!window.AuroraShelfViewer?.open){book.source==='txt'?openSharedTxt():openText(book.title);return;}
          const imported=book.source==='txt';
          window.AuroraShelfViewer.open(button,{
            id:(imported?'txt:':'demo:')+normalize(book.title),
            format:imported?'txt':'demo',title:book.title,name:book.title,
            author:book.author,category:getCategory(txtCategories[book.title],book.title),
            total:Math.max(1,Math.ceil((texts[book.title]||demo).length/560)),ratio:.72,
            cover:'',coverSource:'generated',openReader:()=>book.source==='txt'?openSharedTxt():openText(book.title),
            updateCategory:imported?next=>{
              txtCategories[book.title]=next;
              localStorage.setItem('aurora-txt-categories',JSON.stringify(txtCategories));
            }:undefined
          });
        });
        row.append(button);
      }
      cabinet.append(row);
      const lip=document.createElement('div');
      lip.className='shelf-lip';
      cabinet.append(lip);
      section.append(header,cabinet);
      library.append(section);
      refreshCount(category.id);
    });
    document.dispatchEvent(new Event('aurora:shelves-drawn'));
  }
  function persistHidden(){
    try{localStorage.setItem('aurora-hidden-books',JSON.stringify([...hiddenTitles]));}catch{}
  }
  function hideTitle(title){hiddenTitles.add(normalize(title));persistHidden();}
  function restoreTitle(title){hiddenTitles.delete(normalize(title));persistHidden();}
  function removeTextBook(title){
    if(!Object.prototype.hasOwnProperty.call(texts,title))return false;
    delete texts[title];delete saved[title];delete txtCategories[title];
    localStorage.setItem('aurora-books',JSON.stringify(saved));
    localStorage.setItem('aurora-txt-categories',JSON.stringify(txtCategories));
    localStorage.removeItem('aurora-page:'+title);
    localStorage.removeItem('aurora-page-v2:'+title);
    hideTitle(title);
    return true;
  }
  window.AuroraShelf={categories,normalize,guessCategory,getCategory,makeSpine,importedItem,readLocalBooks,localBooks,refreshCount,draw,hideTitle,removeTextBook};
  if(!$('library'))return;
  const localState=readLocalBooks();
  const {saved,txtCategories,hiddenTitles}=localState;
  const texts=Object.assign({},saved);

  const importTrigger=$('importTrigger'),importMenu=$('importMenu'),importCategory=$('importCategory');
  function toggleMenu(open) {
    importMenu.hidden=!open;
    importTrigger.setAttribute('aria-expanded',String(open));
  }
  importTrigger.addEventListener('click',()=>toggleMenu(importMenu.hidden));
  document.addEventListener('click',event=>{
    if (!$('importArea').contains(event.target)) toggleMenu(false);
  });
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape') toggleMenu(false);
  });
  $('txtFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];
    if (!file) return;
    const title=file.name.replace(/\.txt$/i,'').replace(/[_-]+/g,' ').trim();
    try {
      const content=await file.text();
      if (!content.trim()) throw new Error('O arquivo está vazio.');
      texts[title]=content;
      saved[title]=content;
      txtCategories[title]=importCategory.value;
      restoreTitle(title);
      try {
        localStorage.setItem('aurora-books',JSON.stringify(saved));
        localStorage.setItem('aurora-txt-categories',JSON.stringify(txtCategories));
      } catch {
        alert('O livro é grande para o armazenamento local. Ele ficará disponível somente nesta sessão.');
      }
      draw();
      toggleMenu(false);
      const row=$('shelf-'+getCategory(txtCategories[title],title));
      const added=Array.from(row?.querySelectorAll('.book-spine')||[]).find(button=>
        button.dataset.source==='txt'&&button.dataset.title===normalize(title));
      if(added)added.click();else openText(title);
    } catch(error) {
      alert('Não foi possível importar o TXT: '+(error.message||error));
    } finally {event.target.value='';}
  });

  let current='',chunks=[],pageIndex=0,startX=0;
  const txtStep=()=>window.innerWidth>=700?2:1;
  const txtPrefs=(()=>{
    try{return Object.assign({size:17,theme:'sepia'},JSON.parse(localStorage.getItem('aurora-txt-reader-settings-v1')||'{}'));}
    catch{return {size:17,theme:'sepia'};}
  })();
  txtPrefs.size=Math.max(14,Math.min(24,Number(txtPrefs.size)||17));
  if(!['sepia','claro','noite'].includes(txtPrefs.theme))txtPrefs.theme='sepia';
  function applyTxtPrefs(){
    $('overlay').style.setProperty('--txt-font-size',txtPrefs.size+'px');
    $('overlay').dataset.txtTheme=txtPrefs.theme;
    $('txtFontSize').value=String(txtPrefs.size);
    $('txtFontSizeValue').textContent=String(txtPrefs.size);
    $('txtTheme').value=txtPrefs.theme;
    try{localStorage.setItem('aurora-txt-reader-settings-v1',JSON.stringify(txtPrefs));}catch{}
  }
  applyTxtPrefs();
  function toggleTxtPrefs(show){
    $('txtReaderPrefs').hidden=!show;
    $('txtSettingsButton').setAttribute('aria-expanded',String(show));
  }
  $('txtSettingsButton').addEventListener('click',()=>toggleTxtPrefs($('txtReaderPrefs').hidden));
  $('txtPrefsClose').addEventListener('click',()=>toggleTxtPrefs(false));
  $('txtFontSize').addEventListener('input',event=>{txtPrefs.size=Number(event.target.value);applyTxtPrefs();});
  $('txtTheme').addEventListener('change',event=>{txtPrefs.theme=event.target.value;applyTxtPrefs();});
  const say = message => {if('speechSynthesis' in window) speechSynthesis.cancel();};
  function openText(title) {
    current=title;
    const full=texts[title] || demo;
    chunks=full.match(/[\s\S]{1,560}/g) || [''];
    const restored=localStorage.getItem('aurora-page-v2:'+title);
    const old=localStorage.getItem('aurora-page:'+title);
    const stored=restored===null?Number(old||0)*2:Number(restored);
    pageIndex=Math.max(0,Math.min(Number.isFinite(stored)?stored:0,chunks.length-1));
    $('readerTitle').textContent=title;
    $('overlay').classList.add('show');
    $('overlay').setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    showText();
  }
  function showText(animate=false) {
    const step=txtStep();
    $('left').textContent=chunks[pageIndex] || '';
    $('right').hidden=step===1;
    $('right').textContent=step===2?(chunks[pageIndex+1]||''):'';
    $('count').textContent=step===2?(pageIndex+1)+'–'+Math.min(pageIndex+2,chunks.length)+' de '+chunks.length:(pageIndex+1)+' / '+chunks.length;
    if(animate) {
      const paper=step===1?$('left'):$('right');
      paper.classList.remove('flip');
      void paper.offsetWidth;
      paper.classList.add('flip');
    }
    localStorage.setItem('aurora-page-v2:'+current,String(pageIndex));
  }
  function turn(amount) {
    const next=pageIndex+amount*txtStep();
    if(next<0 || next>=chunks.length) return;
    pageIndex=next;
    say();
    showText(true);
    window.AuroraPageSound?.play();
  }
  function closeText() {
    $('overlay').classList.remove('show');
    $('overlay').setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    toggleTxtPrefs(false);
    say();
  }
  $('close').addEventListener('click',closeText);
  $('prev').addEventListener('click',()=>turn(-1));
  $('next').addEventListener('click',()=>turn(1));
  $('listen').addEventListener('click',()=>{
    if (!('speechSynthesis' in window)) return;
    say();
    const utterance=new SpeechSynthesisUtterance($('left').textContent+' '+$('right').textContent);
    utterance.lang='pt-BR';utterance.rate=.9;
    speechSynthesis.speak(utterance);
  });
  $('stop').addEventListener('click',say);
  $('openbook').addEventListener('touchstart',event=>startX=event.touches[0].clientX,{passive:true});
  $('openbook').addEventListener('touchend',event=>{
    const distance=event.changedTouches[0].clientX-startX;
    if(Math.abs(distance)>55) turn(distance<0?1:-1);
  },{passive:true});
  window.addEventListener('resize',()=>{if($('overlay').classList.contains('show'))showText();});
  document.addEventListener('keydown',event=>{
    if(!$('overlay').classList.contains('show')) return;
    if(event.key==='ArrowRight') turn(1);
    if(event.key==='ArrowLeft') turn(-1);
    if(event.key==='Escape') closeText();
  });
  draw();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
