/* Catálogo visual de cada prateleira: nenhuma cópia dos arquivos é criada.
   Cada cartão aponta para o mesmo livro que já abre em 3D na estante. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const overlay=$('auroraCatalogOverlay');
  const grid=$('auroraCatalogGrid');
  const more=$('auroraCatalogMore');
  if(!overlay||!grid||!more||!window.AuroraShelf)return;
  const shelf=window.AuroraShelf;
  const savedGenerated=new Map();
  const PAGE_SIZE=9;
  const DEFAULT_TURN=22;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  let paperEdgeURL='';
  function paperEdges(){
    if(paperEdgeURL)return paperEdgeURL;
    try{paperEdgeURL=window.AuroraEditionSurfaces?.paperEdgeCanvas?.('vertical')?.toDataURL('image/png')||'';}
    catch(error){console.warn('Textura das folhas indisponível:',error);}
    return paperEdgeURL;
  }
  let current=null,visible=PAGE_SIZE,returnFocus=null;
  const showCount=count=>count===1?'1 livro':count+' livros';

  function buttonsInCategory(category){
    const row=$('shelf-'+category);
    return row?Array.from(row.querySelectorAll('.book-spine')):[];
  }
  function getTitle(button){
    const text=button.querySelector('.spine-title')?.textContent?.trim();
    return text||button.dataset.rawTitle||'Livro sem título';
  }
  function generatedCover(button,title){
    const format=button.dataset.source||'demo';
    const key=button.dataset.bookId||format+':'+button.dataset.rawTitle;
    if(savedGenerated.has(key))return savedGenerated.get(key);
    let image='';
    try{image=window.AuroraFormats?.createDigitalCover?.(title,button.dataset.author,format)||'';}
    catch(error){console.warn('Capa ilustrativa indisponível:',error);}
    if(image)savedGenerated.set(key,image);
    return image;
  }
  function fillImage(holder,button,title){
    const existing=button.querySelector('.shelf-book-cover img');
    const cover=existing?.getAttribute('src')||generatedCover(button,title);
    if(!cover){
      const text=document.createElement('span');text.className='aurora-catalog-fallback';
      text.textContent=title;holder.append(text);return;
    }
    const image=document.createElement('img');
    image.src=cover;
    image.loading='lazy';image.decoding='async';
    image.alt=(existing?'Capa de ':'Capa ilustrativa de ')+title;
    image.addEventListener('error',()=>{
      // Nunca fazer uma imagem quebrada parecer a capa verdadeira do arquivo.
      if(image.dataset.fallback==='1'){
        const text=document.createElement('span');text.className='aurora-catalog-fallback';
        text.textContent=title;image.replaceWith(text);return;
      }
      const fallback=generatedCover(button,title);
      if(!fallback||fallback===image.src){
        const text=document.createElement('span');text.className='aurora-catalog-fallback';
        text.textContent=title;image.replaceWith(text);return;
      }
      image.dataset.fallback='1';image.src=fallback;image.alt='Capa ilustrativa de '+title;
    });
    holder.append(image);
  }
  function volumeFor(button,title,card){
    const holder=document.createElement('span');
    holder.className='aurora-catalog-cover';
    holder.setAttribute('aria-hidden','true');
    const volume=document.createElement('span');
    volume.className='aurora-catalog-volume';
    volume.style.setProperty('--catalog-turn',DEFAULT_TURN+'deg');
    // Espessura proporcional ao volume, sem alterar a imagem da capa.
    const thickness=clamp((parseFloat(button.style.getPropertyValue('--book-width'))||46)*.45,18,26);
    volume.style.setProperty('--catalog-depth',thickness+'px');

    const front=document.createElement('span');
    front.className='aurora-catalog-face aurora-catalog-front';
    fillImage(front,button,title);

    const back=document.createElement('span');
    back.className='aurora-catalog-face aurora-catalog-back-face';
    const backText=document.createElement('span');
    backText.className='aurora-catalog-back-text';
    const backTitle=document.createElement('strong');
    backTitle.textContent=title;
    const backNote=document.createElement('small');
    backNote.textContent='Contracapa ilustrativa';
    backText.append(backTitle,backNote);
    back.append(backText);

    const spine=document.createElement('span');
    spine.className='aurora-catalog-spine';
    const source=front.querySelector('img')?.getAttribute('src')||'';
    const realSpine=button.dataset.realSpine==='true'||button.dataset.spineCrisp==='true';
    const spinePhoto=realSpine?button.style.backgroundImage:'';
    if(spinePhoto&&spinePhoto!=='none'){
      spine.style.backgroundImage=spinePhoto;
      spine.style.backgroundSize='100% 100%';
    }else if(source){
      spine.style.backgroundImage='url('+JSON.stringify(source)+')';
      spine.style.backgroundSize='auto 100%';
      spine.style.backgroundPosition='left center';
    }

    const pages=document.createElement('span');
    pages.className='aurora-catalog-pages';
    const edge=paperEdges();
    if(edge)pages.style.backgroundImage='url('+JSON.stringify(edge)+')';
    volume.append(front,back,spine,pages);
    holder.append(volume);

    let angle=DEFAULT_TURN,drag=null,suppressUntil=0;
    const setTurn=next=>{
      angle=clamp(next,-195,195);
      volume.style.setProperty('--catalog-turn',angle+'deg');
      if(Math.abs(angle)>67)void loadBack();
    };
    async function loadBack(){
      if(back.dataset.status)return;
      back.dataset.status='loading';
      try{
        const id=button.dataset.bookId;
        const formats=window.AuroraFormats;
        const saved=id&&formats?.readRecord?await formats.readRecord('books',id):null;
        if(!holder.isConnected)return;
        if(saved?.back){
          back.style.backgroundImage='url('+JSON.stringify(saved.back)+')';
          back.classList.add('has-photo','has-art');
          return;
        }
        const image=front.querySelector('img');
        if(image&&!image.complete){
          await new Promise(resolve=>{
            image.addEventListener('load',resolve,{once:true});
            image.addEventListener('error',resolve,{once:true});
          });
        }
        if(!holder.isConnected||!image?.naturalWidth)return;
        const surfaces=window.AuroraEditionSurfaces?.generate?.(image,{
          name:title,title,author:button.dataset.author||'',description:saved?.description||'',back:''
        });
        if(surfaces?.back){
          const preview=document.createElement('canvas');
          preview.width=440;preview.height=620;
          preview.getContext('2d').drawImage(surfaces.back,0,0,440,620);
          back.style.backgroundImage='url('+JSON.stringify(preview.toDataURL('image/jpeg',.86))+')';
          back.classList.add('has-art');
        }
      }catch(error){
        console.warn('Contracapa do catálogo não pôde ser preparada:',error);
      }finally{back.dataset.status='ready';}
    }

    card.addEventListener('pointerdown',event=>{
      if(event.button!==0||!holder.contains(event.target))return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,angle,moved:false};
    });
    card.addEventListener('pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.moved&&Math.abs(dx)<7)return;
      if(!drag.moved&&Math.abs(dy)>Math.abs(dx)*1.3)return;
      drag.moved=true;
      volume.classList.add('is-turning');
      if(card.setPointerCapture&&!card.hasPointerCapture(event.pointerId))card.setPointerCapture(event.pointerId);
      setTurn(drag.angle-dx*1.27);
    });
    const finish=(event,cancelled=false)=>{
      if(!drag||drag.id!==event.pointerId)return;
      if(drag.moved&&!cancelled)suppressUntil=Date.now()+450;
      drag=null;volume.classList.remove('is-turning');
    };
    card.addEventListener('pointerup',event=>finish(event));
    card.addEventListener('pointercancel',event=>finish(event,true));
    card.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();
        setTurn(angle+(event.key==='ArrowLeft'?45:-45));
      }
    });
    return {holder,wasTurning:()=>Date.now()<suppressUntil};
  }
  function cardFor(button){
    const title=getTitle(button);
    const card=document.createElement('button');
    card.type='button';card.className='aurora-catalog-card';
    card.setAttribute('aria-label','Abrir '+title+' em 3D. Arraste a capa para girar e ver a contracapa.');
    const {holder,wasTurning}=volumeFor(button,title,card);
    const name=document.createElement('span');name.className='aurora-catalog-name';name.textContent=title;
    const type=document.createElement('span');type.className='aurora-catalog-type';
    const labels={pdf:'PDF',epub:'EPUB',txt:'TXT',audio:'AUDIOLIVRO',online:'ON-LINE',demo:'DEMONSTRAÇÃO'};
    type.textContent=labels[button.dataset.source]||'LIVRO';
    card.append(holder,name,type);
    card.addEventListener('click',event=>{
      if(wasTurning()){event.preventDefault();return;}
      close(false);
      // Reaproveita a entrada real: voo, giro, descrição e leitor do mesmo livro.
      button.click();
    });
    return card;
  }
  function render(){
    if(!current||overlay.hidden)return;
    const category=shelf.categories.find(item=>item.id===current);
    if(!category)return;
    const books=buttonsInCategory(current);
    $('auroraCatalogTitle').textContent=category.name;
    $('auroraCatalogTotal').textContent=showCount(books.length);
    const cards=books.slice(0,visible).map(cardFor);
    if(!cards.length){
      const empty=document.createElement('p');empty.className='aurora-catalog-empty';
      empty.textContent='Esta prateleira ainda não tem livros. Importe um livro para vê-lo aqui.';
      cards.push(empty);
    }
    grid.replaceChildren(...cards);
    more.hidden=books.length<=visible;
  }
  function close(restore=true){
    if(overlay.hidden)return;
    overlay.hidden=true;document.body.classList.remove('aurora-catalog-open');
    current=null;
    if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }
  function open(category){
    if(!shelf.categories.some(item=>item.id===category))return;
    if(!overlay.hidden)close(false);
    returnFocus=document.activeElement;
    current=category;visible=PAGE_SIZE;
    overlay.hidden=false;document.body.classList.add('aurora-catalog-open');
    render();overlay.scrollTop=0;
    $('auroraCatalogBack').focus({preventScroll:true});
  }
  $('auroraCatalogBack').addEventListener('click',()=>close());
  more.addEventListener('click',()=>{
    visible+=PAGE_SIZE;render();
    // Preserva o foco no controle caso ele ainda esteja visível.
    if(!more.hidden)more.focus({preventScroll:true});
    else grid.lastElementChild?.focus?.({preventScroll:true});
  });
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const all=Array.from(overlay.querySelectorAll('button:not([hidden]):not([disabled])'));
    if(!all.length)return;
    const first=all[0],last=all[all.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  // PDF, EPUB, áudio e títulos on-line entram nas prateleiras de modo assíncrono.
  // Quando a linha recebe ou perde um livro, o catálogo aberto se atualiza.
  const library=$('library');
  if(library&&typeof MutationObserver!=='undefined'){
    new MutationObserver(()=>{if(current&&!overlay.hidden)render();})
      .observe(library,{subtree:true,childList:true});
  }
  document.addEventListener('aurora:book-cover-updated',()=>{if(current&&!overlay.hidden)render();});
  window.AuroraCatalogos={open,close};
})();
