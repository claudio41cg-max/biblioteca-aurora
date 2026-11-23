(() => {
  const savedShelves=window.AuroraEstantesSalvas;
  const params=new URLSearchParams(location.search);
  const isNew=params.get('nova')==='1';
  const defaults={name:'Minha estante',wall:'tijolos',wallTone:'noite',wood:'nogueira',shelfTone:'natural',theme:'',light:85,sections:1,showHelp:true,objects:[]};
  const makeId=()=>crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  let shelves=[];
  try{shelves=savedShelves.read();}catch{/* O aviso de gravação permanece visível no editor. */}
  const requestedId=params.get('id');
  const found=isNew?null:requestedId?shelves.find(item=>item?.id===requestedId):shelves.at(-1);
  const shelfId=found?.id||(!isNew&&requestedId)||makeId();
  if(isNew||!requestedId)window.history.replaceState(null,'',location.pathname+'?id='+encodeURIComponent(shelfId));
  let state={...defaults,...found,id:shelfId,published:found?.published===true};
  state.sections=Math.max(0,Math.min(8,Math.trunc(Number(state.sections)||0)));
  if(!Array.isArray(state.objects))state.objects=[];
  state.wall=({charcoal:'tijolos',navy:'ripas',botanical:'botanico',stone:'reboco',cream:'original'}[state.wall]||state.wall);
  state.wood=({oak:'carvalho',walnut:'nogueira',mahogany:'mogno',black:'metal',white:'marmore'}[state.wood]||state.wood);
  let history=[];
  let activeTool='tema',targetSection=0,selectedObjectId=null;
  let toastTimer;
  const $=id=>document.getElementById(id);
  const canvas=$('canvas'),scene=$('shelfScene'),tray=$('toolTray'),nav=$('toolNav');
  const sizeControls=document.createElement('div');
  sizeControls.className='object-size-controls';
  sizeControls.setAttribute('role','group');
  const sizeActions=[['smaller','Diminuir','−'],['larger','Aumentar','+']];
  for(const [action,,symbol] of sizeActions){
    const button=document.createElement('button');
    button.type='button';button.dataset.resize=action;button.textContent=symbol;
    sizeControls.append(button);
  }
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
    flores:[
      {name:'Jiboia luxuosa',src:'./assets/customizador/folhagem-pendente.png'},
      {name:'Vaso de rosas',src:'./assets/customizador/rosas.webp'},
      {name:'Hortênsias',src:'./assets/customizador/hortensias.webp'}
    ],
    vasos:[
      {name:'Vaso marfim com jiboia',src:'./assets/customizador/folhagem-pendente.png'},
      {name:'Costela-de-adão',src:'./assets/customizador/costela-de-adao.webp'},
      {name:'Vaso de folhas secas',src:'./assets/customizador/palmeiras-secas.webp'}
    ],
    velas:[
      {name:'Par de velas marfim',src:'./assets/customizador/velas-marfim.png'},
      {name:'Velas na bandeja dourada',src:'./assets/customizador/velas-bandeja.webp'}
    ],
    decoracao:[
      {name:'Globo vintage',src:'./assets/customizador/globo-antigo.png'},
      {name:'Gato de bronze',src:'./assets/customizador/gato-de-bronze.webp'},
      {name:'Busto clássico',src:'./assets/customizador/busto-classico.webp'},
      {name:'Corações dourados',src:'./assets/customizador/coracoes-dourados.webp'},
      {name:'Aquário',src:'./assets/customizador/aquario.webp'},
      {name:'Abajur de latão',src:'./assets/customizador/abajur.webp'},
      {name:'Abóbora',src:'./assets/customizador/abobora.webp'}
    ]
  };
  const palettes={
    tema:[
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
  function save(publish=false){
    const status=$('dockStatus');
    try{
      const entry=savedShelves.save(state,publish);
      state.published=entry.published;
      if(entry.published)state.publishedAt=entry.publishedAt;
      status.textContent=entry.published?'Alterações salvas neste aparelho':'Rascunho salvo neste aparelho';
      return true;
    }catch(error){
      status.textContent=error.name==='QuotaExceededError'
        ?'Armazenamento cheio. Remova uma foto da estante e tente salvar novamente.'
        :'Não foi possível salvar neste aparelho. Tente novamente antes de sair.';
      return false;
    }
  }
  function finish(chooseBooks=false){
    if(!save(true)){notify($('dockStatus').textContent);return;}
    const url=new URL('./index.html',location.href);
    url.searchParams.set('estante',shelfId);
    if(chooseBooks)url.searchParams.set('livros','1');
    location.assign(url.href);
  }
  function remember(){history.push(JSON.stringify(state));if(history.length>25)history.shift()}
  function notify(message){const el=$('canvasToast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100)}
  function nextSize(item,action){
    const size=Number(item.size)||88;
    return Math.max(44,Math.min(160,size+(action==='larger'?12:-12)));
  }
  function updateSizeControls(){
    const object=scene.querySelector('.shelf-object.selected');
    const item=state.objects.find(entry=>entry.id===selectedObjectId);
    if(!object||!item){sizeControls.remove();return;}
    if(object.nextElementSibling!==sizeControls)object.after(sizeControls);
    sizeControls.setAttribute('aria-label','Tamanho de '+item.name);
    const layer=object.parentElement.getBoundingClientRect(),box=object.getBoundingClientRect();
    const localLeft=box.left-layer.left,localRight=box.right-layer.left;
    const diameter=sizeControls.firstElementChild.offsetWidth;
    const gap=3,limit=Math.max(0,layer.width-diameter);
    const left=Math.max(0,Math.min(limit,localLeft-gap-diameter));
    const right=Math.max(0,Math.min(limit,localRight+gap));
    // Quando a peça encosta numa lateral, libere o centro para continuar arrastando.
    const overlap=left+diameter>localLeft+gap||right<localRight-gap;
    const top=box.top-layer.top,bottom=box.bottom-layer.top;
    const y=overlap?(top>=diameter+gap?top-diameter-gap:bottom+gap):(top+bottom-diameter)/2;
    sizeControls.style.setProperty('--resize-top',Math.max(0,Math.min(layer.height-diameter,y))+'px');
    for(const [index,[action,label]] of sizeActions.entries()){
      const button=sizeControls.children[index];
      button.style.left=(index===0?left:right)+'px';
      button.setAttribute('aria-label',label+' '+item.name);
      button.disabled=nextSize(item,action)===(Number(item.size)||88);
    }
  }
  function selectObject(button){
    scene.querySelector('.shelf-object.selected')?.classList.remove('selected');
    selectedObjectId=button?.dataset.objectId||null;
    button?.classList.add('selected');
    updateSizeControls();
  }
  function resizeObject(item,action){
    const size=nextSize(item,action);
    if(size===(Number(item.size)||88))return;
    remember();
    item.size=size;
    const object=scene.querySelector('.shelf-object.selected');
    if(object)window.AuroraShelfScene.position(object,item);
    window.AuroraEstanteExemplares.layout();
    updateSizeControls();
    save();
  }
  sizeControls.addEventListener('click',event=>{
    const action=event.target.closest('[data-resize]')?.dataset.resize;
    const item=state.objects.find(entry=>entry.id===selectedObjectId);
    if(item&&action)resizeObject(item,action);
  });
  new ResizeObserver(()=>{
    updateSizeControls();
    window.AuroraEstanteExemplares.layout();
  }).observe(scene);
  function paint(){
    canvas.className='shelf-canvas wall wall-'+state.wall+' wood-'+state.wood;
    document.body.dataset.wall=state.wall;
    document.body.dataset.wallTone=state.wallTone;
    document.body.dataset.shelf=state.wood;
    document.body.dataset.shelfTone=state.shelfTone;
    canvas.style.filter='brightness('+Math.max(.55,Math.min(1.18,state.light/85))+')';
    canvas.classList.toggle('has-sections',state.sections>0);
    $('shelfNameLabel').textContent=state.name;
    $('shelfSummary').textContent=state.sections+' '+(state.sections===1?'prateleira':'prateleiras')+(state.published?'':' · rascunho');
    $('canvasLight').style.opacity=Math.max(.2,Math.min(1,state.light/85));
    // As fileiras continuam no mesmo lugar, inclusive quando já foram roladas.
    while(scene.childElementCount>state.sections)scene.lastElementChild.remove();
    for(let i=0;i<state.sections;i++){
      const options={editable:true,selectedId:selectedObjectId};
      const section=scene.children[i];
      if(section)section.querySelector('.shelf-object-layer').replaceWith(window.AuroraShelfScene.objects(state.objects,i,options));
      else scene.append(window.AuroraShelfScene.section(state.objects,i,options));
    }
    window.AuroraEstanteExemplares.render(state,scene,{editor:true});
    updateSizeControls();
    $('emptyHint').hidden=state.sections===0||!state.showHelp;
    return save();
  }
  function renderNav(){nav.innerHTML='';tools.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='tool-button'+(activeTool===t.id?' active':'');b.innerHTML='<span class="tool-icon">'+t.icon+'</span><span>'+t.label+'</span>';b.addEventListener('click',()=>selectTool(t.id));nav.append(b)})}
  const frames=[
    {name:'Nogueira',light:'#c89561',mid:'#815038',dark:'#41251c',rim:31},
    {name:'Preto fosco',light:'#625e5c',mid:'#302e2e',dark:'#151415',rim:18},
    {name:'Dourado',light:'#ffedbc',mid:'#b88a44',dark:'#6f4929',rim:38},
    {name:'Marfim',light:'#fff9ed',mid:'#dbcfb7',dark:'#998871',rim:30},
    {name:'Prata',light:'#f1f5fc',mid:'#93a1b2',dark:'#444e5e',rim:24}
  ];
  function framedPhoto(frame,photo){
    const canvas=document.createElement('canvas');
    const landscape=photo && photo.naturalWidth>photo.naturalHeight;
    canvas.width=landscape?640:496;
    canvas.height=landscape?496:640;
    const {width,height}=canvas, ctx=canvas.getContext('2d');
    const bevel=ctx.createLinearGradient(0,0,width,height);
    for(const [stop,color] of [[0,frame.light],[.28,frame.mid],[.49,frame.light],[.51,frame.mid],[.82,frame.dark],[1,frame.mid]])bevel.addColorStop(stop,color);
    ctx.fillStyle=bevel;
    ctx.fillRect(0,0,width,height);
    for(const [inset,color,line] of [[2,frame.dark,4],[6,frame.light,2],[frame.rim-6,frame.dark,5],[frame.rim-2,frame.light,3]]){
      ctx.strokeStyle=color;ctx.lineWidth=line;
      ctx.strokeRect(inset,inset,width-2*inset,height-2*inset);
    }
    ctx.fillStyle=photo?'#efe8db':'#383735';
    ctx.fillRect(frame.rim,frame.rim,width-2*frame.rim,height-2*frame.rim);
    if(photo){
      const margin=frame.rim+12;
      const ratio=Math.min((width-2*margin)/photo.naturalWidth,(height-2*margin)/photo.naturalHeight);
      const w=photo.naturalWidth*ratio,h=photo.naturalHeight*ratio;
      ctx.drawImage(photo,(width-w)/2,(height-h)/2,w,h);
    }
    return canvas;
  }
  function framePicker(frame){
    const label=document.createElement('label');
    label.className='tray-card photo-tray-card frame-picker';
    const title=document.createElement('strong');
    title.textContent=frame.name;
    const input=document.createElement('input');
    input.type='file';input.accept='image/*';input.className='photo-upload-input';
    input.setAttribute('aria-label','Escolher foto para o porta-retrato '+frame.name);
    input.onchange=async()=>{
      const file=input.files[0];
      if(!file)return;
      const url=URL.createObjectURL(file);
      try{
        const photo=new Image();
        photo.src=url;
        await photo.decode();
        const src=framedPhoto(frame,photo).toDataURL('image/jpeg',.88);
        addDecor({name:'Porta-retrato '+frame.name,src,mount:'board'});
      }catch{notify('Não foi possível abrir a foto. Tente uma imagem JPG ou PNG.')}
      finally{URL.revokeObjectURL(url);input.value=''}
    };
    label.append(framedPhoto(frame),title,input);
    return label;
  }
  function addDecor(item){
    if(!state.sections){notify('Adicione uma prateleira antes de colocar um objeto');selectTool('secao');return}
    remember();const section=Math.max(0,Math.min(state.sections-1,targetSection));
    const count=state.objects.filter(entry=>entry.section===section).length;
    const object={id:makeId(),name:item.name,src:item.src,mount:item.mount||(activeTool==='foto'?'wall':'board'),section,x:Math.min(70,58+count*10),bottom:0,size:88,rotation:0};
    state.objects.push(object);selectedObjectId=object.id;const saved=paint();renderTray();notify(saved?item.name+' colocado na estante':$('dockStatus').textContent);
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
      tray.append(...frames.map(framePicker));
      const label=document.createElement('label');label.className='tray-card photo-tray-card';label.innerHTML='<span class="swatch">▧</span><strong>Escolher foto</strong>';
      const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.className='photo-upload-input';input.setAttribute('aria-label','Escolher uma imagem para a estante');
      input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;if(file.size>900000){notify('Escolha uma imagem de até 900 KB');input.value='';return}const reader=new FileReader();reader.onload=()=>addDecor({name:file.name.replace(/\.[^.]+$/,'').slice(0,36)||'Minha foto',src:String(reader.result)});reader.onerror=()=>notify('Não foi possível abrir essa imagem');reader.readAsDataURL(file)});
      label.append(input);tray.append(label);
    }
    if(!state.sections){const hint=document.createElement('span');hint.className='tray-help';hint.textContent='Crie uma prateleira primeiro na ferramenta “Adicionar seção”.';tray.append(hint)}
  }
  function renderTray(){
    const split=activeTool==='madeira'||activeTool==='fundo';
    const same=tray.dataset.tool===activeTool;
    const offsets=same?Array.from(tray.children,row=>row.scrollLeft):[];
    tray.replaceChildren();
    tray.dataset.tool=activeTool;
    tray.classList.toggle('stacked-palette',split);
    const materialRow=split?document.createElement('div'):tray;
    const toneRow=split?document.createElement('div'):tray;
    if(split){
      materialRow.className='material-options';toneRow.className='tone-options';
      for(const [row,name] of [[materialRow,'Materiais'],[toneRow,'Tons']]){
        row.setAttribute('role','group');row.setAttribute('aria-label',name);tray.append(row);
      }
    }
    const items=palettes[activeTool];
    if(items){
      items.forEach(([label,value,style,themeWood,themeWallTone,themeShelfTone])=>{
        const b=document.createElement('button');b.type='button';
        const selected=activeTool==='madeira'?state.wood===value:activeTool==='tema'?state.wall===value&&state.wood===themeWood:state.wall===value;
        b.className='tray-card material-card'+(selected?' active':'');
        b.setAttribute('aria-pressed',String(selected));
        const swatch=document.createElement('span');
        swatch.className='swatch';
        swatch.setAttribute('aria-hidden','true');
        if(activeTool==='tema'){
          swatch.classList.add('shelf-material-sample');
          Object.assign(swatch.dataset,{wall:value,wallTone:themeWallTone,shelf:themeWood,shelfTone:themeShelfTone});
        }else{
          swatch.style.backgroundImage=style;
        }
        const title=document.createElement('strong');
        title.textContent=label;
        b.append(swatch,title);
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
        materialRow.append(b)
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
        b.setAttribute('aria-pressed',String(state[toneKey]===value));
        b.innerHTML='<span class="tone-swatch" style="--tone:'+color+'"></span><strong>'+label+'</strong>';
        b.addEventListener('click',()=>{remember();state[toneKey]=value;paint();renderTray();notify(activeTool==='fundo'?'Tom da parede aplicado':'Tom do material aplicado')});
        toneRow.append(b)
      });
      if(split){materialRow.scrollLeft=offsets[0]||0;toneRow.scrollLeft=offsets[1]||0}
    }
    else if(activeTool==='secao'){const b=document.createElement('button');b.type='button';b.className='tray-card';b.innerHTML='<span class="swatch" style="display:grid;place-items:center;font-size:26px;color:#e5bb7d">＋</span><strong>Adicionar prateleira</strong>';b.addEventListener('click',()=>{remember();if(state.sections<8){state.sections++;targetSection=state.sections-1;paint();notify('Prateleira adicionada')}else notify('Limite de 8 prateleiras atingido')});tray.append(b);if(state.sections>0){const r=document.createElement('button');r.type='button';r.className='tray-card';r.innerHTML='<span class="swatch" style="display:grid;place-items:center;font-size:24px;color:#df9c89">−</span><strong>Remover última</strong>';r.addEventListener('click',()=>{remember();state.sections=Math.max(0,state.sections-1);state.objects.forEach(item=>item.section=Math.min(item.section,Math.max(0,state.sections-1)));targetSection=Math.max(0,Math.min(targetSection,Math.max(0,state.sections-1)));paint();renderTray();notify('Prateleira removida')});tray.append(r)}}
    else if(activeTool==='luz'){const c=document.createElement('label');c.className='tray-card';c.innerHTML='<span class="swatch" style="background:radial-gradient(circle,#ffdc9a,#9c7140 32%,#30261e)">✦</span><strong>Brilho do ambiente</strong>';const range=document.createElement('input');range.type='range';range.min='35';range.max='120';range.value=state.light;range.setAttribute('aria-label','Brilho do ambiente');range.style.width='72px';range.addEventListener('input',()=>{state.light=+range.value;paint()});c.append(range);tray.append(c)}
    else if(['flores','vasos','velas','decoracao','foto'].includes(activeTool))renderDecorTray();
    else if(activeTool==='camadas'){const b=document.createElement('button');b.type='button';b.className='tray-card';b.innerHTML='<span class="swatch" style="display:grid;place-items:center;color:#e4bd7c;font-size:22px">☷</span><strong>Ver camadas</strong>';b.addEventListener('click',showLayers);tray.append(b)}
    else if(activeTool==='livro'){
      const button=document.createElement('button');
      button.type='button';button.className='tray-card';
      button.textContent=state.published?'Salvar e escolher livros':'Concluir e escolher livros';
      button.addEventListener('click',()=>finish(true));tray.append(button);
    }
  }
  function selectTool(id){activeTool=id;renderNav();renderTray();if(id==='secao')notify('Adicione prateleiras à sua nova estante');if(id==='camadas')showLayers()}
  function showLayers(){
    const content=$('layersContent');
    const rows=[['Fundo',labelFor(state.wall)],['Madeira',labelFor(state.wood)],['Prateleiras',String(state.sections)],['Iluminação',state.light+'%'],['Tom da parede',labelFor(state.wallTone)],['Tom do acabamento',labelFor(state.shelfTone)]];
    content.innerHTML=rows.map(([a,b])=>'<div class="layer-row"><span>'+a+'</span><strong>'+b+'</strong></div>').join('');
    const toolbar=document.createElement('div');toolbar.className='object-layer-tools';
    const selected=state.objects.find(item=>item.id===selectedObjectId);
    const name=document.createElement('strong');name.textContent=selected?selected.name:'Selecione uma peça na lista';toolbar.append(name);
    [['smaller','Diminuir'],['larger','Aumentar'],['rotate','Girar 5°'],['remove','Excluir']].forEach(([action,label])=>{const button=document.createElement('button');button.type='button';button.dataset.objectAction=action;button.textContent=label;button.disabled=!selected||((action==='smaller'||action==='larger')&&nextSize(selected,action)===(Number(selected.size)||88));toolbar.append(button)});
    content.append(toolbar);
    const bookHeading=document.createElement('h3');bookHeading.textContent='Livros';content.append(bookHeading);
    const books=window.AuroraEstanteExemplares.listBooks();
    if(!books.length){const empty=document.createElement('p');empty.textContent='Nenhum livro nesta estante.';content.append(empty);}
    for(const book of books){
      const row=document.createElement('div');row.className='layer-object-row layer-book-row';
      if(book.cover){const image=document.createElement('img');image.src=book.cover;image.alt='';row.append(image);}
      const choose=document.createElement('button');choose.type='button';choose.className='layer-object-select';
      choose.textContent=book.title+' · prateleira '+(book.section+1);choose.dataset.editBook=book.key;
      choose.setAttribute('aria-label','Ajustar '+book.title);choose.disabled=!book.available;
      const remove=document.createElement('button');remove.type='button';remove.dataset.removeBook=book.key;remove.textContent='Excluir';
      remove.setAttribute('aria-label','Excluir '+book.title+' da estante');row.append(choose,remove);content.append(row);
    }
    const objectHeading=document.createElement('h3');objectHeading.textContent='Objetos e fotos';content.append(objectHeading);
    state.objects.forEach(item=>{const row=document.createElement('div');row.className='layer-object-row';row.dataset.objectRow=item.id;
      const image=document.createElement('img');image.src=item.src;image.alt='';const choose=document.createElement('button');choose.type='button';choose.className='layer-object-select';choose.textContent=item.name+' · prateleira '+(item.section+1);
      const remove=document.createElement('button');remove.type='button';remove.dataset.removeObject=item.id;remove.setAttribute('aria-label','Excluir '+item.name+' da estante');remove.textContent='Excluir';row.append(image,choose,remove);content.append(row);
    });
    if(!content.dataset.bound){content.dataset.bound='true';content.addEventListener('click',async event=>{
      const editBook=event.target.closest('[data-edit-book]');
      if(editBook){$('layersDialog').close();window.AuroraBookAdjust.open(editBook.dataset.editBook);return;}
      const removeBook=event.target.closest('[data-remove-book]');
      if(removeBook){
        removeBook.disabled=true;
        try{await window.AuroraEstanteExemplares.removeBook(removeBook.dataset.removeBook);showLayers();notify('Livro excluído da estante. O arquivo permanece no acervo.');}
        catch(error){removeBook.disabled=false;notify(error.message);}
        return;
      }
      const row=event.target.closest('[data-object-row]');
      if(event.target.closest('[data-remove-object]')){remember();state.objects=state.objects.filter(item=>item.id!==event.target.closest('[data-remove-object]').dataset.removeObject);selectedObjectId=null;paint();showLayers();return}
      if(row){selectedObjectId=row.dataset.objectRow;paint();showLayers();return}
      const action=event.target.closest('[data-object-action]')?.dataset.objectAction;
      const item=state.objects.find(entry=>entry.id===selectedObjectId);if(!action||!item)return;
      if(action==='smaller'||action==='larger'){resizeObject(item,action);showLayers();return}
      remember();
      if(action==='remove'){state.objects=state.objects.filter(entry=>entry.id!==item.id);selectedObjectId=null}
      else if(action==='rotate')item.rotation=(item.rotation+5)%360;
      paint();showLayers();
    })}
    if(!$('layersDialog').open)$('layersDialog').showModal();
  }
  document.addEventListener('aurora:shelf-books-changed',()=>{if($('layersDialog').open)showLayers();});
  function labelFor(v){return ({noite:'Noite',azul:'Azul',verde:'Verde',petroleo:'Petróleo',lilas:'Lilás',rosa:'Rosa',calor:'Âmbar',natural:'Natural',tijolos:'Tijolos escuros',ripas:'Madeira ripada',reboco:'Reboco vintage',botanico:'Botânico',rose:'Rosé clássico',original:'Original',nogueira:'Nogueira',carvalho:'Carvalho claro',mogno:'Mogno',marmore:'Mármore',metal:'Metal escovado'})[v]||v}
  $('shelfNameButton').addEventListener('click',()=>{$('shelfNameInput').value=state.name;$('nameDialog').showModal()});
  $('saveShelfName').addEventListener('click',e=>{e.preventDefault();state.name=$('shelfNameInput').value.trim()||'Minha estante';const saved=paint();$('nameDialog').close();notify(saved?'Nome da estante salvo':$('dockStatus').textContent)});
  $('editorSettingsButton').addEventListener('click',()=>{$('lightRange').value=state.light;$('helpToggle').checked=state.showHelp;$('settingsDialog').showModal()});
  $('lightRange').addEventListener('input',e=>{state.light=+e.target.value;paint()});
  $('helpToggle').addEventListener('change',e=>{state.showHelp=e.target.checked;$('emptyHint').hidden=!state.showHelp||state.sections===0;save()});
  $('resetShelf').addEventListener('click',e=>{e.preventDefault();remember();state={...defaults,objects:[],id:shelfId,published:state.published};paint();renderTray();$('settingsDialog').close();notify('Prévia reiniciada')});
  $('importBooksButton').addEventListener('click',()=>selectTool('livro'));
  $('finishButton').addEventListener('click',()=>finish());
  $('undoButton').addEventListener('click',()=>{if(!history.length){notify('Nada para desfazer ainda');return}state=JSON.parse(history.pop());paint();renderTray();notify('Última mudança desfeita')});
  scene.addEventListener('click',event=>{
    const object=event.target.closest('[data-object-id]');
    if(object && !window.AuroraObjectAdjust?.active())selectObject(object);
  });
  scene.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!selectedObjectId)return;
    scene.querySelector('.shelf-object.selected')?.focus({preventScroll:true});
    selectObject(null);
  });
  scene.addEventListener('pointerdown',event=>{
    if(window.AuroraObjectAdjust?.active())return;
    if(!event.isPrimary||event.button!==0||sizeControls.contains(event.target))return;
    const button=event.target.closest('[data-object-id]');
    selectObject(button);
    if(!button)return;
    const item=state.objects.find(entry=>entry.id===button.dataset.objectId),layer=button.closest('.shelf-object-layer');if(!item||!layer)return;
    event.preventDefault();
    scene.setPointerCapture(event.pointerId);
    const position={...item};
    const start=layer.getBoundingClientRect();
    const grabX=event.clientX-start.left-button.offsetLeft;
    const grabFromBase=start.bottom-event.clientY-(window.AuroraShelfScene.onBoard(item)?0:button.offsetParent.clientHeight-button.offsetTop-button.offsetHeight);
    let moving=false;
    const move=moveEvent=>{
      if(window.AuroraObjectAdjust?.active())return;
      if(moveEvent.pointerId!==event.pointerId)return;
      if(!moving){
        if(Math.hypot(moveEvent.clientX-event.clientX,moveEvent.clientY-event.clientY)<4)return;
        moving=true;sizeControls.hidden=true;
      }
      const section=document.elementFromPoint(moveEvent.clientX,moveEvent.clientY)?.closest('.shelf-section');
      const nextLayer=section&&scene.contains(section)?section.querySelector('.shelf-object-layer'):button.parentElement;
      if(nextLayer!==button.parentElement)nextLayer.append(button);
      const rect=nextLayer.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      position.section=Number(nextLayer.dataset.section);
      position.x=Math.max(0,Math.min(rect.width-button.offsetWidth,moveEvent.clientX-rect.left-grabX))/rect.width*100;
      position.bottom=window.AuroraShelfScene.onBoard(item)?0:
        Math.max(0,Math.min(rect.height-button.offsetHeight,rect.bottom-moveEvent.clientY-grabFromBase))/rect.height*100;
      window.AuroraShelfScene.position(button,position);
      window.AuroraEstanteExemplares.layout();
    };
    const up=endEvent=>{
      if(endEvent.pointerId!==event.pointerId)return;
      scene.removeEventListener('pointermove',move);
      scene.removeEventListener('pointerup',up);
      scene.removeEventListener('pointercancel',up);
      sizeControls.hidden=false;
      if(window.AuroraObjectAdjust?.active()||!moving)return;
      if(endEvent.type==='pointerup'&&(position.section!==item.section||position.x!==item.x||position.bottom!==item.bottom)){
        remember();
        Object.assign(item,{section:position.section,x:position.x,bottom:position.bottom});
      }
      paint();
    };
    scene.addEventListener('pointermove',move);
    scene.addEventListener('pointerup',up);
    scene.addEventListener('pointercancel',up);
  });
  $('shelfNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('saveShelfName').click()}});
    paint();renderNav();renderTray();
  window.AuroraObjectEditor={
    items:()=>state.objects,
    commit(changes,removed=new Set()){
      const previous=state.objects;
      state.objects=state.objects.filter(item=>!removed.has(item.id)).map(item=>changes.has(item.id)?{...item,...changes.get(item.id)}:item);
      if(!save()){state.objects=previous;throw new Error('Não foi possível salvar. Tente novamente.');}
      history.push(JSON.stringify({...state,objects:previous}));
    },
    clearSelection:()=>selectObject(null)
  };
})();
