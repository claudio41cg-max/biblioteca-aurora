/* Reações e exclusão do visor 3D. Mantém arquivos e progresso ao retirar da estante. */
(()=>{
'use strict';
const H='aurora-retirados-estante-v1';
const R='aurora-reacoes-livros-v1';
const P='aurora-estante-exemplares-v1:';
const LIBRARY_LOCK='aurora-acervo-local';
const fileFormats=new Set(['pdf','epub','audio']);
const read=(key,fallback)=>{
  try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}
  catch{return fallback;}
};
function readForWrite(key, array=false){
  const fallback=array?[]:{};
  const value=JSON.parse(localStorage.getItem(key)??JSON.stringify(fallback));
  if(!value||typeof value!=='object'||Array.isArray(value)!==array){
    throw new Error('Não foi possível ler os dados deste acervo.');
  }
  return value;
}
let localQueue=Promise.resolve();
function withLibraryLock(work){
  if(globalThis.navigator?.locks)return navigator.locks.request(LIBRARY_LOCK,work);
  const job=localQueue.then(work);
  localQueue=job.catch(()=>{});
  return job;
}
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const keyOf=(source,id,title)=>fileFormats.has(source)?'arquivo:'+id:source+':'+(source==='online'?id:title);
const keyFor=button=>keyOf(button.dataset.source,button.dataset.bookId,button.dataset.rawTitle);
const isHidden=key=>read(H,[]).includes(key);
function setHidden(key,hide){
  const hidden=new Set(readForWrite(H,true));
  if(hide)hidden.add(key);else hidden.delete(key);
  write(H,[...hidden]);
}
function mark(button){
  if(isHidden(keyFor(button)))button.dataset.auroraShelved='no';
  else delete button.dataset.auroraShelved;
}
function sync(){
  document.querySelectorAll('#library .bookrow > .book-spine').forEach(mark);
  window.AuroraShelf?.categories.forEach(category=>window.AuroraShelf.refreshCount(category.id));
  document.dispatchEvent(new Event('aurora:shelf-visibility'));
}
function reactionState(value){
  if(typeof value==='string')return {reaction:value==='love'?'':value,favorite:value==='love'};
  return {reaction:value?.reaction||'',favorite:value?.favorite===true};
}
const reaction=key=>reactionState(read(R,{})[key]).reaction;
const isFavorite=key=>reactionState(read(R,{})[key]).favorite;
function changeReaction(key,change){
  const all=readForWrite(R);
  const next=reactionState(all[key]);
  change(next);
  if(next.favorite||next.reaction)all[key]=next;
  else delete all[key];
  write(R,all);
  return next;
}
function setReaction(key,value){
  return changeReaction(key,next=>{next.reaction=next.reaction===value?'':value;}).reaction;
}
function toggleFavorite(key){
  return changeReaction(key,next=>{next.favorite=!next.favorite;}).favorite;
}

async function removeReadingRecords(source,id,title){
  const imported=fileFormats.has(source);
  const db=await window.AuroraFormats.database();
  try{
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(imported?['books','progress']:['progress'],'readwrite');
      tx.oncomplete=resolve;
      tx.onabort=()=>reject(tx.error||new Error('Exclusão interrompida.'));
      const progress=tx.objectStore('progress');
      if(imported){
        tx.objectStore('books').delete(id);
        progress.delete(id);
      }else progress.delete('txt:'+title);
    });
  }finally{db.close();}
}

function planRemoval({source,id,title,key}){
  const changes=new Map();
  const set=(storageKey,value)=>changes.set(storageKey,JSON.stringify(value));
  const removeEntry=(storageKey,entryKey)=>{
    const entries=readForWrite(storageKey);
    if(Object.hasOwn(entries,entryKey)){
      delete entries[entryKey];
      set(storageKey,entries);
    }
  };
  for(let index=0;index<localStorage.length;index++){
    const storageKey=localStorage.key(index);
    if(!storageKey?.startsWith(P))continue;
    const members=readForWrite(storageKey,true);
    if(!members.some(member=>member?.key===key||member?.pose?.stackOn===key))continue;
    set(storageKey,members.filter(member=>member?.key!==key).map(member=>{
      if(member?.pose?.stackOn!==key)return member;
      const pose={...member.pose,y:0,stackOffset:0};
      delete pose.stackOn;
      return {...member,pose};
    }));
  }
  const hidden=readForWrite(H,true);
  if(hidden.includes(key))set(H,hidden.filter(entry=>entry!==key));
  removeEntry(R,key);

  if(source==='online'){
    const storageKey='aurora-online-books-v1';
    const entries=readForWrite(storageKey,true);
    set(storageKey,entries.filter(book=>book?.key!==id));
  }else if(source==='txt'){
    removeEntry('aurora-books',title);
    removeEntry('aurora-txt-categories',title);
    for(const prefix of ['aurora-page:','aurora-page-v2:'])changes.set(prefix+title,null);
  }else if(!fileFormats.has(source)&&source!=='demo'){
    throw new Error('Formato não reconhecido.');
  }
  if(source!=='online'){
    const storageKey='aurora-hidden-books';
    const hiddenSamples=new Set(readForWrite(storageKey,true));
    const normalize=window.AuroraShelf?.normalize||(value=>String(value).normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(e|de|da|do|dos|das)\b/g,'').replace(/[^a-z0-9]/g,''));
    hiddenSamples.add(normalize(title));
    set(storageKey,[...hiddenSamples]);
  }
  return changes;
}

