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
  // Faz a amostragem da capa INTEIRA. A faixa esquerda sozinha costuma ser
  // preta ou branca e faz livros de coleções diferentes parecerem iguais.
  function sampleProfile(image){
    const canvas=document.createElement('canvas');
    canvas.width=32;canvas.height=144;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('Canvas indisponível');
    ctx.drawImage(image,0,0,image.naturalWidth,image.naturalHeight,0,0,32,144);
    const pixels=ctx.getImageData(0,0,32,144).data;
    const profile=[];
    for(let row=0;row<48;row++){
      const sum=[0,0,0];let total=0;
      for(let y=row*3;y<row*3+3;y++)for(let x=0;x<32;x++){
        const p=(y*32+x)*4;
        if(pixels[p+3]<40)continue;
        const rgb=[pixels[p],pixels[p+1],pixels[p+2]];
        const max=Math.max(...rgb),min=Math.min(...rgb);
        const saturation=(max-min)/255;
        // Dá mais peso ao tom do tecido/ilustração do que às letras brancas.
        // A região central também conta, mesmo quando a borda é toda preta.
        const weight=(1+saturation*2)*(max>245 && saturation<.10 ? .35 : 1);
        for(let k=0;k<3;k++)sum[k]+=rgb[k]*weight;
        total+=weight;
      }
      profile.push(total?sum.map(value=>value/total):[225,211,185]);
    }
    const mean=profile.reduce((sum,color)=>sum.map((value,k)=>value+color[k]/profile.length),[0,0,0]);
    return profile.map((color,index)=>{
      const neighbors=[-2,-1,0,1,2].map(offset=>profile[Math.max(0,Math.min(47,index+offset))]);
      const smooth=[0,1,2].map(k=>neighbors.reduce((sum,row)=>sum+row[k],0)/neighbors.length);
      return smooth.map((value,k)=>value*.83+mean[k]*.17);
    });
  }
  // Compõe a faixa da capa diretamente na resolução final, tanto na estante quanto no visor.
  function spineCanvas(rows, book, width = 512, height = 1920, aspect = .17, coverImage = null) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', {alpha: false});
    const length = 1000;
    const breadth = length * aspect;
    ctx.scale(width / breadth, height / length);

    function bandColor(start, end) {
      const colors = rows.slice(start, end);
      return [0, 1, 2].map(channel => Math.round(
        colors.reduce((sum, color) => sum + color[channel], 0) / colors.length
      ));
    }
    const top = rows ? bandColor(3, 16) : [44, 46, 45];
    const bottom = rows ? bandColor(30, 46) : [64, 57, 69];
    function ink(rgb) {
      const linear = rgb.map(value => {
        const c = value / 255;
        return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
      });
      const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
      return luminance > .18 ? '#100f0d' : '#fffbed';
    }

    const fullTitle = String(book.title || book.name || 'Livro').replace(/[_]+/g, ' ').trim();
    const title = fullTitle.split(/:\s+/)[0] || fullTitle;
    const author = String(book.author || '').trim();
    const division = author ? 275 : 85;
    const illustrated = coverImage && book.coverSource !== 'generated';
    ctx.fillStyle = 'rgb(' + bottom.join(',') + ')';
    ctx.fillRect(0, 0, breadth, length);
    if (illustrated) {
      const sourceWidth = coverImage.naturalWidth, sourceHeight = coverImage.naturalHeight;
      const cropWidth = Math.min(sourceWidth, sourceHeight * aspect);
      const cropHeight = Math.min(sourceHeight, sourceWidth / aspect);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(coverImage, (sourceWidth - cropWidth) / 2, (sourceHeight - cropHeight) / 2,
        cropWidth, cropHeight, 0, 0, breadth, length);
    } else if (rows) {
      // Sem fotografia, o tecido acompanha as cores da capa ilustrativa do exemplar.
      const cloth = ctx.createLinearGradient(0, 0, 0, length);
      rows.forEach((rgb, i) => cloth.addColorStop(i / (rows.length - 1), 'rgb(' + rgb.map(Math.round).join(',') + ')'));
      ctx.fillStyle = cloth;
      ctx.fillRect(0, 0, breadth, length);
      ctx.fillStyle = 'rgba(255,245,216,.065)';
      for (let x=2; x<breadth; x+=5) ctx.fillRect(x,0,1,length);
    } else {
      ctx.fillStyle = 'rgb(' + top.join(',') + ')';
      ctx.fillRect(0, 0, breadth, division);
    }

    const curve = ctx.createLinearGradient(0, 0, breadth, 0);
    curve.addColorStop(0, 'rgba(0,0,0,.29)');
    curve.addColorStop(.12, 'rgba(255,255,255,.06)');
    curve.addColorStop(.42, 'rgba(255,255,255,.025)');
    curve.addColorStop(.86, 'rgba(0,0,0,.04)');
    curve.addColorStop(1, 'rgba(0,0,0,.24)');
    ctx.fillStyle = curve;
    ctx.fillRect(0, 0, breadth, length);
    if (!illustrated) {
      ctx.fillStyle = ink(bottom);
      ctx.globalAlpha = .50;
      const trim = Array.from(title).reduce((sum, char) => sum + char.codePointAt(0), 0) % 3;
      const inset = breadth * (.16 + trim * .05);
      for (const y of [division + 7, length - 39]) {
        ctx.fillRect(inset, y, breadth - inset * 2, 2.5);
        if (trim === 1) ctx.fillRect(inset, y + 6, breadth - inset * 2, 1.5);
      }
      ctx.globalAlpha = 1;
    }

    function letter(text, start, end, maxSize, style, color, allowWrap = false) {
      const available = end - start;
      ctx.font = style + ' ' + maxSize + 'px Georgia, serif';
      const measured = ctx.measureText(text).width;
      let lines = [text];
      let size = Math.min(maxSize, maxSize * available / Math.max(1, measured));
      if (allowWrap && size < Math.min(34, breadth * .18) && text.includes(' ')) {
        const words = text.split(/\s+/);
        let longest = measured;
        for (let split = 1; split < words.length; split++) {
          const pair = [words.slice(0, split).join(' '), words.slice(split).join(' ')];
          const width = Math.max(...pair.map(line => ctx.measureText(line).width));
          if (width < longest) {
            longest = width;
            lines = pair;
          }
        }
        size = Math.min(maxSize, breadth * .28, maxSize * available / Math.max(1, longest));
      }
      ctx.save();
      ctx.translate(breadth / 2, (start + end) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = style + ' ' + size + 'px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      if (illustrated) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * .12;
        ctx.strokeStyle = color === '#100f0d' ? 'rgba(255,248,233,.8)' : 'rgba(19,13,12,.85)';
      }
      lines.forEach((line, i) => {
        const y = (i - (lines.length - 1) / 2) * size * 1.12;
        if (illustrated) ctx.strokeText(line, 0, y);
        ctx.fillText(line, 0, y);
      });
      ctx.restore();
    }
    if (illustrated) {
      letter(title, 85, length - 85, Math.min(64, breadth * .38), 'bold', ink(bandColor(12,36)), true);
    } else {
      letter(title, division + 33, length - 56, Math.min(59, breadth * .38), 'bold', ink(bottom), true);
      if (author) letter(author, 20, division - 14, Math.min(40, breadth * .27), 'normal', ink(top));
    }
    return canvas;
  }
  function generate(img,book,spineAspect){
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
    if(!book.spine){
      spine=spineCanvas(sampleProfile(img), book, 512, 1920, spineAspect, img);
    }
    return {back,spine,edge:`rgb(${edge.join(',')})`,accent:`rgb(${base.join(',')})`};
  }
  function applyCSS(book,img){
    const bookNode=document.getElementById('book3d');
    if(!bookNode)return;
    const spineNode=bookNode.querySelector('.volume-spine');
    const aspect=spineNode?.offsetWidth / spineNode?.offsetHeight || undefined;
    let surfaces;
    try{
      surfaces=generate(img,book,aspect);
    }catch(error){
      if(error.name!=='SecurityError')throw error;
      surfaces={spine:book.spine?null:spineCanvas(null,book,512,1920,aspect),accent:'#403945'};
    }
    if(!surfaces)return;
    const backNode=bookNode.querySelector('.volume-back');
    bookNode.querySelector('.volume-cover')?.style.setProperty('border-color',surfaces.accent);
    spineNode?.style.setProperty('border-color',surfaces.accent);
    backNode?.style.setProperty('border-color',surfaces.accent);
    if(backNode)backNode.style.backgroundSize=book.back?'contain':'100% 100%';
    if(surfaces.back && backNode)backNode.style.backgroundImage='url('+JSON.stringify(surfaces.back.toDataURL('image/jpeg',.88))+')';
    if(spineNode){
      spineNode.style.backgroundSize=book.spine?'contain':surfaces.spine?'100% 100%':'';
      if(surfaces.spine)spineNode.style.backgroundImage='url('+JSON.stringify(surfaces.spine.toDataURL('image/png'))+')';
    }
  }
  const cover=document.getElementById('cover3d');
  function paintSelected(){
    applyPaperEdges();
    const book=window.__auroraSelectedBook;
    if(!book?.cover || !cover?.naturalWidth || (cover.getAttribute('src')!==book.cover && cover.src!==book.cover))return;
    try{applyCSS(book,cover);}catch(error){console.warn('Acabamento do livro indisponível:',error);}
  }
  cover?.addEventListener('load',paintSelected);
  window.addEventListener('aurora:book-selected',paintSelected);
  window.AuroraEditionSurfaces={generate,applyCSS,paperEdgeCanvas,applyPaperEdges,sampleProfile,spineCanvas};
  paintSelected();
})();
