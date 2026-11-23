/* Fragmentos do próprio exemplar, sem ler pixels nem carregar imagens da rede. */
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

  function play(snapshot) {
    return new Promise(resolve => {
      if(!snapshot || document.hidden || active.size>=4){resolve();return;}
      let overlay,frame,timer,finished=false,hidden=false;
      const source=snapshot.element,prior=source?.style.getPropertyValue('visibility'),priority=source?.style.getPropertyPriority('visibility');
      const finish=()=>{
        if(finished)return;finished=true;
        cancelAnimationFrame(frame);clearTimeout(timer);
        document.removeEventListener('visibilitychange',onVisibility);
        window.removeEventListener('resize',finish);
        overlay?.remove();active.delete(finish);
        if(hidden&&source){if(prior)source.style.setProperty('visibility',prior,priority);else source.style.removeProperty('visibility');}
        resolve();
      };
      const onVisibility=()=>{if(document.hidden)finish();};
      try {
        overlay=document.createElement('canvas');overlay.className='aurora-book-particles';
        overlay.setAttribute('aria-hidden','true');overlay.setAttribute('role','presentation');
        overlay.setAttribute('popover','manual');
        const dpr=Math.min(2,devicePixelRatio||1),vw=innerWidth,vh=innerHeight;
        overlay.width=Math.ceil(vw*dpr);overlay.height=Math.ceil(vh*dpr);
        document.body.append(overlay);
        if(overlay.showPopover){try{overlay.showPopover();}catch{/* Fallback normal de empilhamento. */}}
        else if(source?.closest('dialog[open]'))source.closest('dialog[open]').append(overlay);
        const ctx=overlay.getContext('2d');
        if(!ctx){finish();return;}
        ctx.scale(dpr,dpr);
        const {bounds,clip,image}=snapshot;
        const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const columns=clamp(Math.round(Math.sqrt(340*clip.width/clip.height)),3,38);
        const rows=clamp(Math.round(340/columns),5,70);
        const cellW=clip.width/columns,cellH=clip.height/rows;
        const particles=[];
        for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
          const px=clip.left+x*cellW,py=clip.top+y*cellH;
          particles.push({x:px,y:py,w:cellW+.25,h:cellH+.25,
            sx:(px-bounds.left)/bounds.width*image.width,sy:(py-bounds.top)/bounds.height*image.height,
            sw:cellW/bounds.width*image.width,sh:cellH/bounds.height*image.height,
            delay:50+y/rows*220+(1-x/columns)*75+Math.random()*60,
            vx:(Math.random()-.4)*65,vy:-18-Math.random()*27,
            spin:(Math.random()-.5)*7,phase:Math.random()*Math.PI*2,
            glint:Math.random()>.93});
        }
        if(source?.isConnected){source.style.setProperty('visibility','hidden','important');hidden=true;}
        active.add(finish);
        document.addEventListener('visibilitychange',onVisibility);
        window.addEventListener('resize',finish,{once:true});
        timer=setTimeout(finish,1600);
        const start=performance.now(),duration=reduced?160:1180;
        const draw=now=>{
          try {
            const elapsed=now-start;
            ctx.clearRect(0,0,vw,vh);
            if(reduced){
              ctx.globalAlpha=Math.max(0,1-elapsed/duration);
              ctx.drawImage(image,(clip.left-bounds.left)/bounds.width*image.width,(clip.top-bounds.top)/bounds.height*image.height,
                clip.width/bounds.width*image.width,clip.height/bounds.height*image.height,clip.left,clip.top,clip.width,clip.height);
            }else for(const p of particles){
              const age=Math.max(0,elapsed-p.delay)/1000,progress=clamp(age/.8,0,1);
              const shrink=1-.67*Math.min(1,age*3.7),fade=Math.pow(1-progress,1.25);
              if(fade<=0)continue;
              ctx.save();ctx.globalAlpha=fade;
              const flutter=Math.sin(p.phase+age*7)*age*10;
              ctx.translate(p.x+p.w/2+p.vx*age+flutter,p.y+p.h/2+p.vy*age+260*age*age);
              ctx.rotate(p.spin*age);ctx.scale(shrink,shrink);
              ctx.drawImage(image,p.sx,p.sy,p.sw,p.sh,-p.w/2,-p.h/2,p.w,p.h);
              if(p.glint&&age>.08){ctx.globalAlpha=fade*.32;ctx.fillStyle='#efca81';ctx.fillRect(-1,-1,1.7,1.7);}
              ctx.restore();
            }
            ctx.globalAlpha=1;
            if(elapsed>=duration)finish();else frame=requestAnimationFrame(draw);
          }catch{finish();}
        };
        frame=requestAnimationFrame(draw);
      }catch{finish();}
    });
  }
  window.AuroraBookParticles={capture,play};
})();
