/* Acervo de estantes deste navegador, compartilhado entre o editor, a biblioteca e os ajustes. */
(() => {
  'use strict';
  const listKey='aurora-estantes-personalizadas-v1',legacyKey='aurora-nova-estante-v1';
  function read(){
    const raw=localStorage.getItem(listKey);
    if(raw!==null){
      const list=JSON.parse(raw);
      if(!Array.isArray(list))throw new Error('Lista de estantes inválida');
      return list;
    }
    const legacy=JSON.parse(localStorage.getItem(legacyKey)||'null');
    return legacy && typeof legacy==='object' && !Array.isArray(legacy)
      ? [{...legacy,id:legacy.id||'legado',published:false}] : [];
  }
  function save(state,publish=false){
    if(!state.id)throw new Error('Estante sem identificador');
    const list=read();
    const index=list.findIndex(item=>item?.id===state.id);
    const existing=list[index];
    const now=Date.now();
    const published=publish||existing?.published===true;
    const entry={...state,published,updatedAt:now};
    if(published){
      // Duas conclusões no mesmo milissegundo ainda têm uma ordem de entrada.
      entry.publishedAt=existing?.publishedAt||list.reduce((time,shelf)=>
        shelf?.published===true && Number.isFinite(shelf.publishedAt)
          ? Math.max(time,shelf.publishedAt+1) : time,now);
    }else delete entry.publishedAt;
    if(index>=0)list[index]=entry;
    else list.push(entry);
    localStorage.setItem(listKey,JSON.stringify(list));
    return entry;
  }
  window.AuroraEstantesSalvas={read,save};
})();
