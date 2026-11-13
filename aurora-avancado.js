/* Ferramentas locais: ambiente, organização apenas em pé e progresso de leitura. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const shelf=window.AuroraShelf;
  if(!shelf) return;
  const safeJSON=(key,def)=>{
    try{return JSON.parse(localStorage.getItem(key))||def;}catch{return def;}
  };
  const orderKey='aurora-shelf-order-v1';
  const savedOrder=safeJSON(orderKey,{});
  const roomKey='aurora-room-v1';
  const room=Object.assign({theme:'aurora',light:100,plants:true},safeJSON(roomKey,{}));
  let arranging=false,selected=null,libraryBooks=[],progress=[];

  const themeSelect=$('roomTheme'),lightInput=$('roomLight'),plantInput=$('roomPlants');
  themeSelect.value=room.theme;
  lightInput.value=room.light;
  plantInput.checked=room.plants;
  function applyRoom(){
    document.body.dataset.theme=room.theme;
    document.body.dataset.plants=room.plants?'on':'off';
    document.body.style.setProperty('--room-light',String((Number(room.light)||100)/100));
    try{localStorage.setItem(roomKey,JSON.stringify(room));}catch{}
  }
  themeSelect.addEventListener('change',()=>{room.theme=themeSelect.value;applyRoom();});
  lightInput.addEventListener('input',()=>{room.light=Number(lightInput.value);applyRoom();});
  plantInput.addEventListener('change',()=>{room.plants=plantInput.checked;applyRoom();});
  applyRoom();

  const panels=[[$('roomButton'),$('roomPanel')],[$('statsButton'),$('statsPanel')]];
  panels.forEach(([button,panel])=>{
    button.addEventListener('click',()=>{
      const opening=panel.hidden;
      panels.forEach(([b,p])=>{p.hidden=true;b.setAttribute('aria-expanded','false');});
      panel.hidden=!opening;
      button.setAttribute('aria-expanded',String(opening));
      if(opening && panel.id==='statsPanel') refreshStats();
    });
  });
  function returnToShelf(){
    panels.forEach(([button,panel])=>{
      panel.hidden=true;
      button.setAttribute('aria-expanded','false');
    });
    $('library').scrollIntoView({behavior:'smooth',block:'start'});
  }
  document.querySelectorAll('.back-to-shelf').forEach(button=>{
    button.addEventListener('click',returnToShelf);
  });

  const bookKey=book=>{
    if(book.dataset.bookId)return 'pdf:'+book.dataset.bookId;
    return (book.dataset.source||'demo')+':'+(book.dataset.title||'');
  };
  function applyOrder(){
    shelf.categories.forEach(category=>{
      const row=$('shelf-'+category.id);
      if(!row)return;
      const children=Array.from(row.querySelectorAll('.book-spine'));
      const byKey=new Map(children.map(book=>[bookKey(book),book]));
      (savedOrder[category.id]||[]).forEach(key=>{
        const book=byKey.get(key);
        if(book){row.append(book);byKey.delete(key);}
      });
      // Os livros adicionados depois entram no fim, sem apagar a ordem anterior.
      children.filter(book=>byKey.has(bookKey(book))).forEach(book=>row.append(book));
    });
  }
  function saveOrder(){
    shelf.categories.forEach(category=>{
      const row=$('shelf-'+category.id);
      if(row)savedOrder[category.id]=Array.from(row.querySelectorAll('.book-spine')).map(bookKey);
    });
    try{localStorage.setItem(orderKey,JSON.stringify(savedOrder));}catch{}
  }
  function updateMoveButtons(){
    $('moveLeft').disabled=!selected||!selected.previousElementSibling;
    $('moveRight').disabled=!selected||!selected.nextElementSibling;
    $('deleteBook').disabled=!selected;
  }
  $('arrangeButton').addEventListener('click',()=>{
    arranging=!arranging;
    document.body.classList.toggle('arranging',arranging);
    $('arrangeButton').setAttribute('aria-pressed',String(arranging));
    $('arrangeButton').textContent=arranging?'Concluir organização':'Organizar livros';
    $('arrangeBar').hidden=!arranging;
    if(selected)selected.classList.remove('selected-book');
    selected=null;
    $('arrangeSelection').textContent='Toque em um livro para mudar sua posição.';
    updateMoveButtons();
    if(!arranging)saveOrder();
  });
  $('arrangeBack').addEventListener('click',()=>{
    if(arranging)$('arrangeButton').click();
    $('library').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('library').addEventListener('click',event=>{
    if(!arranging)return;
    const book=event.target.closest('.book-spine');
    if(!book)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if(selected)selected.classList.remove('selected-book');
    selected=book;
    selected.classList.add('selected-book');
    $('arrangeSelection').textContent=book.getAttribute('aria-label')+' • posição na prateleira';
    updateMoveButtons();
  },true);
  function move(direction){
    if(!selected)return;
    const row=selected.parentElement;
    if(!row)return;
    if(direction<0 && selected.previousElementSibling) row.insertBefore(selected,selected.previousElementSibling);
    if(direction>0 && selected.nextElementSibling) row.insertBefore(selected.nextElementSibling,selected);
    updateMoveButtons();
    saveOrder();
    selected.focus({preventScroll:true});
  }
  $('moveLeft').addEventListener('click',()=>move(-1));
  $('moveRight').addEventListener('click',()=>move(1));
  async function deleteImportedPDF(id){
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('aurora-pdf-library',2);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Não foi possível abrir o acervo.'));
      request.onblocked=()=>reject(new Error('Feche as outras abas da Biblioteca Aurora e tente novamente.'));
    });
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(['books','progress'],'readwrite');
        tx.objectStore('books').delete(id);
        tx.objectStore('progress').delete(id);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error||new Error('Não foi possível excluir o livro.'));
        tx.onabort=()=>reject(tx.error||new Error('A exclusão foi interrompida.'));
      });
    }finally{db.close();}
  }
  $('deleteBook').addEventListener('click',async()=>{
    if(!arranging||!selected)return;
    const book=selected;
    const title=book.dataset.rawTitle||book.getAttribute('aria-label')?.replace(/^Pegar /,'')||'este livro';
    const source=book.dataset.source;
    const message='Excluir "'+title+'" da Biblioteca Aurora?\n\nO livro e seu progresso serão removidos do aplicativo. O arquivo original no celular não será apagado.';
    if(!confirm(message))return;
    $('deleteBook').disabled=true;
    try{
      if(source==='pdf'){
        if(!book.dataset.bookId)throw new Error('Este livro não tem identificação para exclusão.');
        await deleteImportedPDF(book.dataset.bookId);
        libraryBooks=libraryBooks.filter(item=>String(item.id)!==book.dataset.bookId);
        progress=progress.filter(item=>String(item.id)!==book.dataset.bookId);
        shelf.hideTitle(title);
      }else if(source==='txt'){
        if(!shelf.removeTextBook(title))throw new Error('Não foi possível localizar o livro em texto.');
      }else{
        shelf.hideTitle(title);
      }
      const category=book.closest('.bookrow')?.id?.slice(6);
      book.remove();
      selected=null;
      shelf.refreshCount(category);
      saveOrder();
      refreshStats();
      $('arrangeSelection').textContent='"'+title+'" foi excluído da estante.';
    }catch(error){
      $('arrangeSelection').textContent='Não foi possível excluir: '+(error?.message||String(error));
    }finally{updateMoveButtons();}
  });
  document.addEventListener('aurora:shelves-drawn',applyOrder);
  document.addEventListener('aurora:library-data',event=>{
    libraryBooks=event.detail.books||[];
    progress=event.detail.progress||[];
    applyOrder();
    refreshStats();
  });
  applyOrder();

  const goalInput=$('readingGoal');
  const rawGoal=Number(localStorage.getItem('aurora-goal')||12);
  goalInput.value=String(Math.max(1,Math.min(500,rawGoal||12)));
  goalInput.addEventListener('change',()=>{
    goalInput.value=String(Math.max(1,Math.min(500,Number(goalInput.value)||12)));
    try{localStorage.setItem('aurora-goal',goalInput.value);}catch{}
    refreshStats();
  });
  function refreshStats(){
    const byId=new Map(progress.map(record=>[record.id,record]));
    const texts=Object.keys(safeJSON('aurora-books',{}));
    const finished=libraryBooks.filter(b=>b.status==='lido').length;
    const started=libraryBooks.filter(b=>{
      const record=byId.get(b.id);
      return b.status==='lendo'||(b.status!=='lido'&&record&&record.page>0);
    }).length;
    const totalSeconds=progress.reduce((sum,record)=>sum+(Number(record.seconds)||0),0);
    $('statBooks').textContent=String(libraryBooks.length+texts.length);
    $('statStarted').textContent=String(started);
    $('statFinished').textContent=String(finished);
    $('statMinutes').textContent=String(Math.floor(totalSeconds/60));
    $('goalProgress').textContent=finished+' de '+goalInput.value+' livros concluídos na meta atual.';
  }
  refreshStats();
})();
