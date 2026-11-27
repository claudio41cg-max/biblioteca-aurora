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
  function field(u,v){
    return clamp(.075+v*.52+(1-u)*.10+(u<.16?(1-u/.16)*.13:0)+(u>.84?((u-.84)/.16)*.13:0)+(noise(u*5,v*6)-.5)*.25+(noise(u*21,v*24)-.5)*.095+(noise(u*90,v*105)-.5)*.035,.025,.975);
  }
  function canvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c;}
  function prepare(snapshot,cinema){
    const {bounds,clip,image}=snapshot,w=clip.width,h=clip.height;
    // Somente poeira fina; escala ajustável no laboratório entre 70% e 100%.
    const dustScale=clamp(Number(snapshot.dustScale)||1,1,1.4);
    const dustParticleScale=clamp(Number(snapshot.dustParticleScale)||1,.7,1);
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
      ed.data[i*4]=178;ed.data[i*4+1]=158;ed.data[i*4+2]=132;
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
    const baseParticleCount=cinema?clamp(Math.round(w*h/52),720,1550):clamp(Math.round(w*h/16),90,420);
    const particles=[],count=clamp(Math.round(baseParticleCount*dustScale),cinema?720:90,cinema?1850:520);
    const direction=clip.left+w/2>innerWidth*.67?-1:1,sizeScale=cinema?clamp(Math.sqrt(w*h/52000),.9,1.55):.9;
    for(let i=0;i<count*4&&particles.length<count;i++){
      const u=Math.random(),v=Math.random(),[r,g,b,a]=colorAt(u,v);if(a<35)continue;
      // A faixa de grãos maiores fica em ~70% do tamanho anterior; os grãos pequenos permanecem praticamente iguais.
      const rare=Math.random(),radius=(rare<.055?1.95+Math.random()*1.2:rare<.31?1.45+Math.random()*1.1:.72+Math.random()*.95)*sizeScale*dustParticleScale;
      const p=getColor(r,g,b),dust=rare>.83;
      particles.push({x:clip.left+u*w,y:clip.top+v*h,release:field(u,v),radius,life:cinema?1.7+Math.random()*2.3:.8+Math.random()*.9,
        vx:direction*(28+Math.random()*92)+(Math.random()-.5)*48,vy:(Math.random()-.5)*42-(dust?20:2),gravity:dust?-5:18+Math.random()*34,
        phase:Math.random()*6.283,spin:1.2+Math.random()*3.1,drift:10+Math.random()*27,
        ax:p%12*16,ay:Math.floor(p/12)*16,opacity:.48+Math.random()*.48,dust});
    }
    const haze=Array.from({length:Math.round((cinema?58:14)*dustScale)},()=>{
      const p=particles[Math.floor(Math.random()*particles.length)];
      return p?{...p,radius:(cinema?12+Math.random()*20:6+Math.random()*9)*dustParticleScale,life:cinema?2.7+Math.random()*1.8:1.6}:null;
    }).filter(Boolean);
    return {original,mask,mc,md,edge,ec,ed,values,intact,ic,rim,rc,atlas,particles,haze,w,h};
  }
  function paintBook(ctx,e,clip,threshold){
    if(threshold<-.035){ctx.drawImage(e.original,clip.left,clip.top,e.w,e.h);return;}
    if(threshold>1.035)return;
    const {mask,mc,md,edge,ec,ed,values,intact,ic,rim,rc,original}=e;
    for(let i=0;i<values.length;i++){
      const d=values[i]-threshold;
      md.data[i*4+3]=Math.round(255*smooth((d+.015)/.035));
      ed.data[i*4+3]=Math.round(34*Math.max(0,1-Math.abs(d-.006)*46)**2);
    }
    mc.putImageData(md,0,0);ec.putImageData(ed,0,0);
    ic.globalCompositeOperation='source-over';ic.clearRect(0,0,intact.width,intact.height);ic.drawImage(original,0,0);
    ic.globalCompositeOperation='destination-in';ic.drawImage(mask,0,0,intact.width,intact.height);
    ic.globalCompositeOperation='source-over';ctx.drawImage(intact,clip.left,clip.top,e.w,e.h);
    // A luminosidade da borda acompanha a forma real, não o retângulo da imagem.
    rc.globalCompositeOperation='source-over';rc.clearRect(0,0,rim.width,rim.height);rc.drawImage(edge,0,0);
    rc.globalCompositeOperation='destination-in';rc.drawImage(original,0,0,rim.width,rim.height);
    rc.globalCompositeOperation='source-over';ctx.globalAlpha=.16;ctx.drawImage(rim,clip.left,clip.top,e.w,e.h);ctx.globalAlpha=1;
  }
  function paintDust(ctx,e,elapsed,start,span){
    for(const p of e.haze){
      const t=elapsed-start-p.release*span;if(t<=0||t>=p.life)continue;
      const a=t/p.life,drift=Math.sin(p.phase+t*1.35);
      const x=p.x+p.vx*t*.48+drift*15*t,y=p.y-21*t+Math.cos(p.phase+t)*9*t;
      const radius=p.radius*(.55+a*1.6),opacity=.07*Math.sin(Math.PI*a);
      // Nuvens elípticas e translúcidas: fumaça difusa, não bolhas ou grãos sólidos.
      ctx.save();ctx.translate(x,y);ctx.rotate(drift*.17);ctx.scale(1.45,.76);
      const g=ctx.createRadialGradient(0,0,0,0,0,radius);
      g.addColorStop(0,'rgba(156,133,107,'+opacity+')');
      g.addColorStop(.46,'rgba(156,133,107,'+(opacity*.42)+')');
      g.addColorStop(1,'rgba(156,133,107,0)');
      ctx.fillStyle=g;ctx.fillRect(-radius,-radius,radius*2,radius*2);ctx.restore();
    }
    for(const p of e.particles){
      const t=elapsed-start-p.release*span;if(t<0||t>=p.life)continue;
      const a=t/p.life,curl=Math.sin(p.phase+t*p.spin)*p.drift*t*.55;
      const x=p.x+p.vx*t+curl,y=p.y+p.vy*t+.5*(p.gravity||12)*t*t+Math.cos(p.phase+t*p.spin)*p.drift*t*.4;
      const size=p.radius*2*(1-a*.65)*(1+.16*Math.sin(p.phase+t*3));
      ctx.globalAlpha=p.opacity*smooth(t/.09)*Math.pow(1-a,1.15);
      ctx.drawImage(e.atlas,p.ax,p.ay,16,16,x-size/2,y-size/2,size,size);
    }
    ctx.globalAlpha=1;
  }
  // Fontes externas SpritePilot, biblioteca CC0 1.0: whoosh com brilho, vento suave e shimmer final.
  // Sem drones graves, impactos ou repetição do mesmo whoosh.
  const SPELL_CAST_SOUND_URL='https://spritepilot.com/free-assets/sound-effects/magic/spell-cast.ogg';
  const WIND_SPELL_SOUND_URL='https://spritepilot.com/free-assets/sound-effects/magic/wind-spell.ogg';
  const BUFF_SOUND_URL='https://spritepilot.com/free-assets/sound-effects/magic/buff.ogg';
  function playDissolveSound(){
    if(typeof Audio==='undefined')return null;
    const players=[],timers=[];let stopped=false;
    const cues=[
      {at:0,url:SPELL_CAST_SOUND_URL,volume:.18},
      {at:3350,url:WIND_SPELL_SOUND_URL,volume:.12},
      {at:6550,url:BUFF_SOUND_URL,volume:.09}
    ];
    const playCue=cue=>{
      if(stopped)return;
      try{
        const audio=new Audio(cue.url);
        audio.preload='auto';audio.volume=cue.volume;
        players.push(audio);
        const promise=audio.play();
        if(promise&&typeof promise.catch==='function')promise.catch(()=>{});
      }catch{}
    };
    playCue(cues[0]);
    for(const cue of cues.slice(1))timers.push(setTimeout(()=>playCue(cue),cue.at));
    return ()=>{
      stopped=true;timers.forEach(clearTimeout);
      players.forEach(audio=>{try{audio.pause();audio.currentTime=0;}catch{}});
    };
  }
  function addGentleHaptic(){
    try{if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function')navigator.vibrate([8,34,7]);}
    catch{/* Vibração opcional. */}
  }

  function play(snapshot,{signal}={}) {
    return new Promise(resolve=>{
      if(!snapshot||signal?.aborted||document.hidden||active.size>=4){resolve();return;}
      let overlay,frame,timer,finished=false,hidden=false,stopAudio=null;
      const source=snapshot.element,prior=source?.style.getPropertyValue('visibility'),priority=source?.style.getPropertyPriority('visibility');
      const finish=()=>{
        if(finished)return;finished=true;cancelAnimationFrame(frame);clearTimeout(timer);
        signal?.removeEventListener('abort',finish);
        document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('resize',finish);
        overlay?.remove();active.delete(finish);stopAudio?.();stopAudio=null;
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
        const startRelease=cinema?.42:.10,span=cinema?5.2:1.55,duration=reduced?.18:cinema?8.7:3.2;
        const effect=reduced?null:prepare(snapshot,cinema);
        if(!reduced){
          if(snapshot.soundEnabled!==false)stopAudio=playDissolveSound();
          if(snapshot.hapticEnabled!==false)addGentleHaptic();
        }
        if(source?.isConnected){source.style.setProperty('visibility','hidden','important');hidden=true;}
        signal?.addEventListener('abort',finish,{once:true});
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
              paintBook(ctx,effect,clip,(elapsed-startRelease)/span);
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
