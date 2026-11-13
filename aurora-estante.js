(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(e|de|da|do|dos|das)\b/g,'').replace(/[^a-z0-9]/g, '');
  const categories = [
    {id:'romance', name:'Romances', books:[
      ['Orgulho e Preconceito','Jane Austen'],['Razão e Sensibilidade','Jane Austen'],
      ['A Moreninha','Joaquim M. de Macedo'],['Senhora','José de Alencar']]},
    {id:'adulto', name:'Romances picantes', books:[
      ['Entre Velas e Segredos','Conto original'],['Noites de Verão','Conto original'],
      ['Desejo e Distância','Conto original'],['Cartas ao Entardecer','Conto original']]},
    {id:'ficcao', name:'Ficção e aventuras', books:[
      ['A Máquina do Tempo','H. G. Wells'],['A Ilha Misteriosa','Jules Verne'],
      ['Viagem ao Centro da Terra','Jules Verne'],['Frankenstein','Mary Shelley']]},
    {id:'brasileiros', name:'Autores brasileiros', books:[
      ['Dom Casmurro','Machado de Assis'],['Memórias Póstumas','Machado de Assis'],
      ['O Cortiço','Aluísio Azevedo'],['Iracema','José de Alencar']]}
  ];
  const demo = 'Este volume é uma amostra visual da Biblioteca Aurora.\n\nA obra integral ainda não foi adicionada. Importe o seu PDF ou TXT para ler o livro completo com a capa original.\n\nOs seus arquivos ficam guardados neste aparelho.\n\nBoa leitura!';
  const safeRead = (key, fallback) => {
    try {return JSON.parse(localStorage.getItem(key) || '') || fallback;} catch {return fallback;}
  };
  const saved = safeRead('aurora-books',{});
  const txtCategories = safeRead('aurora-txt-categories',{});
  const texts = Object.assign({},saved);
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
  function makeSpine(item) {
    const seed = hash(item.title);
    const button = document.createElement('button');
    button.className = 'book-spine';
    button.type = 'button';
    button.dataset.title = normalize(item.title);
    button.dataset.source = item.source || 'demo';
    button.title = item.title + (item.source === 'demo' ? ' • livro demonstrativo' : ' • tocar para pegar');
    button.setAttribute('aria-label', 'Pegar ' + item.title);
    const bookHeight=151+seed%24;
    const estimatedWidth=item.source==='pdf'?Math.max(29,Math.min(64,29+Number(item.total||0)/25)):37+seed%13;
    const naturalWidth=item.spineAspect?Math.max(22,Math.min(68,bookHeight*Number(item.spineAspect))):estimatedWidth;
    button.style.setProperty('--book-width',naturalWidth+'px');
    button.style.setProperty('--book-height',bookHeight+'px');
    button.style.setProperty('--tilt',((seed%5)-2)*.35+'deg');
    button.style.setProperty('--spine-pos',((seed%8)/7*100)+'%');
    if(item.source==='pdf' && item.spine){
      button.dataset.realSpine='true';
      button.style.backgroundImage='url('+JSON.stringify(item.spine)+')';
    } else if(item.source==='pdf' && item.cover){
      button.dataset.coverDerived='true';
      button.style.backgroundImage='url('+JSON.stringify(item.cover)+')';
    }
    const label=document.createElement('span');
    label.className='spine-title';
    label.textContent=item.title.replace(/[-_]+/g,' ');
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
      const header=document.createElement('div');
      header.className='section-title';
      const title=document.createElement('h2');
      title.textContent=category.name;
      const count=document.createElement('span');
      count.className='count';
      count.id='count-'+category.id;
      header.append(title,count);
      const cabinet=document.createElement('div');
      cabinet.className='cabinet cabinet-'+index;
      const row=document.createElement('div');
      row.className='bookrow';
      row.id='shelf-'+category.id;
      row.setAttribute('aria-label','Livros de '+category.name);
      const shelfBooks=new Map(category.books.map(([name,author])=>[normalize(name),{title:name,author,source:'demo'}]));
      Object.keys(saved).forEach(name=>{
        if(getCategory(txtCategories[name],name)===category.id) {
          shelfBooks.set(normalize(name),{title:name,author:'Meu arquivo',source:'txt'});
        }
      });
      shelfBooks.forEach(book=>{
        const button=makeSpine(book);
        button.addEventListener('click',()=>openText(book.title));
        row.append(button);
      });
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
  window.AuroraShelf={categories,normalize,guessCategory,getCategory,makeSpine,refreshCount,draw};

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
  importCategory.addEventListener('change',()=>{$('pdfLink').href='./meus-livros.html?categoria='+encodeURIComponent(importCategory.value);});
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
      try {
        localStorage.setItem('aurora-books',JSON.stringify(saved));
        localStorage.setItem('aurora-txt-categories',JSON.stringify(txtCategories));
      } catch {
        alert('O livro é grande para o armazenamento local. Ele ficará disponível somente nesta sessão.');
      }
      draw();
      toggleMenu(false);
      openText(title);
    } catch(error) {
      alert('Não foi possível importar o TXT: '+(error.message||error));
    } finally {event.target.value='';}
  });

  let current='',chunks=[],pageIndex=0,startX=0;
  const say = message => {if('speechSynthesis' in window) speechSynthesis.cancel();};
  function openText(title) {
    current=title;
    const full=texts[title] || demo;
    chunks=full.match(/[\s\S]{1,560}/g) || [''];
    const stored=Number(localStorage.getItem('aurora-page:'+title) || 0);
    pageIndex=Math.max(0,Math.min(Number.isFinite(stored)?stored:0,Math.ceil(chunks.length/2)-1));
    $('readerTitle').textContent=title;
    $('overlay').classList.add('show');
    $('overlay').setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    showText();
  }
  function showText(animate=false) {
    $('left').textContent=chunks[pageIndex*2] || '';
    $('right').textContent=chunks[pageIndex*2+1] || '';
    $('count').textContent=(pageIndex*2+1)+'–'+Math.min(pageIndex*2+2,chunks.length)+' de '+chunks.length;
    if(animate) {
      $('right').classList.remove('flip');
      void $('right').offsetWidth;
      $('right').classList.add('flip');
    }
    localStorage.setItem('aurora-page:'+current,String(pageIndex));
  }
  function turn(amount) {
    const next=pageIndex+amount;
    if(next<0 || next>=Math.ceil(chunks.length/2)) return;
    pageIndex=next;
    say();
    showText(true);
  }
  function closeText() {
    $('overlay').classList.remove('show');
    $('overlay').setAttribute('aria-hidden','true');
    document.body.style.overflow='';
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
  document.addEventListener('keydown',event=>{
    if(!$('overlay').classList.contains('show')) return;
    if(event.key==='ArrowRight') turn(1);
    if(event.key==='ArrowLeft') turn(-1);
    if(event.key==='Escape') closeText();
  });
  draw();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
