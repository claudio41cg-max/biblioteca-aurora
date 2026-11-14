/* As lombadas online abrem o leitor da Aurora, nunca outra página externa. */
(() => {
  'use strict';
  const shelf=window.AuroraShelf;
  if(!shelf)return;
  const KEY='aurora-online-books-v1';
  const read=()=>{try{const values=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(values)?values:[];}catch{return [];}};
  const readerURL=book=>{
    const q=new URLSearchParams();
    if(['wikisource','wikibooks'].includes(book.source)&&
       ['pt.wikisource.org','pt.wikibooks.org','en.wikisource.org'].includes(book.wikiHost)&&book.wikiTitle){
      q.set('tipo','wiki');q.set('fonte',book.wikiHost);q.set('titulo',book.wikiTitle);
    }else if(['openlibrary','archive','archive-audio'].includes(book.source)&&/^[a-zA-Z0-9_-]{3,100}$/.test(book.archiveId||'')){
      q.set('tipo',book.kind==='audio'?'audio':'arquivo');q.set('identificador',book.archiveId);
    }else if(book.source==='librivox'&&/^\d+$/.test(String(book.librivoxId))){
      q.set('tipo','librivox');q.set('id',book.librivoxId);
    }else return './explorar-livros.html?q='+encodeURIComponent(book.title||'');
    q.set('nome',book.title||'');return './ler-online.html?'+q;
  };
  function drawOnline(){
    let changed=false;
    const books=read();
    for(const book of books){
      if(!book||typeof book.key!=='string'||typeof book.title!=='string')continue;
      const category=shelf.getCategory(book.category,book.title);
      const row=document.getElementById('shelf-'+category);
      if(!row)continue;
      const existing=Array.from(row.querySelectorAll('.book-spine'));
      if(existing.some(node=>node.dataset.bookId===book.key))continue;
      // Se o arquivo completo já está no aparelho, a edição local tem prioridade.
      if(existing.some(node=>['pdf','epub','audio'].includes(node.dataset.source)&&node.dataset.title===shelf.normalize(book.title)))continue;
      const button=shelf.makeSpine({title:book.title,source:'online'});
      button.dataset.bookId=book.key;
      button.title=book.title+' • abrir na Aurora sem baixar o arquivo.';
      button.setAttribute('aria-label','Abrir '+book.title+' no leitor da Aurora');
      button.addEventListener('click',()=>{
        location.href=readerURL(book);
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
