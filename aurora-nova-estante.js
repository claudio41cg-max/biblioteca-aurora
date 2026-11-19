(() => {
  const KEY='aurora-nova-estante-v1';
  const LIST_KEY='aurora-estantes-personalizadas-v1';
  const params=new URLSearchParams(location.search);
  const isNew=params.get('nova')==='1';
  const defaults={name:'Minha estante',wall:'tijolos',wallTone:'noite',wood:'nogueira',shelfTone:'natural',theme:'',light:85,sections:1,showHelp:true};
  const readShelves=()=>{try{return JSON.parse(localStorage.getItem(LIST_KEY)||'[]')}catch(_){return []}};
  const makeId=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const shelves=readShelves();
  const shelfId=params.get('id')||(isNew?makeId():(shelves[shelves.length-1]?.id||makeId()));
  if(isNew)window.history.replaceState(null,'',location.pathname+'?id='+encodeURIComponent(shelfId));
  const found=shelves.find(item=>item.id===shelfId);
  let state={...defaults,...(!isNew?(found||(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null')||{}}catch(_){return {}}})()):{}),id:shelfId};
  state.wall=({charcoal:'tijolos',navy:'ripas',botanical:'botanico',stone:'reboco',cream:'original'}[state.wall]||state.wall);
  state.wood=({oak:'carvalho',walnut:'nogueira',mahogany:'mogno',black:'metal',white:'marmore'}[state.wood]||state.wood);
  let history=[];
  let activeTool='tema';
  let toastTimer;
  const $=id=>document.getElementById(id);
  const canvas=$('canvas'),scene=$('shelfScene'),tray=$('toolTray'),nav=$('toolNav');
  const tools=[
    {id:'tema',label:'Tema',icon:'◈'},
    {id:'fundo',label:'Fundo',icon:'▧'},
    {id:'madeira',label:'Madeira',icon:'▤'},
    {id:'luz',label:'Iluminação',icon:'✧'},
    {id:'secao',label:'Adicionar seção',icon:'⊞'},
    {id:'camadas',label:'Camadas',icon:'▱'},
    {id:'livro',label:'Livro',icon:'▣'},
    {id:'decoracao',label:'Decoração',icon:'✿'}
  ];
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
    for(let i=0;i<state.sections;i++){const section=document.createElement('div');section.className='shelf-section';section.setAttribute('aria-label','Prateleira '+(i+1));const board=document.createElement('div');board.className='shelf-board';section.append(board);scene.append(section)}
    $('emptyHint').hidden=state.sections===0||!state.showHelp;
    save();
  }
  function renderNav(){nav.innerHTML='';tools.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='tool-button'+(activeTool===t.id?' active':'');b.innerHTML='<span class="tool-icon">'+t.icon+'</span><span>'+t.label+'</span>';b.addEventListener('click',()=>selectTool(t.id));nav.append(b)})}
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
    else if(activeTool==='secao'){const b=document.createElement('button');b.type='button';b.className='tray-card';b.innerHTML='<span class="swatch" style="display:grid;place-items:center;font-size:26px;color:#e5bb7d">＋</span><strong>Adicionar prateleira</strong>';b.addEventListener('click',()=>{remember();if(state.sections<8){state.sections++;paint();notify('Prateleira adicionada')}else notify('Limite de 8 prateleiras atingido')});tray.append(b);if(state.sections>0){const r=document.createElement('button');r.type='button';r.className='tray-card';r.innerHTML='<span class="swatch" style="display:grid;place-items:center;font-size:24px;color:#df9c89">−</span><strong>Remover última</strong>';r.addEventListener('click',()=>{remember();state.sections=Math.max(0,state.sections-1);paint();notify('Prateleira removida')});tray.append(r)}}
    else if(activeTool==='luz'){const c=document.createElement('label');c.className='tray-card';c.innerHTML='<span class="swatch" style="background:radial-gradient(circle,#ffdc9a,#9c7140 32%,#30261e)">✦</span><strong>Brilho do ambiente</strong>';const range=document.createElement('input');range.type='range';range.min='35';range.max='120';range.value=state.light;range.setAttribute('aria-label','Brilho do ambiente');range.style.width='72px';range.addEventListener('input',()=>{state.light=+range.value;paint()});c.append(range);tray.append(c)}
    else if(activeTool==='camadas'){const b=document.createElement('button');b.type='button';b.className='tray-card';b.innerHTML='<span class="swatch" style="display:grid;place-items:center;color:#e4bd7c;font-size:22px">☷</span><strong>Ver camadas</strong>';b.addEventListener('click',showLayers);tray.append(b)}
    else {const b=document.createElement('div');b.className='tray-card';b.innerHTML='<span class="swatch" style="display:grid;place-items:center;color:#ddbd8a;font-size:21px">✦</span><strong>Na próxima etapa</strong>';tray.append(b);const p=document.createElement('span');p.style.cssText='align-self:center;color:#bbb5ab;font-size:12px;max-width:190px;line-height:1.45';p.textContent=activeTool==='livro'?'Os livros serão colocados nesta estante depois que aprovarmos o editor.':'Os enfeites entram na próxima etapa de montagem.';tray.append(p)}
  }
  function selectTool(id){activeTool=id;renderNav();renderTray();if(id==='secao')notify('Adicione prateleiras à sua nova estante');if(id==='camadas')showLayers()}
  function showLayers(){const rows=[['Fundo',labelFor(state.wall)],['Madeira',labelFor(state.wood)],['Prateleiras',String(state.sections)],['Iluminação',state.light+'%'],['Tom da parede',labelFor(state.wallTone)],['Tom do acabamento',labelFor(state.shelfTone)]];$('layersContent').innerHTML=rows.map(([a,b])=>'<div class="layer-row"><span>'+a+'</span><strong>'+b+'</strong></div>').join('');$('layersDialog').showModal()}
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
  $('shelfNameInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('saveShelfName').click()}});
    paint();renderNav();renderTray();
})();