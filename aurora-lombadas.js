/* Lombadas da estante com a mesma composição tipográfica do visor 3D. */
(() => {
  'use strict';
  const hash=value=>Array.from(String(value||'')).reduce((seed,char)=>(Math.imul(seed,31)+char.charCodeAt(0))>>>0,7);
  function luminance(rgb){
    const lin=c=>{const x=c/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};
    return .2126*lin(rgb[0])+.7152*lin(rgb[1])+.0722*lin(rgb[2]);
  }
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  const lightInk=[255,245,220],darkInk=[38,24,16];
  // A cor da capa é parte da identidade da edição. Não clarear ou escurecer
  // toda a lombada só para alcançar uma razão de contraste fixa.
  function modelFromProfile(profile){
    const light=profile.reduce((sum,row)=>sum+contrast(row,lightInk),0)/profile.length;
    const dark=profile.reduce((sum,row)=>sum+contrast(row,darkInk),0)/profile.length;
    const useDark=dark>light;
    return {rows:profile,ink:useDark?'#261810':'#fff5dc',dark:useDark,origin:'cover'};
  }
  const colorCache=new Map(),artCache=new Map(),LIMIT=45;
  function remember(cache,key,value){
    if(cache.size>=LIMIT)cache.delete(cache.keys().next().value);
    cache.set(key,value);return value;
  }
  async function getRows(src){
    const cached=colorCache.get(src);
    if(cached)return cached;
    const image=new Image();
    image.decoding='async';
    image.crossOrigin='anonymous';
    image.src=src;
    try{
      await image.decode();
      const rows=window.AuroraEditionSurfaces.sampleProfile(image);
      return remember(colorCache,src,rows);
    }catch{
      return null;
    }
  }
  function fitLegacyTitle(button){
    const node=button.querySelector('.spine-title');
    if(!node)return;
    let font=parseFloat(getComputedStyle(node).fontSize)||11;
    while(font>8.5&&(node.scrollHeight>node.clientHeight+1||node.scrollWidth>node.clientWidth+1)){
      font-=.5;node.style.fontSize=font+'px';
    }
  }
  async function enhance(button){
    if(button.dataset.lombada)return;
    const cover=button.querySelector('.shelf-book-cover img')?.getAttribute('src')||'';
    if(button.dataset.realSpine==='true'||button.dataset.coverDerived!=='true'||!cover){
      button.dataset.lombada='original';
      fitLegacyTitle(button);
      return;
    }
    const w=button.offsetWidth,h=button.offsetHeight;
    if(w<=8||h<=40)return;
    button.dataset.lombada='pending';
    const titleNode=button.querySelector('.spine-title');
    const title=titleNode?.textContent?.trim()||button.dataset.rawTitle||'';
    const author=button.dataset.author || window.AuroraBookInfo?.find(title)?.author || '';
    const key=JSON.stringify([w,h,title,author]);
    try{
      let art=artCache.get(key);
      if(art?.cover!==cover){
        const rows=await getRows(cover);
        const dpr=Math.min(5,Math.max(3,window.devicePixelRatio||1),2048/h);
        const canvas=window.AuroraEditionSurfaces.spineCanvas(rows,{title,author},
          Math.round(w*dpr),Math.round(h*dpr),w/h);
        art=remember(artCache,key,{cover,url:canvas.toDataURL('image/webp',.97)});
      }
      if(!button.isConnected||button.dataset.realSpine==='true'||
          button.querySelector('.shelf-book-cover img')?.getAttribute('src')!==cover)return;
      button.style.backgroundImage='url('+JSON.stringify(art.url)+')';
      button.style.backgroundSize='100% 100%';
      button.style.backgroundPosition='center';
      button.dataset.spineCrisp='true';
      if(titleNode){
        titleNode.style.color='transparent';
        titleNode.style.textShadow='none';
        titleNode.style.background='none';
      }
      button.dataset.lombada='1';
    }catch(error){
      delete button.dataset.lombada;
      fitLegacyTitle(button);
      console.warn('Lombada mantida no estilo anterior:',error);
    }
  }
  const library=document.getElementById('library');
  if(!library)return;
  let scheduled=false;
  function processAll(){
    const books=Array.from(library.querySelectorAll('.book-spine:not([data-lombada])'));
    // Prepara até quatro texturas de cada vez para não travar o celular.
    let index=0;
    async function worker(){
      while(index<books.length){const button=books[index++];await enhance(button);}
    }
    return Promise.all(Array.from({length:Math.min(4,books.length)},worker));
  }
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;processAll();});
  }
  new MutationObserver(schedule).observe(library,{childList:true,subtree:true});
  new MutationObserver(records=>{
    for(const record of records){
      const button=record.target.closest?.('.book-spine');
      if(button){
        delete button.dataset.lombada;
        delete button.dataset.spineCrisp;
      }
    }
    schedule();
  }).observe(library,{attributes:true,subtree:true,attributeFilter:['src','data-cover-derived']});
  document.addEventListener('aurora:shelves-drawn',schedule);
  document.addEventListener('aurora:library-data',schedule);
  window.addEventListener('resize',()=>{
    for(const button of library.querySelectorAll('.book-spine[data-spine-crisp]')){
      delete button.dataset.lombada;delete button.dataset.spineCrisp;
    }
    schedule();
  });
  window.AuroraLombadas={processAll,hash,luminance,contrast,sampleProfile:window.AuroraEditionSurfaces.sampleProfile,modelFromProfile};
  schedule();
})();