async function erase(book){
  return withLibraryLock(async()=>{
    const before=new Map();
    const apply=(key,value)=>value===null?localStorage.removeItem(key):localStorage.setItem(key,value);
    try{
      // Termine a limpeza de referências antes de apagar o arquivo. Se uma
      // gravação ou a transação falhar, restaure somente os dados já alterados.
      for(const [key,value] of planRemoval(book)){
        const previous=localStorage.getItem(key);
        if(previous===value)continue;
        apply(key,value);
        before.set(key,previous);
      }
      if(fileFormats.has(book.source)||book.source==='txt'){
        await removeReadingRecords(book.source,book.id,book.title);
      }
    }catch(error){
      let restored=true;
      for(const [key,previous] of [...before].reverse()){
        try{apply(key,previous);}catch{restored=false;}
      }
      if(!restored)throw new Error('Não foi possível restaurar todos os vínculos. O arquivo não foi apagado.',{cause:error});
      throw error;
    }
  });
}
function capture(scene,css,options={}){
 try{if(scene.classList.contains('three-ready')&&!scene.classList.contains('aurora-force-css')){
  const frame=window.Aurora3D?.captureFrame?.(options);if(frame){
   const c=document.createElement('canvas'),s=Math.min(1,900/Math.max(frame.width,frame.height));c.width=Math.max(1,Math.round(frame.width*s));c.height=Math.max(1,Math.round(frame.height*s));
   const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(frame,0,0,c.width,c.height);
   const w=c.width,h=c.height,d=ctx.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>18){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
   if(x1>=x0&&y1>=y0){const image=document.createElement('canvas');image.width=x1-x0+1;image.height=y1-y0+1;image.getContext('2d').drawImage(c,x0,y0,image.width,image.height,0,0,image.width,image.height);
    const r=scene.getBoundingClientRect(),left=r.left+x0/w*r.width,top=r.top+y0/h*r.height,width=image.width/w*r.width,height=image.height/h*r.height,bounds={left,top,width,height,right:left+width,bottom:top+height};
    const clip={left:Math.max(0,left),top:Math.max(0,top),right:Math.min(innerWidth,bounds.right),bottom:Math.min(innerHeight,bounds.bottom)};clip.width=clip.right-clip.left;clip.height=clip.bottom-clip.top;if(clip.width>2&&clip.height>2)return {element:scene,image,bounds,clip}
   }
  }
 }}catch(e){console.warn('Captura WebGL indisponível:',e)}
 const shot=window.AuroraBookParticles?.capture(css);if(shot)shot.element=scene;return shot;
}
function mount(root,getBook,handlers){
  const panel=root.querySelector('.aurora-book-actions');
  if(!panel)return;
  const status=panel.querySelector('[role=status]');
  const menu=panel.querySelector('.aurora-delete-options');
  const remove=panel.querySelector('[data-book-action=delete]');
  const restore=panel.querySelector('[data-book-action=restore]');
  const skip=root.querySelector('#auroraSkipRemoval');
  const scene=root.querySelector('#scene');
  let busy=false,animation=null;

  function closeMenu(){
    stopHold();
    menu.hidden=true;
    remove.setAttribute('aria-expanded','false');
  }
  function refresh(){
    closeMenu();
    status.textContent='';
    const book=getBook();
    if(!book)return;
    for(const button of panel.querySelectorAll('[data-reaction]')){
      const name=button.dataset.reaction;
      button.setAttribute('aria-pressed',String(name==='favorite'?isFavorite(book.key):name===reaction(book.key)));
    }
    const hidden=!book.personal&&isHidden(book.key);
    restore.hidden=!hidden;
    menu.querySelector('[data-remove-scope=shelf]').hidden=hidden;
  }
  function openMenu({focus=false}={}){
    if(busy||!getBook())return false;
    menu.hidden=false;
    remove.setAttribute('aria-expanded','true');
    if(focus)menu.querySelector('button:not([hidden])')?.focus();
    return true;
  }
  let hold=null;
  function stopHold(){
    if(hold)clearTimeout(hold.timer);
    hold=null;
  }
  function openHeldMenu(){
    stopHold();
    handlers.cancelDrag?.();
    window.Aurora3D?.cancelGesture?.();
    openMenu({focus:true});
  }
  scene.addEventListener('pointerdown',event=>{
    if(busy||!menu.hidden){
      event.stopImmediatePropagation();
      event.preventDefault();
      if(!busy)closeMenu();
      return;
    }
    if(!getBook()||!event.isPrimary||event.button!==0)return;
    const model=event.target.closest('#book3d,.aurora-webgl');
    if(!model)return;
    if(model.matches('.aurora-webgl')&&!window.Aurora3D?.hitsBook(event.clientX,event.clientY))return;
    stopHold();
    hold={x:event.clientX,y:event.clientY,id:event.pointerId,timer:setTimeout(openHeldMenu,550)};
  },true);
  window.addEventListener('pointermove',event=>{
    if(hold?.id===event.pointerId&&Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>9)stopHold();
  },true);
  for(const type of ['pointerup','pointercancel']){
    window.addEventListener(type,event=>{if(hold?.id===event.pointerId)stopHold();},true);
  }
  window.addEventListener('blur',stopHold);
  root.addEventListener('scroll',stopHold,{passive:true});
  scene.addEventListener('contextmenu',event=>{if(hold||!menu.hidden)event.preventDefault();});
  scene.addEventListener('keydown',event=>{
    if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){
      if(openMenu({focus:true})){
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  },true);
  for(const [name,emoji,label] of [
    ['like','👍','Gostei'],['dislike','👎','Não gostei'],
    ['favorite','❤️','Meus favoritos'],['cry','😢','Me fez chorar']
  ]){
    const button=document.createElement('button');
    button.type='button';
    button.dataset.reaction=name;
    button.setAttribute('aria-pressed','false');
    const icon=document.createElement('span');
    icon.textContent=emoji;
    icon.setAttribute('aria-hidden','true');
    const text=document.createElement('small');
    text.textContent=label;
    button.append(icon,text);
    panel.querySelector('.aurora-reactions').insertBefore(button,remove);
    button.onclick=async()=>{
      const book=getBook();
      if(!book||busy)return;
      try{
        await withLibraryLock(()=>name==='favorite'?toggleFavorite(book.key):setReaction(book.key,name));
        if(getBook()?.key!==book.key)return;
        refresh();
        status.textContent=name==='favorite'
          ?isFavorite(book.key)?'Adicionado aos favoritos.':'Retirado dos favoritos.'
          :'Reação salva neste aparelho.';
      }catch{status.textContent='Não foi possível salvar a reação.';}
    };
  }

  remove.onclick=()=>{if(menu.hidden)openMenu();else closeMenu();};
  menu.querySelector('[data-remove-scope=cancel]').onclick=()=>{closeMenu();remove.focus();};
  restore.onclick=async()=>{
    const book=getBook();
    if(!book||busy)return;
    try{
      await withLibraryLock(()=>setHidden(book.key,false));
      sync();
      refresh();
      status.textContent='Livro devolvido à estante.';
    }catch{status.textContent='Não foi possível devolver o livro.';}
  };
  const stop=()=>animation?.abort();
  skip?.addEventListener('click',stop);

  for(const button of menu.querySelectorAll('[data-remove-scope=shelf],[data-remove-scope=app]')){
    button.onclick=async()=>{
      const book=getBook(),scope=button.dataset.removeScope;
      if(!book||busy)return;
      if(scope==='app'&&!confirm('Excluir permanentemente “'+book.title+'”? O livro e o progresso serão removidos do app. O arquivo original no celular será preservado.'))return;
      busy=true;
      panel.querySelectorAll('button').forEach(item=>item.disabled=true);
      try{
        // Enquadre o volume antes de capturá-lo, inclusive após rolar até as opções.
        const scroll=root.scrollTop;
        root.scrollTop=0;
        const shot=capture(scene,root.querySelector('#book3d'));
        root.scrollTop=scroll;
        if(scope==='app')await erase(book);
        else if(book.personal)await handlers.removePersonal(book);
        else await withLibraryLock(()=>setHidden(book.key,true));

        closeMenu();
        if(getBook()?.session===book.session&&shot){
          root.scrollTop=0;
          animation=new AbortController();
          const opacity=scene.style.opacity;
          scene.style.opacity='0';
          if(skip){skip.hidden=false;skip.focus({preventScroll:true});}
          try{await window.AuroraBookParticles?.play(shot,{signal:animation.signal});}
          catch{/* A operação já foi salva. */}
          finally{
            scene.style.opacity=opacity;
            if(skip)skip.hidden=true;
            animation=null;
          }
        }
        sync();
        handlers.done(scope,book);
      }catch(error){status.textContent='Não foi possível concluir: '+(error?.message||error);}
      finally{
        busy=false;
        panel.querySelectorAll('button').forEach(item=>item.disabled=false);
      }
    };
  }
  return {refresh,openMenu,closeMenu,isOpen:()=>!menu.hidden,isBusy:()=>busy,stop};
}

window.AuroraBookActions={
  keyOf,keyFor,isHidden,setHidden,mark,sync,reaction,setReaction,isFavorite,toggleFavorite,
  erase,capture,mount,withLibraryLock
};
})();
