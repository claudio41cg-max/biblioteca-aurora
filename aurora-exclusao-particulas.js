/* Fragmentos do próprio exemplar, com textura real e física visual, sem novas requisições. */
(() => {
  'use strict';
  const active = new Set();
  const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
  const rect = box => ({left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height});
  const loaded = image => image instanceof HTMLCanvasElement ? image.width && image.height : image?.complete && image.naturalWidth;
  const intersect = (a,b) => {
    const left=Math.max(a.left,b.left),top=Math.max(a.top,b.top),right=Math.min(a.right,b.right),bottom=Math.min(a.bottom,b.bottom);
    return {left,top,right,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
  };

  function visibleBounds(element) {
    let box=intersect(rect(element.getBoundingClientRect()),{left:0,top:0,right:innerWidth,bottom:innerHeight});
    for(let parent=element.parentElement;parent && parent!==document.body;parent=parent.parentElement){
      const style=getComputedStyle(parent),clipX=/(auto|scroll|hidden|clip)/.test(style.overflowX),clipY=/(auto|scroll|hidden|clip)/.test(style.overflowY);
      if(!clipX&&!clipY)continue;
      const edge=parent.getBoundingClientRect();
      box=intersect(box,{left:clipX?edge.left:-Infinity,right:clipX?edge.right:Infinity,top:clipY?edge.top:-Infinity,bottom:clipY?edge.bottom:Infinity});
    }
    return box;
  }

  function paintSurface(ctx,node,width,height,fallback) {
    const style=getComputedStyle(node);
    const paper=['top','fore'].includes(node.dataset.volumeFace);
    ctx.fillStyle=paper?'#e4d5b8':style.backgroundColor==='rgba(0, 0, 0, 0)'?'#554333':style.backgroundColor;
    ctx.fillRect(0,0,width,height);
    let image=[...node.querySelectorAll('img,canvas')].find(loaded);
    if(node instanceof HTMLImageElement || node instanceof HTMLCanvasElement)image=loaded(node)?node:null;
    // Reutiliza imagens CSS já carregadas, sem fazer uma nova requisição.
    if(!image && style.backgroundImage.includes('url(')){
      const url=style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      image=[...document.images].find(candidate=>loaded(candidate) && (candidate.currentSrc===url || candidate.getAttribute('src')===url));
    }
    if(!image&&!paper)image=fallback;
    if(image){
      try { ctx.drawImage(image,0,0,width,height); }
      catch { /* A paleta abaixo permanece válida para imagens indisponíveis. */ }
    }else if(paper){
      ctx.strokeStyle='#b8a88a';ctx.lineWidth=.7;
      for(let x=2;x<width;x+=3){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();}
    }else{
      const gradient=ctx.createLinearGradient(0,0,width,height);
      gradient.addColorStop(0,'#a58753');gradient.addColorStop(.32,'#574634');gradient.addColorStop(1,'#241f21');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      const text=node.querySelector('.spine-title,b,strong')?.textContent || node.dataset.rawTitle || '';
      if(text){ctx.fillStyle='#f0d9a7';ctx.textAlign='center';ctx.font='600 '+Math.max(7,Math.min(15,width/7))+'px Georgia';ctx.fillText(text,width/2,height/2,width*.86);}
    }
    if(node.dataset.volumeFace){
      ctx.fillStyle='rgba(24,16,12,'+(parseFloat(style.getPropertyValue('--volume-shade'))||.06)+')';ctx.fillRect(0,0,width,height);
    }
  }

  function capture(element) {
    try {
      if(!element?.isConnected || document.hidden)return null;
      const style=getComputedStyle(element);
      if(style.visibility==='hidden'||style.display==='none')return null;
      const bounds=rect(element.getBoundingClientRect()),clip=visibleBounds(element);
      if(clip.width<2||clip.height<2)return null;
      const width=Math.max(1,element.offsetWidth||bounds.width),height=Math.max(1,element.offsetHeight||bounds.height);
      const local=document.createElement('canvas');local.width=Math.ceil(width);local.height=Math.ceil(height);
      const ctx=local.getContext('2d');
      if(!ctx)return null;
      const fallback=[...element.querySelectorAll('.personal-book-front img,.shelf-book-cover img,img,canvas')].find(loaded);
      const faces=element.querySelectorAll('.shelf-volume > [data-volume-face]:not([hidden])');
      if(faces.length){
        for(const face of faces){
          const faceStyle=getComputedStyle(face),matrix=new DOMMatrix(faceStyle.transform==='none'?undefined:faceStyle.transform);
          ctx.save();ctx.transform(matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f);
          paintSurface(ctx,face,face.offsetWidth,face.offsetHeight,fallback);ctx.restore();
        }
      }else paintSurface(ctx,element,width,height,fallback);
      const image=document.createElement('canvas');
      // Limite de memória independente do zoom e da resolução da tela.
      const quality=Math.min(2,900/Math.max(bounds.width,bounds.height));
      image.width=Math.max(1,Math.ceil(bounds.width*quality));image.height=Math.max(1,Math.ceil(bounds.height*quality));
      const out=image.getContext('2d');
      if(!out)return null;
      const matrix=new DOMMatrix(style.transform==='none'?undefined:style.transform);
      if(matrix.is2D){
        const xs=[0,width*matrix.a,height*matrix.c,width*matrix.a+height*matrix.c];
        const ys=[0,width*matrix.b,height*matrix.d,width*matrix.b+height*matrix.d];
        const left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;
        out.scale(image.width/Math.max(1,w),image.height/Math.max(1,h));
        out.transform(matrix.a,matrix.b,matrix.c,matrix.d,-left,-top);
        out.drawImage(local,0,0,width,height);
      }else out.drawImage(local,0,0,image.width,image.height);
      return {element,bounds,clip,image};
    } catch { return null; }
  }

  // Erosão orgânica da silhueta original, convertendo a matéria em pó fino.
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  function hash(x,y){let n=Math.imul(x+137,374761393)+Math.imul(y+791,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
  function noise(x,y){
    const a=Math.floor(x),b=Math.floor(y),u=smooth(x-a),v=smooth(y-b);
    return mix(mix(hash(a,b),hash(a+1,b),u),mix(hash(a,b+1),hash(a+1,b+1),u),v);
  }
  // Frente de erosão predominantemente horizontal: começa no topo e desce,
  // com borda irregular suficiente para parecer matéria se desfazendo.
  function field(u,v){
    return clamp(.055+v*.79+(noise(u*4.5,v*5.5)-.5)*.18+
      (noise(u*18,v*23)-.5)*.055+(noise(u*72,v*88)-.5)*.018,.02,.985);
  }
  function canvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c;}
  function prepare(snapshot,cinema){
    const {bounds,clip,image}=snapshot,w=clip.width,h=clip.height;
    const q=Math.min(1.5,900/Math.max(w,h)),original=canvas(w*q,h*q),oc=original.getContext('2d');
    oc.drawImage(image,(clip.left-bounds.left)/bounds.width*image.width,(clip.top-bounds.top)/bounds.height*image.height,
      w/bounds.width*image.width,h/bounds.height*image.height,0,0,original.width,original.height);
    const sample=canvas(Math.min(original.width,180),Math.min(original.height,220)),ss=sample.getContext('2d',{willReadFrequently:true});
    ss.drawImage(original,0,0,sample.width,sample.height);
    let pixels=null;try{pixels=ss.getImageData(0,0,sample.width,sample.height).data;}catch{}
    const colorAt=(u,v)=>{
      if(!pixels)return [154,125,91,255];
      const i=(clamp(Math.floor(v*sample.height),0,sample.height-1)*sample.width+clamp(Math.floor(u*sample.width),0,sample.width-1))*4;
      return [pixels[i],pixels[i+1],pixels[i+2],pixels[i+3]];
    };
    const ratio=Math.min(1.25,340/Math.max(w,h));
    const mask=canvas(w*ratio,h*ratio),mc=mask.getContext('2d'),edge=canvas(mask.width,mask.height),ec=edge.getContext('2d');
    const md=mc.createImageData(mask.width,mask.height),ed=ec.createImageData(mask.width,mask.height),values=new Float32Array(mask.width*mask.height);
    for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
      const i=y*mask.width+x;values[i]=field((x+.5)/mask.width,(y+.5)/mask.height);
      md.data[i*4]=md.data[i*4+1]=md.data[i*4+2]=255;
      ed.data[i*4]=231;ed.data[i*4+1]=199;ed.data[i*4+2]=149;
    }
    const intact=canvas(original.width,original.height),ic=intact.getContext('2d');
    const rim=canvas(mask.width,mask.height),rc=rim.getContext('2d');
    // Grãos minúsculos com relevo e cores amostradas da capa, sem pedaços de papel.
    const palette=[],atlas=canvas(192,64),ac=atlas.getContext('2d');
    function getColor(r,g,b){
      const rgb=[r,g,b].map(v=>clamp(Math.round(v/48)*48,0,255));let best=0,distance=Infinity;
      for(let i=0;i<palette.length;i++){
        const p=palette[i],d=(p[0]-rgb[0])**2+(p[1]-rgb[1])**2+(p[2]-rgb[2])**2;
        if(d<distance){best=i;distance=d;}
      }
      if(distance===0||palette.length>=48)return best;
      palette.push(rgb);const i=palette.length-1,x=i%12*16,y=Math.floor(i/12)*16;
      const [rr,gg,bb]=rgb,light=v=>Math.round(mix(v,244,.36)),dark=v=>Math.round(v*.55);
      const gradient=ac.createRadialGradient(x+6,y+5,.4,x+8,y+8,7.2);
      gradient.addColorStop(0,'rgb('+light(rr)+','+light(gg)+','+light(bb)+')');
      gradient.addColorStop(.44,'rgb('+rr+','+gg+','+bb+')');
      gradient.addColorStop(.76,'rgba('+dark(rr)+','+dark(gg)+','+dark(bb)+',.95)');
      gradient.addColorStop(1,'rgba('+rr+','+gg+','+bb+',0)');
      ac.fillStyle=gradient;ac.fillRect(x,y,16,16);return i;
    }
    const direction=clip.left+w/2>innerWidth*.67?-1:1;
    const sizeScale=cinema?clamp(Math.sqrt(w*h/65000),.72,1.28):.7;
    const fragmentScale=clamp(Number(snapshot.fragmentScale)||1.35,.8,2.1);
    // Blocos recortados da própria capa: maiores e reconhecíveis, com proporções variadas.
    const chunks=[],chunkCount=cinema?clamp(Math.round(w*h/100),420,780):clamp(Math.round(w*h/150),90,240);
    for(let i=0;i<chunkCount*3&&chunks.length<chunkCount;i++){
      const u=Math.random(),v=Math.random(),[r,g,b,a]=colorAt(u,v);if(a<35)continue;
      const tier=Math.random();
      const base=(tier<.075?13+Math.random()*7:tier<.34?8+Math.random()*5:4.8+Math.random()*4.2)*sizeScale*fragmentScale;
      const width=base*(.78+Math.random()*.48),height=base*(.72+Math.random()*.58);
      const sw=Math.max(3,Math.min(original.width,Math.round(width/w*original.width)));
      const sh=Math.max(3,Math.min(original.height,Math.round(height/h*original.height)));
      const sx=Math.round(u*Math.max(0,original.width-sw)),sy=Math.round(v*Math.max(0,original.height-sh));
      chunks.push({x:clip.left+u*w,y:clip.top+v*h,release:field(u,v),sx,sy,sw,sh,width,height,
        life:cinema?2.4+Math.random()*1.6:1+Math.random()*.65,
        vx:direction*(14+Math.random()*56)+(Math.random()-.5)*38,
        vy:cinema?10+Math.random()*34:4+Math.random()*18,
        gravity:cinema?24+Math.random()*46:18+Math.random()*20,
        phase:Math.random()*6.283,spin:(Math.random()-.5)*5,
        opacity:.72+Math.random()*.28});
    }
    // Poeira fina fica como camada secundária; os fragmentos maiores carregam a ação.
    const particles=[],count=cinema?clamp(Math.round(w*h/60),650,1400):clamp(Math.round(w*h/9),120,650);
    const dustScale=cinema?clamp(Math.sqrt(w*h/65000),.65,1.2):.7;
    for(let i=0;i<count*4&&particles.length<count;i++){
      const u=Math.random(),v=Math.random(),[r,g,b,a]=colorAt(u,v);if(a<35)continue;
      const rare=Math.random(),radius=(rare<.025?1.25+Math.random()*.65:rare<.2?.65+Math.random()*.55:.22+Math.random()*.48)*dustScale;
      const p=getColor(r,g,b),dust=rare>.76;
      particles.push({x:clip.left+u*w,y:clip.top+v*h,release:field(u,v),radius,life:cinema?1.5+Math.random()*2.2:.65+Math.random()*.8,
        vx:direction*(17+Math.random()*64)+(Math.random()-.5)*35,vy:(Math.random()-.5)*35-(dust?24:5),
        phase:Math.random()*6.283,spin:.9+Math.random()*2.3,drift:8+Math.random()*21,
        ax:p%12*16,ay:Math.floor(p/12)*16,opacity:.42+Math.random()*.52,dust});
    }
    const haze=Array.from({length:cinema?30:8},()=>{
      const p=particles[Math.floor(Math.random()*particles.length)];
      return p?{...p,radius:cinema?10+Math.random()*21:5+Math.random()*8,life:cinema?2.4+Math.random()*1.5:1.2}:null;
    }).filter(Boolean);
    return {original,mask,mc,md,edge,ec,ed,values,intact,ic,rim,rc,atlas,chunks,particles,haze,w,h,fragmentScale};
  }
  function paintBook(ctx,e,clip,threshold){
    if(threshold<-.035){ctx.drawImage(e.original,clip.left,clip.top,e.w,e.h);return;}
    if(threshold>1.035)return;
    const {mask,mc,md,edge,ec,ed,values,intact,ic,rim,rc,original}=e;
    for(let i=0;i<values.length;i++){
      const d=values[i]-threshold;
      md.data[i*4+3]=Math.round(255*smooth((d+.015)/.035));
      ed.data[i*4+3]=Math.round(110*Math.max(0,1-Math.abs(d-.006)*46)**2);
    }
    mc.putImageData(md,0,0);ec.putImageData(ed,0,0);
    ic.globalCompositeOperation='source-over';ic.clearRect(0,0,intact.width,intact.height);ic.drawImage(original,0,0);
    ic.globalCompositeOperation='destination-in';ic.drawImage(mask,0,0,intact.width,intact.height);
    ic.globalCompositeOperation='source-over';ctx.drawImage(intact,clip.left,clip.top,e.w,e.h);
    // A luminosidade da borda acompanha a forma real, não o retângulo da imagem.
    rc.globalCompositeOperation='source-over';rc.clearRect(0,0,rim.width,rim.height);rc.drawImage(edge,0,0);
    rc.globalCompositeOperation='destination-in';rc.drawImage(original,0,0,rim.width,rim.height);
    rc.globalCompositeOperation='source-over';ctx.globalAlpha=.56;ctx.drawImage(rim,clip.left,clip.top,e.w,e.h);ctx.globalAlpha=1;
  }
  function paintSweep(ctx,e,clip,threshold){
    if(threshold<=.015||threshold>=.99)return;
    const width=e.mask.width,height=e.mask.height,samples=Math.min(100,width);
    ctx.save();ctx.globalCompositeOperation='screen';ctx.beginPath();
    let started=false;
    for(let i=0;i<samples;i++){
      const xIndex=Math.round(i*(width-1)/Math.max(1,samples-1));
      let low=0,high=height-1;
      // Busca a borda da erosão em cada coluna; o campo é majoritariamente monotônico.
      for(let step=0;step<10;step++){
        const mid=(low+high)>>1;
        if(e.values[mid*width+xIndex]<threshold)low=mid+1;else high=mid;
      }
      const y=clip.top+low/height*e.h,x=clip.left+xIndex/width*e.w;
      if(y<clip.top||y>clip.bottom)continue;
      if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
    }
    if(started){
      ctx.lineCap='round';ctx.lineJoin='round';
      ctx.shadowColor='rgba(255,181,96,.95)';ctx.shadowBlur=18;
      ctx.strokeStyle='rgba(255,202,132,.92)';ctx.lineWidth=2.5;ctx.stroke();
      ctx.shadowBlur=5;ctx.strokeStyle='rgba(255,244,220,.96)';ctx.lineWidth=.75;ctx.stroke();
    }
    ctx.restore();
  }
  function paintDust(ctx,e,elapsed,start,span){
    for(const p of e.haze){
      const t=elapsed-start-p.release*span;if(t<=0||t>=p.life)continue;
      const a=t/p.life,x=p.x+p.vx*t*.56+Math.sin(p.phase+t*1.4)*12*t,y=p.y-18*t+Math.cos(p.phase+t)*8*t;
      const radius=p.radius*(.55+a*1.5),g=ctx.createRadialGradient(x,y,0,x,y,radius);
      g.addColorStop(0,'rgba(174,145,111,'+(.075*Math.sin(Math.PI*a))+')');g.addColorStop(1,'rgba(174,145,111,0)');
      ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    // Blocos maiores: recortes reais da capa, com rotação, gravidade e bordas em relevo.
    for(const p of e.chunks){
      const t=elapsed-start-p.release*span;if(t<0||t>=p.life)continue;
      const a=t/p.life,drift=Math.sin(p.phase+t*1.7)*p.width*.62;
      const x=p.x+p.vx*t+drift;
      const y=p.y+p.vy*t+.5*p.gravity*t*t+Math.cos(p.phase+t*1.5)*p.height*.28;
      const scale=1-a*.38,ww=p.width*scale,hh=p.height*scale;
      ctx.save();ctx.translate(x,y);ctx.rotate(p.phase*.12+p.spin*t);
      ctx.globalAlpha=p.opacity*smooth(t/.07)*Math.pow(1-a,.92);
      ctx.shadowColor='rgba(12,9,7,.42)';ctx.shadowBlur=3;
      ctx.drawImage(e.original,p.sx,p.sy,p.sw,p.sh,-ww/2,-hh/2,ww,hh);
      ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,235,196,.48)';ctx.lineWidth=.55;
      ctx.strokeRect(-ww/2,-hh/2,ww,hh);
      ctx.fillStyle='rgba(255,241,211,.22)';ctx.fillRect(-ww/2,-hh/2,ww,.7);
      ctx.fillStyle='rgba(17,12,9,.22)';ctx.fillRect(-ww/2,hh/2-.7,ww,.7);
      ctx.restore();
    }
    // Poeira pequena acompanha os blocos, sem competir com os quadrados maiores.
    for(const p of e.particles){
      const t=elapsed-start-p.release*span;if(t<0||t>=p.life)continue;
      const a=t/p.life,curl=Math.sin(p.phase+t*p.spin)*p.drift*t*.55;
      const x=p.x+p.vx*t+curl,y=p.y+p.vy*t+Math.cos(p.phase+t*p.spin)*p.drift*t*.4+(p.dust?-5:12)*t*t;
      const size=p.radius*2*(1-a*.65)*(1+.16*Math.sin(p.phase+t*3));
      ctx.globalAlpha=p.opacity*smooth(t/.09)*Math.pow(1-a,1.15);
      ctx.drawImage(e.atlas,p.ax,p.ay,16,16,x-size/2,y-size/2,size,size);
    }
    ctx.globalAlpha=1;
  }
  function play(snapshot) {
    return new Promise(resolve=>{
      if(!snapshot||document.hidden||active.size>=4){resolve();return;}
      let overlay,frame,timer,finished=false,hidden=false;
      const source=snapshot.element,prior=source?.style.getPropertyValue('visibility'),priority=source?.style.getPropertyPriority('visibility');
      const finish=()=>{
        if(finished)return;finished=true;cancelAnimationFrame(frame);clearTimeout(timer);
        document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('resize',finish);
        overlay?.remove();active.delete(finish);
        if(hidden&&source){if(prior)source.style.setProperty('visibility',prior,priority);else source.style.removeProperty('visibility');}
        resolve();
      };
      const onVisibility=()=>{if(document.hidden)finish();};
      try{
        const vw=innerWidth,vh=innerHeight,dpr=Math.min(1.75,devicePixelRatio||1);
        overlay=canvas(vw*dpr,vh*dpr);overlay.className='aurora-book-particles';overlay.setAttribute('aria-hidden','true');overlay.setAttribute('role','presentation');overlay.setAttribute('popover','manual');
        document.body.append(overlay);
        if(overlay.showPopover){try{overlay.showPopover();}catch{}}
        else if(source?.closest('dialog[open]'))source.closest('dialog[open]').append(overlay);
        const ctx=overlay.getContext('2d');if(!ctx){finish();return;}
        ctx.scale(overlay.width/vw,overlay.height/vh);
        const {bounds,clip,image}=snapshot,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cinema=Boolean(snapshot.cinematic||source?.id==='scene');
        const startRelease=cinema?.32:.10,span=cinema?6.0:1.55,duration=reduced?.18:cinema?9.7:3.2;
        const effect=reduced?null:prepare(snapshot,cinema);
        if(source?.isConnected){source.style.setProperty('visibility','hidden','important');hidden=true;}
        active.add(finish);document.addEventListener('visibilitychange',onVisibility);window.addEventListener('resize',finish,{once:true});
        timer=setTimeout(finish,duration*1000+500);
        const start=performance.now();let last=-Infinity;
        const draw=now=>{
          try{
            const elapsed=(now-start)/1000;
            if(!reduced&&now-last<24&&elapsed<duration){frame=requestAnimationFrame(draw);return;}
            last=now;ctx.clearRect(0,0,vw,vh);
            if(reduced){
              ctx.globalAlpha=clamp(1-elapsed/duration,0,1);
              ctx.drawImage(image,(clip.left-bounds.left)/bounds.width*image.width,(clip.top-bounds.top)/bounds.height*image.height,
                clip.width/bounds.width*image.width,clip.height/bounds.height*image.height,clip.left,clip.top,clip.width,clip.height);
            }else{
              const threshold=(elapsed-startRelease)/span;
              paintBook(ctx,effect,clip,threshold);
              if(cinema)paintSweep(ctx,effect,clip,threshold);
              paintDust(ctx,effect,elapsed,startRelease,span);
            }
            ctx.globalAlpha=1;
            if(elapsed>=duration)finish();else frame=requestAnimationFrame(draw);
          }catch{finish();}
        };
        draw(start);
      }catch{finish();}
    });
  }
  window.AuroraBookParticles={capture,play};
})();
