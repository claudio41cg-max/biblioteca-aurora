/* Carrega o motor WebGL somente quando um exemplar é aberto.
   A capa CSS continua disponível enquanto o módulo e o contexto gráfico preparam. */
(()=>{
  'use strict';
  let requested=false;
  function load(){
    if(requested)return;
    requested=true;
    import('./aurora-livro-3d.mjs?v=25').catch(error=>{
      console.warn('Motor WebGL indisponível; o livro continuará no modo 3D compatível.',error);
      window.dispatchEvent(new Event('aurora:3d-unavailable'));
    });
  }
  window.addEventListener('aurora:book-selected',load,{once:true});
  if(window.__auroraSelectedBook)load();
})();