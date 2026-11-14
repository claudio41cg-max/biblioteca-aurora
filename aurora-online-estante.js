/* Os livros encontrados na internet são atalhos. Não são downloads. */
(() => {
  'use strict';
  const shelf=window.AuroraShelf;
  if(!shelf)return;
  const KEY='aurora-online-books-v1';
  const read=()=>{try{const values=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(values)?values:[];}catch{return [];}};
  const validURL=book=>{
    try{
      const url=new URL(book.url);
      if(url.protocol!=='https:')return null;
      if(book.kind==='audio'&&url.hostname==='librivox.org')return url.href;
      if(book.kind==='book'&&url.hostname==='www.gutenberg.org'&&/^\/ebooks\/\d+$/.test(url.pathname))return url.href;
    }catch{}
    return null;
  };
  function drawOnline(){
    let changed=false;
    const books=read();
    for(const book of books){
      if(!book||typeof book.key!=='string'||typeof book.title!=='string'||!validURL(book))continue;
      const category=shelf.getCategory(book.category,book.title);
      const row=document.getElementById('shelf-'+category);
      if(!row)continue;
      const existing=Array.from(row.querySelectorAll('.book-spine'));
      if(existing.some(node=>node.dataset.bookId===book.key))continue;
      // Se o arquivo completo já está no aparelho, a edição local tem prioridade.
      if(existing.some(node=>['pdf','epub','audio'].includes(node.dataset.source)&&node.dataset.title===shelf.normalize(book.title)))continue;
      const button=shelf.makeSpine({title:book.title,source:'online'});
      button.dataset.bookId=book.key;
      button.title=book.title+' • link público. Abre o site da biblioteca; não ocupa espaço com downloads.';
      button.setAttribute('aria-label','Abrir '+book.title+' na biblioteca pública');
      button.addEventListener('click',()=>{
        const link=validURL(book);
        if(link)window.open(link,'_blank','noopener,noreferrer');
      });
      const demo=existing.find(node=>node.dataset.source==='demo'&&node.dataset.title===shelf.normalize(book.title));
      if(demo)demo.replaceWith(button);else row.append(button);
      shelf.refreshCount(category);changed=true;
    }
    if(changed)document.dispatchEvent(new Event('aurora:online-books-ready'));
  }
  drawOnline();
  document.addEventListener('aurora:library-data',drawOnline);
  document.addEventListener('aurora:shelves-drawn',drawOnline);
  window.addEventListener('storage',event=>{if(event.key===KEY)location.reload();});
})();
