(() => {
  const KEY='aurora-nova-estante-v1';
  const LIST_KEY='aurora-estantes-personalizadas-v1';
  const params=new URLSearchParams(location.search);
  const isNew=params.get('nova')==='1';
  const defaults={name:'Minha estante',wall:'tijolos',wallTone:'noite',wood:'nogueira',shelfTone:'natural',theme:'',light:85,sections:1,showHelp:true,objects:[]};
  const readShelves=()=>{try{return JSON.parse(localStorage.getItem(LIST_KEY)||'[]')}catch(_){return []}};
  const makeId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const shelves=readShelves();
  const shelfId=params.get('id')||(isNew?makeId():(shelves[shelves.length-1]?.id||makeId()));
  if(isNew)window.history.replaceState(null,'',location.pathname+'?id='+encodeURIComponent(shelfId));
  const found=shelves.find(item=>item.id===shelfId);
  let state={...defaults,...(!isNew?(found||(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||{}}catch(_){return {}}})()):{}),id:shelfId};
  if(!Array.isArray(state.objects))state.objects=[];
  state.wall=({charcoal:'tijolos',navy:'ripas',botanical:'botanico',stone:'reboco',cream:'original'}[state.wall]||state.wall);
  state.wood=({oak:'carvalho',walnut:'nogueira',mahogany:'mogno',black:'metal',white:'marmore'}[state.wood]||state.wood);
  let history=[];
  let activeTool='tema',targetSection=0,selectedObjectId=null;
  let toastTimer;
  const $=id=>document.getElementById(id);
  const canvas=$('canvas'),scene=$('shelfScene'),tray=$('toolTray'),nav=$('toolNav');
  const tools=[
    {id:'tema',label:'Estantes',icon:'▤'},
    {id:'fundo',label:'Fundo',icon:'▧'},
    {id:'madeira',label:'Madeira',icon:'▤'},
    {id:'flores',label:'Flores',icon:'❀'},
    {id:'vasos',label:'Vasos',icon:'♧'},
    {id:'velas',label:'Velas',icon:'♨'},
    {id:'decoracao',label:'Decoração',icon:'✧'},
    {id:'foto',label:'Foto',icon:'▧'},
    {id:'luz',label:'Iluminação',icon:'✧'},
    {id:'secao',label:'Adicionar seção',icon:'⊞'},
    {id:'camadas',label:'Camadas',icon:'▱'},
    {id:'livro',label:'Livro',icon:'▣'}
  ];
  const decorItems={
    flores:[{name:'Jiboia luxuosa',src:'./assets/customizador/folhagem-pendente.png'}],
    vasos:[{name:'Vaso marfim com jiboia',src:'./assets/customizador/folhagem-pendente.png'}],
    velas:[{name:'Par de velas marfim',src:'./assets/customizador/velas-marfim.png'}],
    decoracao:[{name:'Globo vintage',src:'./assets/customizador/globo-antigo.png'}]
  };
  const palettes={
    theme:[
      ['Noite aconchegante','tijolos','url("./assets/ambientes/parede-0.webp")','nogueira','noite','natural'],
      ['Madeira ripada','ripas','url("./assets/ambientes/parede-1.webp")','carvalho','noite','natural'],
      ['Botânico','botanico','url("./assets/ambientes/parede-3.webp")','mogno','verde','calor'],
      ['Rosé clássico','rose','url("./assets/ambientes/parede-4.webp")','mogno','rosa','natural'],
      ['Aurora original','original','linear-gradient(145deg,#21443b,#111b19)','original','noite','natural']
    ],
    fundo:[
      ['Tijolos escuros','tijolos','url("./assets/ambientes/parede-0.webp")'],
      ['Madeira ripada','ripas','url("./assets/ambientes/parede-1.webp")'],
      ['Reboco vintage','reboco','url("./assets/ambientes/parede-2.webp")'],
      ['Botânico','botanico','url("./assets/ambientes/parede-3.webp")'],
      ['Rosé clássico','rose','url("./assets/ambientes/parede-4.webp")'],
      ['Aurora original','original','linear-gradient(145deg,#21443b,#111b19)']
    ],
    madeira:[
      ['Nogueira','nogueira','url("./assets/ambientes/prateleira-0.webp")'],
      ['Carvalho claro','carvalho','url("./assets/ambientes/prateleira-1.webp")'],
      ['Mogno','mogno','url("./assets/ambientes/prateleira-2.webp")'],
      ['Mármore','marmore','url("./assets/ambientes/prateleira-3.webp")'],
      ['Metal escovado','metal','url("./assets/ambientes/prateleira-4.webp")'],
      ['Original','original','url("./assets/prateleira-romances.webp")']
    ]
  };
  function save(){try{
    state.id=shelfId;
    localStorage.setItem(KEY,JSON.stringify(state));
    const list=readShelves(), index=list.findIndex(item=>item.id===shelfId), entry={...state,updatedAt:Date.now()};
    if(index>=0)list[index]=entry;else list.push(entry);
    localStorage.setItem(LIST_KEY,JSON.stringify(list));
  }catch(_){}}
  function remember(){history.push(JSON.stringify(state));if(history.length>25)history.shift()}
  function notify(message){const el=$('canvasToast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100)}
  function paint(){
    canvas.className='shelf-canvas wall wall-'+state.wall+' wood-'+state.wood;
    document.body.dataset.wall=state.wall;
    document.body.dataset.wallTone=state.wallTone;
    document.body.dataset.shelf=state.wood;
    document.body.dataset.shelfTone=state.shelfTone;
    canvas.style.filter='brightness('+Math.max(.55,Math.min(1.18,state.light/85))+')';
    canvas.classList.toggle('has-sections',state.sections>0);
    $('shelfNameLabel').textContent=state.name;
    $('shelfSummary').textContent=state.sections+' '+(state.sections===1?'prateleira':'prateleiras')+' · em branco';
    $('canvasLight').style.opacity=Math.max(.2,Math.min(1,state.light/85));
    scene.replaceChildren();
    for(let i=0;i<state.sections;i++){
      const section=document.createElement('div');section.className='shelf-section';section.setAttribute('aria-label','Prateleira '+(i+1));
      const objectLayer=document.createElement('div');objectLayer.className='shelf-object-layer';objectLayer.dataset.section=String(i);
      state.objects.filter(item=>item.section===i).forEach(item=>{
        const object=document.createElement('button');object.type='button';object.className='shelf-object'+(selectedObjectId===item.id?' selected':'');object.dataset.objectId=item.id;object.setAttribute('aria-label',item.name+' na prateleira '+(i+1)+'. Arraste para reposicionar.');
        object.style.left=item.x+'%';object.style.bottom=item.bottom+'%';object.style.setProperty('--object-size',item.size+'px');object.style.setProperty('--object-rotation',item.rotation+'deg');
        const image=document.createElement('img');image.src=item.src;image.alt=item.name;image.draggable=false;object.append(image);objectLayer.append(object);
      });
      const board=document.createElement('div');board.className='shelf-board';section.append(objectLayer,board);scene.append(section)
    }
    $('emptyHint').hidden=state.sections===0||!state.showHelp;
    save();
  }
  function renderNav(){nav.innerHTML='';tools.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='tool-button'+(activeTool===t.id?' active':'');b.innerHTML='<span class="tool-icon">'+t.icon+'</span><span>'+t.label+'</span>';b.addEventListener('click',()=>selectTool(t.id));nav.append(b)})}
  function addDecor(item){
    if(!state.sections){notify('Adicione uma prateleira antes de colocar um objeto');selectTool('secao');return}
    remember();const section=Math.max(0,Math.min(state.sections-1,targetSection));
    const count=state.objects.filter(entry=>entry.section===section).length;
    const object={id:makeId(),name:item.name,src:item.src,section,x:Math.min(70,58+count*10),bottom:0,size:88,rotation:0};
    state.objects.push(object);selectedObjectId=object.id;paint();renderTray();notify(item.name+' colocado na estante');
  }
  function renderDecorTray(){
    targetSection=Math.max(0,Math.min(Math.max(0,state.sections-1),targetSection));
    const picker=document.createElement('label');picker.className='section-picker';picker.innerHTML='<span>Colocar na prateleira</span>';
    const select=document.createElement('select');select.setAttribute('aria-label','Escolher prateleira');
    for(let i=0;i<state.sections;i++){const option=document.createElement('option');option.value=String(i);option.textContent='Prateleira '+(i+1);if(i===targetSection)option.selected=true;select.append(option)}
    select.addEventListener('change',()=>{targetSection=Number(select.value)||0});picker.append(select);tray.append(picker);
    const items=decorItems[activeTool]||[];
    items.forEach(item=>{const button=document.createElement('button');button.type='button';button.className='tray-card decor-tray-card';const image=document.createElement('img');image.src=item.src;image.alt='';image.loading='lazy';const title=document.createElement('strong');title.textContent=item.name;button.append(image,title);button.addEventListener('click',()=>addDecor(item));tray.append(button)});
    if(activeTool==='foto'){
      const label=document.createElement('label');label.className='tray-card photo-tray-card';label.innerHTML='<span class="swatch">▧</span><strong>Escolher foto</strong>';
      const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.className='photo-upload-input';input.setAttribute('aria-label','Escolher uma imagem para a estante');
      input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;if(file.size>900000){notify('Escolha uma imagem de até 900 KB');input.value='';return}const reader=new FileReader();reader.onload=()=>addDecor({name:file.name.replace(/\.[^.]+$/,'').slice(0,36)||'Minha foto',src:String(reader.result)});reader.onerror=()=>notify('Não foi possível abrir essa imagem');reader.readAsDataURL(file)});
      label.append(input);tray.append(label);
    }
    if(!state.sections){const hint=document.createElement('span');hint.className='tray-help';hint.textContent='Crie uma prateleira primeiro na ferramenta “Adicionar seção”.';tray.append(hint)}
  }
  function renderTray(){
    tray.innerHTML='';
    const items=palettes[activeTool];
    if(items){
      items.forEach(([label,value,style,themeWood,themeWallTone,themeShelfTone])=>{
        const b=document.createElement('button');b.type='button';
        const selected=activeTool==='madeira'?state.wood===value:activeTool==='tema'?state.wall===value&&state.wood===themeWood:state.wall===value;
        b.className='tray-card'+(selected?' active':'');
        b.innerHTML='<span class="swatch" style="background:'+style+' center/cover"></span><strong>'+label+'</strong>';
        b.addEventListener('click',()=>{
          remember();
          if(activeTool==='madeira')state.wood=value;
          else{
            state.wall=value;
            if(activeTool==='tema'&&themeWood){
              state.wood=themeWood;state.wallTone=themeWallTone||'noite';state.shelfTone=themeShelfTone||'natural';
            }
          }
          paint();renderTray();
          notify(activeTool==='madeira'?'Acabamento aplicado':activeTool==='tema'?'Tema aplicado à estante':'Textura da parede aplicada')
        });
        tray.append(b)
      });
      const toneOptions=activeTool==='fundo'
        ?[['Noite','noite','#16151d'],['Azul','azul','#29448d'],['Verde','verde','#2b694d'],['Petróleo','petroleo','#28757d'],['Lilás','lilas','#71529c'],['Rosa','rosa','#c16f94'],['Âmbar','calor','#98643d']]
        :activeTool==='madeira'
        ?[['Natural','natural','linear-gradient(130deg,#b4885e,#593b2c)'],['Escuro','noite','#16151d'],['Azul','azul','#29448d'],['Verde','verde','#2b694d'],['Lilás','lilas','#71529c'],['Rosa','rosa','#c16f94'],['Âmbar','calor','#98643d']]
        :[];
      toneOptions.forEach(([label,value,color])=>{
        const b=document.createElement('button');b.type='button';
        const toneKey=activeTool==='fundo'?'wallTone':'shelfTone';
        b.className='tray-card tone-card'+(state[toneKey]===value?' active':'');
        b.innerHTML='<span class="tone-swatch" style="--tone:'+color+'"></span><strong>'+label+'</strong>';
        b.addEventListener('click',()=>{remember();state[toneKey]=value;paint();renderTray();notify(activeTool==='fundo'?'Tom da parede aplicado':'Tom do material aplicado')});
        tray.append(b)
      });
    }
    else if(activeTool==='secao'){const b=document.createElement('button');b.type='button';b.className='tray-card';b.innerHTML='<span class="swatch" style="display:grid;place-items:center;font-size:26px;color:#e5bb7d">＋</span><strong>Adicionar prateleira</strong>';b.addEventListener('click',()=>{remember();if(state.sections<8){state.sections++;targetSection=state.sections-1;paint();notify('Prateleira adicionada')}else notify('Limite de 8 prateleiras atingido')});tray.append(b);if(state.sections>0){const r=document.createElement('button');r.type='button';r.className='tray-card';r.innerHTML='<span class="swatch" style="display:grid;place-items:center;font-size:24px;color:#df9c89">−</span><strong>Remover última</strong>';r.addEventListener('click',()=>{remember();state.sections=Math.max(0,state.sections-1);state.objects.forEach(item=>item.section=Math.min(item.section,Math.max(0,state.sections-1)));targetSection=Math.max(0,Math.min(targetSection,Math.max(0,state.sections-1)));paint();renderTray();notify('Prateleira removida')});tray.append(r)}}
    else if(activeTool==='luz'){const c=document.createElement('label');c.className='tray-card';c.innerHTML='<span class="swatch" style="background:radial-gradient(circle,#ffdc9a,#9c7140 32%,#30261e)">✦</span><strong>Brilho do ambiente</strong>';const range=document.createElement('input');range.type='range';range.min='35';range.max='120';range.value=state.light;range.setAttribute('aria-label','Brilho do ambiente');range.style.width='72px';range.addEventListener('input',()=>{state.light=+range.value;paint()});c.append(range);tray.append(c)}
    else if(['flores','vasos','velas','decoracao','foto'].includes(activeTool))renderDecorTray();
    else if(activeTool==='camadas'){const b=document.createElement('button');b.type='button';b.className='tray-card';b.innerHTML='<span class="swatch" style="display:grid;place-items:center;color:#e4bd7c;font-size:22px">☷</span><strong>Ver camadas</strong>';b.addEventListener('click',showLayers);tray.append(b)}
    else {const b=document.createElement('div');b.className='tray-card';b.innerHTML='<span class="swatch" style="display:grid;place-items:center;color:#ddbd8a;font-size:21px">✦</span><strong>Na próxima etapa</strong>';tray.append(b);const p=document.createElement('span');p.style.cssText='align-self:center;color:#bbb5ab;font-size:12px;max-width:190px;line-height:1.45';p.textContent='Os livros serão colocados nesta estante depois que aprovarmos o editor.';tray.append(p)}
  }
  function selectTool(id){activeTool=id;renderNav();renderTray();if(id==='secao')notify('Adicione prateleiras à sua nova estante');if(id==='camadas')showLayers()}
  function showLayers(){
    const content=$('layersContent');
    const rows=[['Fundo',labelFor(state.wall)],['Madeira',labelFor(state.wood)],['Prateleiras',String(state.sections)],['Iluminação',state.light+'%'],['Tom da parede',labelFor(state.wallTone)],['Tom do acabamento',labelFor(state.shelfTone)]];
    content.innerHTML=rows.map(([a,b])=>'<div class="layer-row"><span>'+a+'</span><strong>'+b+'</strong></div>').join('');
    const toolbar=document.createElement('div');toolbar.className='object-layer-tools';
    const selected=state.objects.find(item=>item.id===selectedObjectId);
    const name=document.createElement('strong');name.textContent=selected?selected.name:'Selecione uma peça na lista';toolbar.append(name);
    [['smaller','Diminuir'],['larger','Aumentar'],['rotate','Girar 5°'],['remove','Remover']].forEach(([action,label])=>{const button=document.createElement('button');button.type='button';button.dataset.objectAction=action;button.textContent=label;button.disabled=!selected;toolbar.append(button)});
    content.append(toolbar);
    state.objects.forEach(item=>{const row=document.createElement('div');row.className='layer-object-row';row.dataset.objectRow=item.id;
      const image=document.createElement('img');image.src=item.src;image.alt='';const choose=document.createElement('button');choose.type='button';choose.className='layer-object-select';choose.textContent=item.name+' · prateleira '+(item.section+1);
      const remove=document.createElement('button');remove.type='button';remove.dataset.removeObject=item.id;remove.setAttribute('aria-label','Remover '+item.name);remove.textContent='×';row.append(image,choose,remove);content.append(row);
    });
    if(!content.dataset.bound){content.dataset.bound='true';content.addEventListener('click',event=>{
      const row=event.target.closest('[data-object-row]');
      if(event.target.closest('[data-remove-object]')){remember();state.objects=state.objects.filter(item=>item.id!==event.target.closest('[data-remove-object]').dataset.removeObject);selectedObjectId=null;paint();showLayers();return}
      if(row){selectedObjectId=row.dataset.objectRow;paint();showLayers();return}
      const action=event.target.closest('[data-object-action]')?.dataset.objectAction;
      const item=state.objects.find(entry=>entry.id===selectedObjectId);if(!action||!item)return;
      if(action==='remove'){remember();state.objects=state.objects.filter(entry=>entry.id!==item.id);selectedObjectId=null}
      else{remember();if(action==='larger')item.size=Math.min(160,item.size+12);if(action==='smaller')item.size=Math.max(44,item.size-12);if(action==='rotate')item.rotation=(item.rotation+5)%360}
      paint();showLayers();
    })}
    if(!$('layersDialog').open)$('layersDialog').showModal();
  }
  function labelFor(v){return ({noite:'Noite',azul:'Azul',verde:'Verde',petroleo:'Petróleo',lilas:'Lilás',rosa:'Rosa',calor:'Âmbar',natural:'Natural',tijolos:'Tijolos escuros',ripas:'Madeira ripada',reboco:'Reboco vintage',botanico:'Botânico',rose:'Rosé clássico',original:'Original',nogueira:'Nogueira',carvalho:'Carvalho claro',mogno:'Mogno',marmore:'Mármore',metal:'Metal escovado'})[v]||v}
  $('shelfNameButton').addEventListener('click',()=>{$('shelfNameInput').value=state.name;$('nameDialog').showModal()});
  $('saveShelfName').addEventListener('click',e=>{e.preventDefault();state.name=$('shelfNameInput').value.trim()||'Minha estante';paint();$('nameDialog').close();notify('Nome da estante salvo')});
  $('editorSettingsButton').addEventListener('click',()=>{$('lightRange').value=state.light;$('helpToggle').checked=state.showHelp;$('settingsDialog').showModal()});
  $('lightRange').addEventListener('input',e=>{state.light=+e.target.value;paint()});
  $('helpToggle').addEventListener('change',e=>{state.showHelp=e.target.checked;$('emptyHint').hidden=!state.showHelp||state.sections===0;save()});
  $('resetShelf').addEventListener('click',e=>{e.preventDefault();remember();state={...defaults};paint();renderTray();$('settingsDialog').close();notify('Prévia reiniciada')});
  $('importBooksButton').addEventListener('click',()=>notify('A importação de livros será ligada a esta estante na próxima etapa'));
  $('finishButton').addEventListener('click',()=>{save();notify('Estante salva e vinculada às configurações');$('dockStatus').textContent='Salva neste app · '+state.name});
  $('undoButton').addEventListener('click',()=>{if(!history.length){notify('Nada para desfazer ainda');return}state=JSON.parse(history.pop());paint();renderTray();notify('Última mudança desfeita')});
  scene.addEventListener('pointerdown',event=>{
    const button=event.target.closest('[data-object-id]');if(!button)return;
    const item=state.objects.find(entry=>entry.id===button.dataset.objectId),layer=button.closest('.shelf-object-layer');if(!item||!layer)return;
    event.preventDefault();remember();selectedObjectId=item.id;button.classList.add('selected');button.setPointerCapture(event.pointerId);
    const move=moveEvent=>{const rect=layer.getBoundingClientRect();const maxLeft=Math.max(0,100-item.size/rect.width*100);item.x=Math.max(0,Math.min(maxLeft,(moveEvent.clientX-rect.left)/rect.width*100));item.bottom=Math.max(0,Math.min(78,(rect.bottom-moveEvent.clientY)/rect.height*100));button.style.left=item.x+'%';button.style.bottom=item.bottom+'%'};
    const up=()=>{button.removeEventListener('pointermove',move);button.removeEventListener('pointerup',up);button.removeEventListener('pointercancel',up);save()};
    button.addEventListener('pointermove',move);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);
  });
  $('shelfNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('saveShelfName').click()}});
    paint();renderNav();renderTray();
})();
