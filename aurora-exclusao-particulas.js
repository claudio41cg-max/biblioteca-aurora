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

  // Malha irregular contínua: as peças vizinhas compartilham a mesma borda.
  function fracture(width,height,count,random=Math.random) {
    const columns=clamp(Math.round(Math.sqrt(count*.62*width/height)),3,26);
    const rows=clamp(Math.round(count*.62/columns),4,48);
    const dx=width/columns,dy=height/rows;
    const vertices=Array.from({length:rows+1},(_,y)=>Array.from({length:columns+1},(_,x)=>[
      x*dx+(x&&x<columns?(random()-.5)*dx*.68:0),
      y*dy+(y&&y<rows?(random()-.5)*dy*.68:0)
    ]));
    const shapes=[];
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      const a=vertices[y][x],b=vertices[y][x+1],c=vertices[y+1][x+1],d=vertices[y+1][x];
      if(random()<.34)shapes.push([a,b,c,d]);
      else if(random()<.5)shapes.push([a,b,c],[a,c,d]);
      else shapes.push([a,b,d],[b,c,d]);
    }
    return shapes;
  }
  function polygon(ctx,points,ox=0,oy=0){
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x-ox,y-oy):ctx.moveTo(x-ox,y-oy));ctx.closePath();
  }
  function makeCanvas(w,h){
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(w));canvas.height=Math.max(1,Math.ceil(h));return canvas;
  }
  function prepare(snapshot,cinema,vw,vh){
    const {bounds,clip,image}=snapshot;
    const w=clip.width,h=clip.height;
    const q=Math.min(1.6,850/Math.max(w,h));
    const intact=makeCanvas(w*q,h*q),ic=intact.getContext('2d',{willReadFrequently:true});
    const sx=(clip.left-bounds.left)/bounds.width*image.width,sy=(clip.top-bounds.top)/bounds.height*image.height;
    ic.drawImage(image,sx,sy,w/bounds.width*image.width,h/bounds.height*image.height,0,0,intact.width,intact.height);
    let pixels=null;try{pixels=ic.getImageData(0,0,intact.width,intact.height).data;}catch{/* Uma capa externa pode impedir a leitura, mas ainda pode ser desenhada. */}
    const alphaAt=(x,y)=>pixels?pixels[(clamp(Math.floor(y*q),0,intact.height-1)*intact.width+clamp(Math.floor(x*q),0,intact.width-1))*4+3]:255;
    const center=clip.left+w/2;
    const floor=Math.min(vh-22,clip.bottom+(cinema?Math.min(24,h*.055):Math.min(10,h*.1)));
    const spread=Math.min(vw*.43,w*(cinema?.76:.65));
    const startRelease=cinema?.48:.08,releaseSpan=cinema?4.25:1.25;
    const particles=[],shapes=fracture(w,h,cinema?560:175);
    // Atlas único: recortes reais da capa e verso de papel, sem centenas de canvases.
    const maxW=Math.ceil(Math.max(...shapes.map(p=>Math.max(...p.map(v=>v[0]))-Math.min(...p.map(v=>v[0]))))*q)+6;
    const maxH=Math.ceil(Math.max(...shapes.map(p=>Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]))))*q)+6;
    const cols=Math.max(1,Math.floor(1024/maxW));
    const atlas=makeCanvas(cols*maxW,Math.ceil(shapes.length/cols)*maxH),ac=atlas.getContext('2d');
    const paper=makeCanvas(atlas.width,atlas.height),pc=paper.getContext('2d');
    for(let i=0;i<shapes.length;i++){
      const points=shapes[i],xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      const x0=Math.min(...xs),y0=Math.min(...ys),pw=Math.max(...xs)-x0,ph=Math.max(...ys)-y0;
      const cx=xs.reduce((a,b)=>a+b,0)/xs.length,cy=ys.reduce((a,b)=>a+b,0)/ys.length;
      if(pixels && ![...points,[cx,cy],...points.map(([x,y])=>[(x+cx)/2,(y+cy)/2])].some(([x,y])=>alphaAt(x,y)>12))continue;
      const ax=i%cols*maxW,ay=Math.floor(i/cols)*maxH,aw=Math.ceil(pw*q)+4,ah=Math.ceil(ph*q)+4;
      for(const [ctx,back] of [[ac,false],[pc,true]]){
        ctx.save();ctx.translate(ax+2,ay+2);ctx.scale(q,q);
        polygon(ctx,points,x0,y0);ctx.clip();
        if(!back)ctx.drawImage(intact,-x0,-y0,intact.width/q,intact.height/q);
        else{
          const shade=194+Math.floor(Math.random()*44);
          ctx.fillStyle='rgb('+shade+','+(shade-11)+','+(shade-32)+')';ctx.fillRect(0,0,pw,ph);
          ctx.strokeStyle='rgba(70,49,29,.18)';ctx.lineWidth=.45;
          for(let y=1;y<ph;y+=2.8){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(pw*(.4+Math.random()*.6),y);ctx.stroke();}
        }
        ctx.restore();
      }
      const normalized=cy/h;
      const release=startRelease+clamp(normalized*.88+Math.random()*.19,0,1)*releaseSpan;
      const x=clip.left+x0+pw/2,y=clip.top+y0+ph/2;
      const destX=clamp(center+(Math.random()+Math.random()-1)*spread,8,vw-8);
      const mound=Math.max(0,1-Math.abs(destX-center)/Math.max(1,spread));
      const destY=floor-mound*(cinema?Math.min(33,h*.10):Math.min(9,h*.15))*(.15+normalized*.85)-Math.random()*(cinema?7:3);
      const gravity=cinema?Math.max(160,h*1.15):Math.max(180,h*2.5);
      const vy=-(cinema?40+Math.random()*105:15+Math.random()*40);
      const fall=(Math.sqrt(vy*vy+2*gravity*Math.max(0,destY-y))-vy)/gravity;
      particles.push({points,x,y,pw,ph,ax,ay,aw,ah,release,destX,destY,gravity,vy,fall:Math.max(.28,fall),
        spin:(Math.random()-.5)*7,phase:Math.random()*6.283,flip:3+Math.random()*7,
        flutter:(cinema?10:3)+Math.random()*(cinema?18:6),angle:(Math.random()-.5)*3.4,
        paperOnly:false,cut:false});
    }
    // Fragmentos internos das folhas, além da superfície visível da capa.
    const paperPieces=[];
    const total=cinema?150:35;
    for(let i=0;i<total&&particles.length;i++){
      const p=particles[Math.floor(Math.random()*particles.length)];
      const destX=clamp(center+(Math.random()+Math.random()-1)*spread*1.2,5,vw-5);
      const destY=floor-Math.random()*(cinema?16:5);
      const vy=-(cinema?65+Math.random()*125:20+Math.random()*35),gravity=p.gravity;
      paperPieces.push({...p,paperOnly:true,release:p.release+Math.random()*.20,destX,destY,vy,
        fall:Math.max(.3,(Math.sqrt(vy*vy+2*gravity*Math.max(0,destY-p.y))-vy)/gravity),
        spin:(Math.random()-.5)*10,phase:Math.random()*6.283,flip:5+Math.random()*8,
        scale:.35+Math.random()*.7,angle:(Math.random()-.5)*5});
    }
    const dust=Array.from({length:cinema?65:16},()=>({
      x:center+(Math.random()-.5)*spread*1.4,y:floor-Math.random()*12,
      birth:(cinema?2.4:.6)+Math.random()*(cinema?3.5:1.4),
      life:cinema?1.5+Math.random()*2:.6+Math.random()*.6,
      vx:(Math.random()-.5)*18,vy:8+Math.random()*22,r:.5+Math.random()*1.4,phase:Math.random()*6.283
    }));
    const settled=makeCanvas(vw,vh),sc=settled.getContext('2d');
    return {intact,ic,atlas,paper,particles,paperPieces,dust,center,floor,spread,q,w,h,settled,sc,lastRelease:startRelease+releaseSpan};
  }
  function drawFragment(ctx,p,atlas,paper,elapsed,q,fade){
    const age=elapsed-p.release;if(age<0)return;
    const landed=age>=p.fall,t=Math.min(age,p.fall),u=clamp(t/p.fall,0,1);
    const drift=Math.sin(p.phase+t*8)*p.flutter*Math.sin(Math.PI*u);
    const x=p.x+(p.destX-p.x)*u+drift;
    // Movimento balístico, com ajuste suave para coincidir com o ponto de repouso.
    const raw=p.y+p.vy*t+.5*p.gravity*t*t;
    const end=p.y+p.vy*p.fall+.5*p.gravity*p.fall*p.fall;
    const y=landed?p.destY:raw+(p.destY-end)*u*u;
    const bounce=landed?Math.sin(Math.min(1,(age-p.fall)/.25)*Math.PI)*Math.max(0,1-(age-p.fall)/.25)*3:0;
    const face=landed?.83:Math.cos(p.phase+t*p.flip);
    const scale=p.scale||1;
    const angle=landed?p.angle:p.spin*t+p.angle*u;
    const dw=p.aw/q*scale,dh=p.ah/q*scale;
    ctx.save();ctx.globalAlpha=fade;
    ctx.translate(x,y-bounce);ctx.rotate(angle);
    ctx.scale(Math.max(.10,Math.abs(face)),landed?.52:Math.max(.4,1-.26*Math.abs(Math.sin(t*5+p.phase))));
    // Uma pequena borda escura cria espessura quando o fragmento gira.
    ctx.drawImage(paper,p.ax,p.ay,p.aw,p.ah,-dw/2+.7,-dh/2+1.1,dw,dh);
    ctx.drawImage(p.paperOnly||face<0?paper:atlas,p.ax,p.ay,p.aw,p.ah,-dw/2,-dh/2,dw,dh);
    ctx.restore();
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
      try{
        overlay=document.createElement('canvas');overlay.className='aurora-book-particles';
        overlay.setAttribute('aria-hidden','true');overlay.setAttribute('role','presentation');overlay.setAttribute('popover','manual');
        const dpr=Math.min(1.5,devicePixelRatio||1),vw=innerWidth,vh=innerHeight;
        overlay.width=Math.ceil(vw*dpr);overlay.height=Math.ceil(vh*dpr);
        document.body.append(overlay);
        if(overlay.showPopover){try{overlay.showPopover();}catch{}}
        else if(source?.closest('dialog[open]'))source.closest('dialog[open]').append(overlay);
        const ctx=overlay.getContext('2d');if(!ctx){finish();return;}
        ctx.scale(dpr,dpr);
        const {bounds,clip,image}=snapshot;
        const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const cinema=Boolean(snapshot.cinematic||source?.id==='scene');
        const duration=reduced?.18:cinema?9:3.5;
        const effect=reduced?null:prepare(snapshot,cinema,vw,vh);
        if(source?.isConnected){source.style.setProperty('visibility','hidden','important');hidden=true;}
        active.add(finish);document.addEventListener('visibilitychange',onVisibility);
        window.addEventListener('resize',finish,{once:true});
        timer=setTimeout(finish,duration*1000+500);
        const start=performance.now();
        const draw=now=>{
          try{
            const elapsed=(now-start)/1000;
            ctx.clearRect(0,0,vw,vh);
            if(reduced){
              ctx.globalAlpha=clamp(1-elapsed/duration,0,1);
              ctx.drawImage(image,(clip.left-bounds.left)/bounds.width*image.width,(clip.top-bounds.top)/bounds.height*image.height,
                clip.width/bounds.width*image.width,clip.height/bounds.height*image.height,clip.left,clip.top,clip.width,clip.height);
            }else{
              const {intact,ic,atlas,paper,particles,paperPieces,dust,center,floor,spread,q,w,h,settled,sc,lastRelease}=effect;
              const fade=clamp((duration-elapsed)/(cinema?1.15:.48),0,1);
              // A parte ainda intacta não é reconstruída em quadrados a cada quadro.
              // Retiramos apenas o polígono que acaba de se desprender.
              ic.save();ic.scale(q,q);ic.globalCompositeOperation='destination-out';
              for(const p of particles)if(!p.cut&&elapsed>=p.release){
                p.cut=true;polygon(ic,p.points);ic.fill();ic.lineWidth=.65;ic.stroke();
              }
              ic.restore();
              if(elapsed>=lastRelease+.05&&!effect.cleared){ic.clearRect(0,0,intact.width,intact.height);effect.cleared=true;}
              ctx.globalAlpha=fade;
              const pile=clamp((elapsed-(cinema?1.8:.45))/(cinema?4.4:1.7),0,1);
              if(pile>0){
                ctx.save();ctx.translate(center,floor);ctx.scale(1,.17);
                const g=ctx.createRadialGradient(0,0,0,0,0,Math.max(1,spread));g.addColorStop(0,'rgba(55,35,20,'+(.34*pile)+')');g.addColorStop(1,'rgba(55,35,20,0)');
                ctx.fillStyle=g;ctx.fillRect(-spread,-spread,spread*2,spread*2);ctx.restore();
              }
              // Pedaços já pousados ficam visíveis, formando uma pilha, até o final.
              // Depois do pequeno ressalto, cada pedaço é pintado uma única vez.
              // O S24 não precisa redesenhar centenas de fragmentos imóveis a cada quadro.
              for(const group of [particles,paperPieces])for(const p of group){
                if(!p.settled&&elapsed>=p.release+p.fall+.25){
                  drawFragment(sc,p,atlas,paper,elapsed,q,1);p.settled=true;
                }
              }
              ctx.globalAlpha=fade;ctx.drawImage(settled,0,0);
              for(const group of [particles,paperPieces])for(const p of group)
                if(!p.settled&&elapsed>=p.release+p.fall)drawFragment(ctx,p,atlas,paper,elapsed,q,fade);
              ctx.globalAlpha=fade;ctx.drawImage(intact,clip.left,clip.top,w,h);
              for(const p of particles)if(elapsed>=p.release&&elapsed<p.release+p.fall)drawFragment(ctx,p,atlas,paper,elapsed,q,fade);
              for(const p of paperPieces)if(elapsed>=p.release&&elapsed<p.release+p.fall)drawFragment(ctx,p,atlas,paper,elapsed,q,fade);
              for(const d of dust){
                const age=elapsed-d.birth;if(age<0||age>d.life)continue;
                ctx.globalAlpha=fade*.42*Math.sin(Math.PI*age/d.life);
                ctx.fillStyle='#bba68a';ctx.beginPath();
                ctx.arc(d.x+d.vx*age+Math.sin(d.phase+age*3)*6,d.y-d.vy*age,d.r*(1+age*.18),0,Math.PI*2);ctx.fill();
              }
              if(cinema&&elapsed>4.6){
                // Névoa de pó discreta, sem fogo ou faíscas artificiais.
                const age=elapsed-4.6;
                for(let i=0;i<4;i++){
                  const a=clamp(age/1.1,0,1)*fade*.065,xx=center+Math.sin(age*1.3+i*1.9)*spread*.27,yy=floor-12-age*13-i*8;
                  const radius=12+age*7+i*3,g=ctx.createRadialGradient(xx,yy,0,xx,yy,radius);
                  g.addColorStop(0,'rgba(126,111,92,'+a+')');g.addColorStop(1,'rgba(126,111,92,0)');
                  ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(xx-radius,yy-radius,radius*2,radius*2);
                }
              }
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
