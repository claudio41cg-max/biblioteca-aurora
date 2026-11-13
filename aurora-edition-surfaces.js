/* As faces que faltam no PDF herdam a arte da capa do próprio exemplar.
   Fotos reais de lombada/contracapa, quando existentes, têm prioridade. */
(() => {
  'use strict';
  function generate(img,book){
    if(!img?.naturalWidth || !img?.naturalHeight)return null;
    const sampler=document.createElement('canvas');
    sampler.width=48;sampler.height=48;
    const sample=sampler.getContext('2d',{willReadFrequently:true});
    sample.drawImage(img,0,0,48,48);
    const pixels=sample.getImageData(0,0,48,48).data;
    let r=0,g=0,b=0,count=0;
    for(let y=4;y<44;y+=2) for(let x=1;x<16;x+=2){
      const i=(y*48+x)*4;
      const brightness=(pixels[i]+pixels[i+1]+pixels[i+2])/3;
      if(brightness>235 || brightness<11)continue;
      r+=pixels[i];g+=pixels[i+1];b+=pixels[i+2];count++;
    }
    if(!count)count=1;
    const base=[r/count,g/count,b/count].map(value=>Math.max(18,Math.min(195,Math.round(value))));
    const edge=base.map(value=>Math.round(value*.64));
    let back=null,spine=null;
    if(!book.back){
      back=document.createElement('canvas');back.width=512;back.height=720;
      const ctx=back.getContext('2d',{alpha:false});
      // Recorte inferior da capa original, sem espelhar o título na contracapa.
      const fromY=Math.round(img.naturalHeight*.43);
      ctx.drawImage(img,0,fromY,img.naturalWidth,img.naturalHeight-fromY,0,0,512,720);
      const tint=ctx.createLinearGradient(0,0,512,720);
      tint.addColorStop(0,'#120e14a3');tint.addColorStop(.45,'#0f0b101f');tint.addColorStop(1,'#130c0d9c');
      ctx.fillStyle=tint;ctx.fillRect(0,0,512,720);
      ctx.strokeStyle='rgba(255,244,220,.25)';ctx.lineWidth=2;ctx.strokeRect(23,27,466,666);
    }
    if(!book.spine){
      spine=document.createElement('canvas');spine.width=256;spine.height=960;
      const ctx=spine.getContext('2d',{alpha:false});
      ctx.drawImage(img,0,0,Math.max(1,img.naturalWidth*.13),img.naturalHeight,0,0,256,960);
      const shade=ctx.createLinearGradient(0,0,256,0);
      shade.addColorStop(0,'#000b');shade.addColorStop(.23,'#0006');
      shade.addColorStop(.57,'#0003');shade.addColorStop(1,'#000c');
      ctx.fillStyle=shade;ctx.fillRect(0,0,256,960);
      ctx.save();ctx.translate(128,480);ctx.rotate(-Math.PI/2);
      ctx.font='bold 42px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=12;ctx.strokeStyle='rgba(0,0,0,.85)';
      const name=String(book.name||'Livro').replace(/[-_]+/g,' ').slice(0,65);
      ctx.strokeText(name,0,0,815);ctx.fillStyle='#fff8e9';ctx.fillText(name,0,0,815);
      ctx.restore();
    }
    return {back,spine,edge:`rgb(${edge.join(',')})`,accent:`rgb(${base.join(',')})`};
  }
  function applyCSS(book,img){
    const bookNode=document.getElementById('book3d');
    if(!bookNode)return;
    const surfaces=generate(img,book);
    if(!surfaces)return;
    const backNode=bookNode.querySelector('.volume-back');
    const spineNode=bookNode.querySelector('.volume-spine');
    bookNode.querySelector('.volume-cover')?.style.setProperty('border-color',surfaces.accent);
    spineNode?.style.setProperty('border-color',surfaces.accent);
    backNode?.style.setProperty('border-color',surfaces.accent);
    if(surfaces.back && backNode)backNode.style.backgroundImage='url('+JSON.stringify(surfaces.back.toDataURL('image/jpeg',.85))+')';
    if(surfaces.spine && spineNode)spineNode.style.backgroundImage='url('+JSON.stringify(surfaces.spine.toDataURL('image/jpeg',.9))+')';
  }
  const cover=document.getElementById('cover3d');
  function paintSelected(){
    const book=window.__auroraSelectedBook;
    if(!book?.cover || !cover?.naturalWidth || cover.src!==book.cover)return;
    try{applyCSS(book,cover);}catch(error){console.warn('Acabamento do livro indisponível:',error);}
  }
  cover?.addEventListener('load',paintSelected);
  window.addEventListener('aurora:book-selected',paintSelected);
  window.AuroraEditionSurfaces={generate,applyCSS};
  paintSelected();
})();
