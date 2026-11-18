/* Pré-renderiza apenas os três livros do piloto usando o mesmo modelo WebGL do visor. */
(()=>{
  'use strict';
  let importedBooks=[];
  let working=false;

  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  async function renderPilots(){
    if(working||!importedBooks.length||!window.Aurora3D?.renderShelfPreview)return;
    working=true;
    try{
      const buttons=Array.from(document.querySelectorAll(
        '.book-spine[data-shelf-3d-pilot="true"]'
      ));
      for(const button of buttons){
        if(!button.isConnected||button.dataset.shelfPreview==='ready')continue;
        const book=importedBooks.find(item=>String(item.id)===String(button.dataset.bookId));
        if(!book?.cover)continue;
        const title=button.dataset.shelf3dTitle||book.title||book.name||'Livro';
        const bounds=button.getBoundingClientRect();
        const shelfRatio=Math.max(.12,Math.min(.4,(bounds.width||44)/(bounds.height||170)));
        const previewHeight=Math.max(300,Math.min(780,Math.round((bounds.height||170)*3)));
        const previewWidth=Math.max(100,Math.min(320,Math.round(previewHeight*shelfRatio)));
        button.dataset.shelfPreview='loading';
        const imageURL=await window.Aurora3D.renderShelfPreview({
          id:book.id,
          name:title,
          title,
          author:book.author||'',
          description:book.description||'',
          cover:book.cover,
          back:book.back||'',
          spine:book.spine||'',
          ratio:book.ratio||.72,
          total:book.total||0
        },{view:'spine',width:previewWidth,height:previewHeight});
        if(!imageURL||!button.isConnected){
          if(button.isConnected)button.dataset.shelfPreview='failed';
          continue;
        }
        const image=document.createElement('img');
        image.className='shelf-3d-preview-image';
        image.alt='Lombada em 3D: '+title;
        image.decoding='async';
        image.src=imageURL;
        try{await image.decode();}catch{}
        if(!button.isConnected)continue;
        button.replaceChildren(image);
        button.style.backgroundImage='none';
        button.dataset.shelfPreview='ready';
        button.title=title+' • tocar para pegar';
        button.setAttribute('aria-label','Pegar '+title);
        await delay(45);
      }
    }catch(error){
      console.warn('Não foi possível montar as prévias 3D da estante:',error);
    }finally{working=false;}
  }

  document.addEventListener('aurora:library-data',event=>{
    importedBooks=event.detail?.books||[];
    void renderPilots();
  });
  window.addEventListener('aurora:3d-ready',()=>void renderPilots());
  if(window.Aurora3D?.renderShelfPreview)queueMicrotask(()=>void renderPilots());
})();
