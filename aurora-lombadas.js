/* Biblioteca Aurora • lombadas fiéis às capas v49.
   Só substitui a lombada improvisada a partir da capa. Lombadas reais, capas,
   leitor, catálogo e navegação permanecem inalterados. */
(() => {
  'use strict';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const hash=value=>Array.from(String(value||'')).reduce((seed,char)=>(Math.imul(seed,31)+char.charCodeAt(0))>>>0,7);
  const palette=[[107,39,55],[36,71,58],[31,53,80],[138,106,47],[30,85,88],[77,44,79],[51,48,45],[139,74,43]];
  const variants=['classico','faixas','losango','estrela','colegio'];
  const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const mix=(a,b,t)=>a.map((c,i)=>c+(b[i]-c)*t);
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
  function fallbackProfile(title){
    const color=palette[hash(title)%palette.length];
    return Array.from({length:48},(_,i)=>mix(color,[255,250,230],.08*Math.sin(i/47*Math.PI)));
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
      const neighbors=[-2,-1,0,1,2].map(offset=>profile[clamp(index+offset,0,47)]);
      const smooth=[0,1,2].map(k=>neighbors.reduce((sum,row)=>sum+row[k],0)/neighbors.length);
      return mix(smooth,mean,.17);
    });
  }
  // Uma imagem externa pode aparecer no <img>, mesmo que o site não permita
  // ler seus pixels. Nesse caso mostramos a própria foto no CSS como último
  // recurso visual, sem substituir por uma cor arbitrária de catálogo.
  function loadCover(url){
    return new Promise((resolve,reject)=>{
      let cross=false;
      try{
        const origin=new URL(url,location.href);
        cross=origin.origin!==location.origin&&!['data:','blob:'].includes(origin.protocol);
      }catch{}
      const attempt=withCors=>{
        const img=new Image();img.decoding='async';
        if(withCors)img.crossOrigin='anonymous';
        img.onload=()=>resolve(img);
        img.onerror=()=>{if(withCors)attempt(false);else reject(new Error('Capa não acessível'));};
        img.src=url;
      };
      attempt(cross);
    });
  }
  const colorCache=new Map(),artCache=new Map(),LIMIT=45;
  const keyFor=src=>src.length+':'+hash(src.slice(0,160)+src.slice(-160));
  function remember(cache,key,value){
    if(cache.size>=LIMIT)cache.delete(cache.keys().next().value);
    cache.set(key,value);return value;
  }
  async function getModel(src,title){
  const key=keyFor(src),cached=colorCache.get(key);
  if(cached)return cached;
  let model;
  try{
    const image=await loadCover(src);
    try{
      model=modelFromProfile(sampleProfile(image));
    }catch(error){
      // CORS: a imagem pode ser exibida, mas não amostrada no canvas.
      if(error?.name==='SecurityError')model={origin:'photo'};
      else throw error;
    }
  }catch{
    model={...modelFromProfile(fallbackProfile(title)),origin:'fallback'};
  }
  return remember(colorCache,key,model);
}
  function wrapTitle(ctx,title,maxWidth,maxLines){
    const words=String(title).trim().split(/\s+/).filter(Boolean),lines=[];
    let line='';
    for(const word of words){
      const next=line?line+' '+word:word;
      if(!line||ctx.measureText(next).width<=maxWidth){line=next;continue;}
      lines.push(line);line=word;
    }
    if(line)lines.push(line);
    return lines;
  }
  function drawSpine(model,w,h,title,seedText){
    const dpr=clamp((window.devicePixelRatio||1)*1.2,2,3);
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.scale(canvas.width/w,canvas.height/h);
    const grad=ctx.createLinearGradient(0,0,0,h);
    model.rows.forEach((color,i)=>grad.addColorStop(i/47,'rgb('+color.map(Math.round).join(',')+')'));
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    const rand=rng(hash(seedText));
    // Microfibras de tecido e marcas discretas, sem esticar a capa como imagem.
    for(let x=0;x<w;x+=.75){ctx.fillStyle=rand()<.5?'#ffffff0c':'#0000000b';ctx.fillRect(x,0,.35,h);}
    for(let y=0;y<h;y+=1.5){ctx.fillStyle=rand()<.5?'#ffffff09':'#00000009';ctx.fillRect(0,y,w,.5);}
    for(let i=0;i<Math.floor(w*h/330);i++){
      ctx.fillStyle=rand()<.5?'#ffffff20':'#00000020';
      ctx.fillRect(rand()*w,rand()*h,.3+rand()*.7,.3+rand()*1.7);
    }
    const shade=ctx.createLinearGradient(0,0,w,0);
    shade.addColorStop(0,'#00000055');shade.addColorStop(.22,'#00000004');
    shade.addColorStop(.47,'#ffffff13');shade.addColorStop(.76,'#ffffff07');
    shade.addColorStop(1,'#00000055');
    ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
    for(const x of [w*.08,w*.92]){
      ctx.fillStyle='#00000055';ctx.fillRect(x,0,.7,h);
      ctx.fillStyle='#ffffff2a';ctx.fillRect(x+1,0,.6,h);
    }
    const metal=ctx.createLinearGradient(w*.1,0,w*.9,0);
    metal.addColorStop(0,'#f0d19b');metal.addColorStop(.5,'#b58840');metal.addColorStop(1,'#f0d19b');
    const width=Math.max(.8,w*.022),rad=clamp(w*.085,2,4.8);
    const rule=(y,size=width)=>{ctx.fillStyle=metal;ctx.fillRect(w*.14,y,w*.72,size);};
    const diamond=y=>{
      ctx.beginPath();ctx.moveTo(w/2,y-rad);
      ctx.lineTo(w/2+rad,y);ctx.lineTo(w/2,y+rad);ctx.lineTo(w/2-rad,y);
      ctx.closePath();ctx.fillStyle=metal;ctx.fill();
    };
    const star=y=>{
      ctx.beginPath();
      for(let i=0;i<8;i++){
        const angle=i*Math.PI/4-Math.PI/2,length=i%2?rad*.45:rad;
        if(i)ctx.lineTo(w/2+Math.cos(angle)*length,y+Math.sin(angle)*length);
        else ctx.moveTo(w/2+Math.cos(angle)*length,y+Math.sin(angle)*length);
      }
      ctx.closePath();ctx.fillStyle=metal;ctx.fill();
    };
    switch(variants[hash(seedText)%variants.length]){
      case 'classico':rule(h*.045);rule(h*.067);rule(h*.933);rule(h*.955);break;
      case 'faixas':rule(h*.05,width*2.5);rule(h*.072);rule(h*.928);rule(h*.95,width*2.5);break;
      case 'losango':rule(h*.05);diamond(h*.09);diamond(h*.91);rule(h*.95);break;
      case 'estrela':rule(h*.05);star(h*.09);star(h*.91);rule(h*.95);break;
      default:for(let i=0;i<3;i++){rule(h*.045+i*width*2.5);rule(h*.955-i*width*2.5);}
    }
    // Texto desenhado na própria textura para permanecer nítido nas telas densas.
    ctx.save();ctx.translate(w/2,h/2);ctx.rotate(-Math.PI/2);
    const length=h*.69,across=w*.72;
    let textPainted=false;
    for(let size=clamp(w*.35,9,13);size>=8;size-=.5){
      ctx.font='bold '+size+'px Georgia,serif';
      const maxLines=Math.max(1,Math.floor(across/(size*1.13)));
      const lines=wrapTitle(ctx,title,length,maxLines);
      if(lines.length>maxLines)continue;
      if(lines.some(line=>ctx.measureText(line).width>length))continue;
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle=model.ink;
      ctx.shadowBlur=model.dark?1.4:3;
      ctx.shadowColor=model.dark?'#fff8e6':'#090704';
      const lineHeight=size*1.12;
      lines.forEach((line,i)=>ctx.fillText(line,0,(i-(lines.length-1)/2)*lineHeight,length));
      textPainted=true;break;
    }
    if(!textPainted){
      ctx.font='bold 8px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillStyle=model.ink;ctx.fillText(String(title).slice(0,60)+'…',0,0,length);
    }
    ctx.restore();
    const gloss=ctx.createLinearGradient(0,0,w,0);
    gloss.addColorStop(0,'#00000033');gloss.addColorStop(.4,'#ffffff13');
    gloss.addColorStop(.6,'#ffffff08');gloss.addColorStop(1,'#0000002f');
    ctx.fillStyle=gloss;ctx.fillRect(0,0,w,h);
    return canvas.toDataURL('image/webp',.92);
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
  const key=keyFor(cover)+':'+Math.round(w)+'x'+Math.round(h)+':'+title;
  try{
    let art=artCache.get(key);
    if(!art){
      const model=await getModel(cover,button.dataset.rawTitle||title);
      art=model.origin==='photo'
        ? {type:'photo',url:cover}
        : {type:'canvas',url:drawSpine(model,w,h,title,button.dataset.rawTitle||title),origin:model.origin};
      remember(artCache,key,art);
    }
    if(!button.isConnected||button.querySelector('.shelf-book-cover img')?.getAttribute('src')!==cover)return;
    if(art.type==='photo'){
      // A imagem original, mesmo sem CORS, continua visível sem esticar 9x.
      button.style.backgroundImage='linear-gradient(90deg,#180e0a83,#180e0a20 45%,#180e0a78),url('+JSON.stringify(art.url)+')';
      button.style.backgroundSize='100% 100%,auto 100%';
      button.style.backgroundPosition='center,center';
      button.style.backgroundRepeat='no-repeat';
      button.dataset.spineMode='capa-original-sem-cors';
      // O texto HTML permanece visível porque não foi impresso em canvas.
    }else{
      button.style.backgroundImage='url('+JSON.stringify(art.url)+')';
      button.style.backgroundSize='100% 100%';
      button.style.backgroundPosition='center';
      button.dataset.spineMode=art.origin==='fallback'?'paleta-sem-imagem':'cores-da-capa';
      button.dataset.spineCrisp='true';
      if(titleNode){
        titleNode.style.color='transparent';
        titleNode.style.textShadow='none';
        titleNode.style.background='none';
      }
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
  window.AuroraLombadas={processAll,hash,luminance,contrast,sampleProfile,modelFromProfile};
  schedule();
})();