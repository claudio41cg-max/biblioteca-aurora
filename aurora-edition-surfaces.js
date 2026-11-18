/* As faces que faltam no PDF herdam a arte da capa do próprio exemplar.
   Fotos reais de lombada/contracapa, quando existentes, têm prioridade. */
(() => {
  'use strict';
  // A mesma textura física atende o livro WebGL e o visor CSS de compatibilidade.
  // Os microfiletes verticais representam o corte de folhas, não uma lombada.
  const paperCache=new Map();
  function paperEdgeCanvas(orientation='vertical'){
    if(paperCache.has(orientation))return paperCache.get(orientation);
    const vertical=orientation==='vertical';
    const canvas=document.createElement('canvas');
    canvas.width=vertical?256:768;
    canvas.height=vertical?1024:192;
    const ctx=canvas.getContext('2d',{alpha:false});
    const width=canvas.width,height=canvas.height;
    let seed=vertical?0x41c0a:0x41c0b;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    ctx.fillStyle='#f2e5c9';ctx.fillRect(0,0,width,height);
    const length=vertical?width:height;
    for(let n=0;n<length;n++){
      const variation=random();
      const warm=Math.round(199+random()*25);
      const shade=variation<.11?`rgba(106,87,64,${.14+random()*.21})`
        :variation>.83?`rgba(255,251,236,${.3+random()*.42})`
        :`rgba(${warm},${warm-15},${warm-37},${.18+random()*.22})`;
      ctx.fillStyle=shade;
      if(vertical)ctx.fillRect(n,0,1,height);
      else ctx.fillRect(0,n,width,1);
    }
    // Pequenas interrupções na fibra e marcas sutis, mais visíveis perto da encadernação.
    for(let i=0;i<(vertical?900:380);i++){
      const nearBinding=random()<.73;
      const x=vertical?(nearBinding?random()*width*.17:random()*width):random()*width;
      const y=vertical?random()*height:(nearBinding?random()*height*.19:random()*height);
      const size=.5+random()*1.5;
      ctx.fillStyle=`rgba(${75+Math.round(random()*42)},${69+Math.round(random()*36)},${55+Math.round(random()*28)},${.035+random()*(nearBinding?.24:.095)})`;
      ctx.fillRect(x,y,vertical?size:2+random()*9,vertical?1+random()*9:size);
    }
    for(let i=0;i<90;i++){
      const x=random()*width,y=random()*height;
      ctx.strokeStyle=`rgba(112,92,65,${.025+random()*.095})`;
      ctx.lineWidth=.35+random()*.8;
      ctx.beginPath();ctx.moveTo(x,y);
      if(vertical)ctx.lineTo(x+(random()-.5)*2,y+12+random()*78);
      else ctx.lineTo(x+12+random()*80,y+(random()-.5)*2);
      ctx.stroke();
    }
    const bevel=vertical?ctx.createLinearGradient(0,0,width,0):ctx.createLinearGradient(0,0,0,height);
    bevel.addColorStop(0,'rgba(95,75,54,.34)');
    bevel.addColorStop(.055,'rgba(123,94,66,.11)');
    bevel.addColorStop(.2,'rgba(255,255,240,.12)');
    bevel.addColorStop(.72,'rgba(255,249,231,.06)');
    bevel.addColorStop(.94,'rgba(148,123,91,.11)');
    bevel.addColorStop(1,'rgba(89,67,46,.32)');
    ctx.fillStyle=bevel;ctx.fillRect(0,0,width,height);
    paperCache.set(orientation,canvas);
    return canvas;
  }
  function applyPaperEdges(){
    const book=document.getElementById('book3d');
    if(!book)return;
    const side=book.querySelector('.volume-edge');
    if(side){
      side.style.backgroundImage='url('+JSON.stringify(paperEdgeCanvas('vertical').toDataURL('image/png'))+')';
      side.style.backgroundSize='100% 100%';
    }
    const top=paperEdgeCanvas('horizontal').toDataURL('image/png');
    book.querySelectorAll('.volume-top,.volume-bottom').forEach(edge=>{
      edge.style.backgroundImage='url('+JSON.stringify(top)+')';
      edge.style.backgroundSize='100% 100%';
    });
  }
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
      back=document.createElement('canvas');back.width=1024;back.height=1440;
      const ctx=back.getContext('2d',{alpha:false});
      ctx.scale(2,2);
      ctx.imageSmoothingQuality='high';
      // Contracapa ilustrativa inspirada nas cores da edição, sem inventar ISBN.
      // Uma contracapa verdadeira do arquivo sempre tem prioridade sobre ela.
      ctx.fillStyle=`rgb(${base.join(',')})`;
      ctx.fillRect(0,0,512,720);
      ctx.globalAlpha=.22;
      ctx.drawImage(img,0,0,512,720);
      ctx.globalAlpha=1;
      ctx.fillStyle='rgba(23,18,25,.78)';ctx.fillRect(0,0,512,720);
      ctx.strokeStyle='rgba(255,239,204,.46)';ctx.lineWidth=2;
      ctx.strokeRect(25,27,462,664);
      ctx.fillStyle='#f6e7cf';ctx.textBaseline='top';
      const title=String(book.title||book.name||'Livro').replace(/[-_]+/g,' ');
      const known=window.AuroraBookInfo?.find(title);
      const author=String(known?.author||book.author||'').trim();
      const story=String(known?.description||book.description||'').replace(/\s+/g,' ').trim();
      const wrap=(text,maxWidth,maxLines,lineHeight,startX,startY)=>{
        let line='',count=0;
        for(const word of String(text).split(/\s+/)){
          const next=line?line+' '+word:word;
          if(ctx.measureText(next).width<=maxWidth){line=next;continue;}
          if(line){ctx.fillText(line,startX,startY+count*lineHeight);count++;}
          if(count>=maxLines)return startY+count*lineHeight;
          line=word;
        }
        if(line&&count<maxLines){ctx.fillText(line,startX,startY+count*lineHeight);count++;}
        return startY+count*lineHeight;
      };
      ctx.font='bold 31px Georgia,serif';
      let y=wrap(title,408,3,42,52,70)+12;
      if(author){ctx.font='italic 23px Georgia,serif';y=wrap(author,400,2,30,52,y)+19;}
      ctx.strokeStyle='rgba(250,224,177,.64)';ctx.beginPath();ctx.moveTo(52,y);ctx.lineTo(458,y);ctx.stroke();
      ctx.font='24px Georgia,serif';
      wrap(story||'Um exemplar da Biblioteca Aurora. Abra este livro para descobrir a história e aproveitar sua leitura.',408,7,37,52,y+25);
      // Código de barras apenas decorativo, sem simular um ISBN registrado.
      ctx.fillStyle='#fffaf0';ctx.fillRect(287,555,174,91);
      const code=Array.from(title).reduce((seed,char)=>(Math.imul(seed,33)+char.charCodeAt(0))>>>0,5381);
      for(let x=300;x<450;){
        const width=1+((code+(x*17))%4);
        const gap=1+(((code^(x*7))>>>0)%3);
        ctx.fillStyle='#261d21';ctx.fillRect(x,568,width,50);
        x+=width+gap;
      }
      ctx.fillStyle='#544c4c';ctx.font='12px sans-serif';
      ctx.fillText('BIBLIOTECA AURORA',300,624);
      ctx.fillStyle='#e6d3b7';ctx.font='14px Georgia,serif';
      ctx.fillText('Contracapa ilustrativa • edição digital',52,666);
    }
    const normalizedTitle=String(book.title||book.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const keepModelSpine=/\biracema\b/.test(normalizedTitle);
    if(!book.spine&&!keepModelSpine){
      spine=document.createElement('canvas');spine.width=512;spine.height=1920;
      const ctx=spine.getContext('2d',{alpha:false});
      ctx.scale(2,2);
      ctx.imageSmoothingQuality='high';
      // Sem lombada original: prolonga a arte central da capa para a lateral.
      // Evita a faixa esquerda quase sempre preta e a aparência de couro antigo.
      const cropWidth=Math.max(1,Math.min(img.naturalWidth,img.naturalHeight*.27));
      const cropX=Math.max(0,(img.naturalWidth-cropWidth)*.5);
      ctx.drawImage(img,cropX,0,cropWidth,img.naturalHeight,0,0,256,960);
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
    if(surfaces.back && backNode)backNode.style.backgroundImage='url('+JSON.stringify(surfaces.back.toDataURL('image/jpeg',.88))+')';
    if(surfaces.spine && spineNode)spineNode.style.backgroundImage='url('+JSON.stringify(surfaces.spine.toDataURL('image/jpeg',.9))+')';
  }
  const cover=document.getElementById('cover3d');
  function paintSelected(){
    applyPaperEdges();
    const book=window.__auroraSelectedBook;
    if(!book?.cover || !cover?.naturalWidth || cover.src!==book.cover)return;
    try{applyCSS(book,cover);}catch(error){console.warn('Acabamento do livro indisponível:',error);}
  }
  cover?.addEventListener('load',paintSelected);
  window.addEventListener('aurora:book-selected',paintSelected);
  window.AuroraEditionSurfaces={generate,applyCSS,paperEdgeCanvas,applyPaperEdges};
  paintSelected();
})();
