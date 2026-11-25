/* Reações e exclusão do visor 3D. Mantém arquivos e progresso ao retirar da estante. */
(()=>{
'use strict';
const H='aurora-retirados-estante-v1',R='aurora-reacoes-livros-v1',P='aurora-estante-exemplares-v1:';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}};
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const keyOf=(s,id,t)=>['pdf','epub','audio'].includes(s)?'arquivo:'+id:s+':'+(s==='online'?id:t);
const keyFor=b=>keyOf(b.dataset.source,b.dataset.bookId,b.dataset.rawTitle);
const isHidden=k=>read(H,[]).includes(k);
function setHidden(k,hide){const a=new Set(read(H,[]));hide?a.add(k):a.delete(k);write(H,[...a])}
function mark(b){if(isHidden(keyFor(b)))b.dataset.auroraShelved='no';else delete b.dataset.auroraShelved}
function sync(){document.querySelectorAll('#library .bookrow > .book-spine').forEach(mark);window.AuroraShelf?.categories.forEach(c=>window.AuroraShelf.refreshCount(c.id));document.dispatchEvent(new Event('aurora:shelf-visibility'))}
const reaction=k=>read(R,{})[k]||'';
function setReaction(k,v){const a=read(R,{});if(a[k]===v)delete a[k];else a[k]=v;write(R,a);return a[k]||''}
async function erase({source,id,title,key}){
 if(['pdf','epub','audio'].includes(source)){
  const db=await window.AuroraFormats.database();
  try{await new Promise((resolve,reject)=>{const tx=db.transaction(['books','progress'],'readwrite');tx.objectStore('books').delete(id);tx.objectStore('progress').delete(id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Exclusão interrompida.'))})}finally{db.close()}
 }else if(source==='online'){const k='aurora-online-books-v1';write(k,read(k,[]).filter(b=>b.key!==id))}
 else if(source==='txt'){const k='aurora-books',c='aurora-txt-categories',a=read(k,{}),b=read(c,{});delete a[title];delete b[title];write(k,a);write(c,b);localStorage.removeItem('aurora-page:'+title);localStorage.removeItem('aurora-page-v2:'+title)}
 else if(source!=='demo')throw Error('Formato não reconhecido.');
 if(source!=='online'){try{const k='aurora-hidden-books',a=new Set(read(k,[]));const norm=window.AuroraShelf?.normalize||(v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(e|de|da|do|dos|das)\b/g,'').replace(/[^a-z0-9]/g,''));a.add(norm(title));write(k,[...a])}catch(e){if(source==='demo')throw e;console.warn(e)}}
 try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith(P))continue;const a=read(k,[]);if(!Array.isArray(a))continue;write(k,a.filter(m=>m.key!==key).map(m=>{if(m.pose?.stackOn!==key)return m;const pose={...m.pose,y:0,stackOffset:0};delete pose.stackOn;return {...m,pose}}))}setHidden(key,false);const a=read(R,{});delete a[key];write(R,a)}catch(e){console.warn('Referências serão atualizadas ao reabrir.',e)}
}
function capture(scene,css,options={}){
 try{if(scene.classList.contains('three-ready')&&!scene.classList.contains('aurora-force-css')){
  const frame=window.Aurora3D?.captureFrame?.(options);if(frame){
   const c=document.createElement('canvas'),s=Math.min(1,900/Math.max(frame.width,frame.height));c.width=Math.max(1,Math.round(frame.width*s));c.height=Math.max(1,Math.round(frame.height*s));
   const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(frame,0,0,c.width,c.height);
   const w=c.width,h=c.height,d=ctx.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>18){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
   if(x1>=x0&&y1>=y0){const image=document.createElement('canvas');image.width=x1-x0+1;image.height=y1-y0+1;image.getContext('2d').drawImage(c,x0,y0,image.width,image.height,0,0,image.width,image.height);
    const r=scene.getBoundingClientRect(),left=r.left+x0/w*r.width,top=r.top+y0/h*r.height,width=image.width/w*r.width,height=image.height/h*r.height,bounds={left,top,width,height,right:left+width,bottom:top+height};
    const clip={left:Math.max(0,left),top:Math.max(0,top),right:Math.min(innerWidth,bounds.right),bottom:Math.min(innerHeight,bounds.bottom)};clip.width=clip.right-clip.left;clip.height=clip.bottom-clip.top;if(clip.width>2&&clip.height>2)return {element:scene,image,bounds,clip}
   }
  }
 }}catch(e){console.warn('Captura WebGL indisponível:',e)}
 const shot=window.AuroraBookParticles?.capture(css);if(shot)shot.element=scene;return shot;
}
function mount(root,getBook,handlers){
 const p=root.querySelector('.aurora-book-actions');if(!p)return;
 const status=p.querySelector('[role=status]'),menu=p.querySelector('.aurora-delete-options'),remove=p.querySelector('[data-book-action=delete]'),restore=p.querySelector('[data-book-action=restore]');let busy=false;
 function refresh(){const b=getBook();if(!b)return;for(const x of p.querySelectorAll('[data-reaction]'))x.setAttribute('aria-pressed',String(x.dataset.reaction===reaction(b.key)));const hidden=!b.personal&&isHidden(b.key);restore.hidden=!hidden;menu.querySelector('[data-remove-scope=shelf]').hidden=hidden;menu.hidden=true;remove.setAttribute('aria-expanded','false');status.textContent=''}
 for(const [v,emoji,label] of [['like','👍','Gostei'],['dislike','👎','Não gostei'],['love','❤️','Amei'],['cry','😢','Me emocionou']]){
  const b=document.createElement('button');b.type='button';b.dataset.reaction=v;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed','false');const icon=document.createElement('span');icon.textContent=emoji;icon.setAttribute('aria-hidden','true');const t=document.createElement('small');t.textContent=label;b.append(icon,t);p.querySelector('.aurora-reactions').insertBefore(b,remove);
  b.onclick=()=>{const book=getBook();if(!book||busy)return;try{setReaction(book.key,v);refresh();status.textContent='Reação salva neste aparelho.'}catch{status.textContent='Não foi possível salvar a reação.'}}
 }
 remove.onclick=()=>{if(busy)return;menu.hidden=!menu.hidden;remove.setAttribute('aria-expanded',String(!menu.hidden))};
 menu.querySelector('[data-remove-scope=cancel]').onclick=()=>{menu.hidden=true;remove.setAttribute('aria-expanded','false')};
 restore.onclick=()=>{const b=getBook();if(!b||busy)return;try{setHidden(b.key,false);sync();refresh();status.textContent='Livro devolvido à estante.'}catch{status.textContent='Não foi possível devolver o livro.'}};
 for(const x of menu.querySelectorAll('[data-remove-scope=shelf],[data-remove-scope=app]'))x.onclick=async()=>{
  const b=getBook(),scope=x.dataset.removeScope;if(!b||busy)return;
  if(scope==='app'&&!confirm('Excluir "'+b.title+'" do aplicativo? O livro e seu progresso serão removidos da Aurora. O arquivo original no celular não será apagado.'))return;
  busy=true;p.querySelectorAll('button').forEach(b=>b.disabled=true);
  const scene=root.querySelector('#scene'),shot=capture(scene,root.querySelector('#book3d'));
  try{if(scope==='app')await erase(b);else if(b.personal)await handlers.removePersonal(b);else setHidden(b.key,true);
   menu.hidden=true;const opacity=scene.style.opacity;scene.style.opacity='0';try{await window.AuroraBookParticles?.play(shot)}catch{}finally{scene.style.opacity=opacity}
   sync();handlers.done(scope,b)
  }catch(e){status.textContent='Não foi possível concluir: '+(e?.message||e)}finally{busy=false;p.querySelectorAll('button').forEach(b=>b.disabled=false)}
 };
 return {refresh,isBusy:()=>busy};
}
window.AuroraBookActions={keyOf,keyFor,isHidden,setHidden,mark,sync,reaction,setReaction,erase,capture,mount};
})();
