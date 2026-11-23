/* Prévia dos enfeites e fotos, confirmada em conjunto pelo botão Pronto. */
(() => {
  const canvas=document.getElementById('canvas'),scene=document.getElementById('shelfScene');
  if(!scene)return;
  const api=()=>window.AuroraObjectEditor;
  let session,dialog,hold,drag;
  const buttonFor=id=>[...scene.querySelectorAll('[data-object-id]')].find(node=>node.dataset.objectId===id);
  const itemFor=id=>session.changes.get(id)||api().items().find(item=>item.id===id);
  function select(id){
    if(!session||!itemFor(id))return;
    buttonFor(session.id)?.classList.remove('object-adjust-selected');
    session.id=id;
    buttonFor(id)?.classList.add('object-adjust-selected');
    const item=itemFor(id);
    const pending=session.removed.has(id);
    dialog.querySelector('[data-action=remove]').textContent=pending?'Desfazer exclusão':'Excluir da estante';
    dialog.querySelector('[data-action=remove]').setAttribute('aria-pressed',String(pending));
    dialog.querySelector('.object-remove-note').textContent=pending?'Será excluído ao tocar em Pronto.':'';
    dialog.querySelector('h2').textContent=item.name;
    dialog.querySelector('output').textContent=Math.round((item.size||88)/88*100)+'%';
    dialog.querySelector('input').value=item.yaw||0;
    dialog.querySelector('.object-angle').textContent=(item.yaw||0)+'°';
    for(const button of dialog.querySelectorAll('[data-orientation]'))button.setAttribute('aria-pressed',String((item.orientation||'vertical')===button.dataset.orientation));
  }
  function preview(changes){
    const item={...itemFor(session.id),...changes};
    session.changes.set(item.id,item);
    window.AuroraShelfScene.position(buttonFor(item.id),item);
    window.AuroraEstanteExemplares.layout();
    select(item.id);
  }
  function close(){
    if(!session)return;
    if(!session.saved)for(const item of api().items()){
      const button=buttonFor(item.id);
      if(button)window.AuroraShelfScene.position(button,item);
    }
    for(const item of api().items())buttonFor(item.id)?.classList.remove('shelf-pending-removal');
    buttonFor(session.id)?.classList.remove('object-adjust-selected');
    for(const node of session.inert)node.inert=false;
    canvas.classList.remove('medidas-estante-aberta','object-adjust-open');
    canvas.style.removeProperty('--medidas-altura-parede');
    document.documentElement.classList.remove('medidas-sessao');
    canvas.scrollTop=session.scroll;
    session=null;drag=null;
    window.AuroraEstanteExemplares.layout();
  }
  function open(id){
    if(session)return;
    api().clearSelection();
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='objectAdjustDialog';dialog.setAttribute('closedby','closerequest');
      dialog.setAttribute('aria-labelledby','object-adjust-title');
      dialog.innerHTML=`
        <header class="medidas-cabecalho"><div><p>Ajustar objeto</p><h2 id="object-adjust-title"></h2></div><button class="medidas-fechar" aria-label="Fechar sem salvar">×</button></header>
        <p class="medidas-instrucao">Toque em uma foto ou objeto para selecionar. Arraste para mover.</p>
        <div class="medidas-conteudo"><div class="medidas-posicao">
          <div class="medidas-ferramentas"><div class="medidas-zoom"><button data-action="smaller" aria-label="Diminuir objeto">−</button><output></output><button data-action="larger" aria-label="Aumentar objeto">+</button></div><button data-action="rotate">↻ Girar 5°</button></div>
          <div class="medidas-camadas"><button data-orientation="vertical">Vertical</button><button data-orientation="horizontal">Horizontal</button></div>
          <div class="medidas-giro"><label for="object-yaw">Giro 3D</label><span class="object-angle"></span><input id="object-yaw" type="range" min="0" max="360" step="1"></div>
          <div class="medidas-camadas"><button data-action="front">▴ Para frente</button><button data-action="back">▾ Para trás</button></div>
          <button class="medidas-excluir" data-action="remove">Excluir da estante</button>
          <p class="object-remove-note"></p>
        </div></div><p class="medidas-status" role="status"></p>
        <footer><button class="medidas-redefinir" data-action="reset">Redefinir</button><button class="medidas-pronto" data-action="save">Pronto</button></footer>`;
      document.body.append(dialog);
      dialog.querySelector('.medidas-fechar').onclick=()=>dialog.close();
      dialog.addEventListener('close',close);
      dialog.querySelector('input').oninput=event=>preview({yaw:event.target.valueAsNumber});
      dialog.addEventListener('click',event=>{
        const button=event.target.closest('button');
        if(!button||!session)return;
        const item=itemFor(session.id),action=button.dataset.action;
        if(button.dataset.orientation)preview({orientation:button.dataset.orientation,rotation:0});
        if(action==='smaller'||action==='larger')preview({size:Math.max(44,Math.min(160,(item.size||88)+(action==='larger'?8:-8)))});
        if(action==='rotate')preview({rotation:((item.rotation||0)+5)%360});
        if(action==='front'||action==='back'){
          const layers=api().items().map(other=>itemFor(other.id)).filter(other=>other.section===item.section).map(other=>Number.isFinite(other.layer)?other.layer:4);
          preview({layer:action==='front'?Math.max(...layers)+10:Math.min(...layers)-10});
        }
        if(action==='remove'){
          if(session.removed.has(item.id))session.removed.delete(item.id);else session.removed.add(item.id);
          buttonFor(item.id)?.classList.toggle('shelf-pending-removal',session.removed.has(item.id));
          select(item.id);
        }
        if(action==='reset')preview({size:88,rotation:0,orientation:'vertical',yaw:0,layer:0});
        if(action==='save'){
          try{api().commit(session.changes,session.removed);session.saved=true;
            for(const id of session.removed)buttonFor(id)?.remove();dialog.close();}
          catch(error){dialog.querySelector('[role=status]').textContent=error.message;}
        }
      });
    }
    session={id:null,changes:new Map(),removed:new Set(),scroll:canvas.scrollTop,inert:[]};
    for(const node of document.querySelectorAll('.studio-top,.studio-actions,.editor-dock,.personal-book-row')){
      if(!node.inert){node.inert=true;session.inert.push(node);}
    }
    canvas.classList.add('medidas-estante-aberta','object-adjust-open');
    document.documentElement.classList.add('medidas-sessao');
    canvas.style.setProperty('--medidas-altura-parede',scene.offsetHeight+'px');
    dialog.querySelector('[role=status]').textContent='';
    select(id);dialog.show();
    const rect=buttonFor(id).getBoundingClientRect(),bounds=canvas.getBoundingClientRect();
    canvas.scrollTop+=rect.bottom>bounds.bottom?rect.bottom-bounds.bottom+8:Math.min(0,rect.top-bounds.top-8);
  }
  scene.addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-object-id]');
    if(!button||!event.isPrimary||event.button!==0)return;
    if(!session){
      hold={id:button.dataset.objectId,pointerId:event.pointerId,x:event.clientX,y:event.clientY,timer:setTimeout(()=>{hold=null;open(button.dataset.objectId);},500)};
      return;
    }
    event.preventDefault();event.stopImmediatePropagation();
    select(button.dataset.objectId);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,item:{...itemFor(session.id)},width:button.parentElement.clientWidth};
    canvas.setPointerCapture(event.pointerId);
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(hold&&Math.hypot(event.clientX-hold.x,event.clientY-hold.y)>4){clearTimeout(hold.timer);hold=null;}
    if(drag?.id===event.pointerId)preview({x:Math.max(0,Math.min(100,drag.item.x+(event.clientX-drag.x)/drag.width*100))});
  });
  for(const name of ['pointerup','pointercancel']){
    window.addEventListener(name,event=>{
      if(hold && hold.pointerId===event.pointerId){
        const id=hold.id;
        clearTimeout(hold.timer);hold=null;
        if(name==='pointerup'&&!session)open(id);
      }
      if(drag?.id===event.pointerId){
        if(name==='pointercancel')preview(drag.item);
        drag=null;
      }
    },true);
  }
  scene.addEventListener('click',event=>{
    const button=event.target.closest('[data-object-id]');
    if(button&&event.detail===0&&!session)open(button.dataset.objectId);
  });
  document.addEventListener('keydown',event=>{
    if(session&&event.key==='Escape'){event.preventDefault();dialog.close();}
  },true);
  window.addEventListener('resize',()=>{if(session)canvas.style.setProperty('--medidas-altura-parede',scene.offsetHeight+'px');});
  window.AuroraObjectAdjust={active:()=>Boolean(session)};
})();
