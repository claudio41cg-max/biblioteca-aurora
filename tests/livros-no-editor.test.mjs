import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

// Mesmo modo de integração com Chromium usado pelo teste de navegação do EPUB.
const browserOnly={skip:process.env.AURORA_BROWSER_TEST !== '1'};
const importedKey='arquivo:epub-1';
const initialMembers=[{key:importedKey,section:1},{key:'demo:Dom Casmurro',section:0}];
const storageKey='aurora-estante-exemplares-v1:romances';

async function openEditor(t,contextOptions={},members=initialMembers){
  const directory=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const require=createRequire(directory ? join(directory,'runtime-test.cjs') : import.meta.url);
  const {chromium}=require('playwright');
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',...contextOptions});
  const page=await context.newPage();
  // O editor deve funcionar com os scripts e o acervo do aparelho.
  const origin='http://127.0.0.1';
  const root=fileURLToPath(new URL('..',import.meta.url));
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin===origin ? route.fulfill({path:join(root,url.pathname)}) : route.abort();
  });
  await page.goto(origin+'/nova-estante.html?id=romances');
  await page.evaluate(async({initialMembers,storageKey})=>{
    await AuroraFormats.saveRecord('books',{id:'epub-1',format:'epub',name:'Mar de Inverno',author:'Ana'});
    AuroraEstantesSalvas.save({id:'romances',name:'Romances',sections:2,objects:[]},true);
    localStorage.setItem(storageKey,JSON.stringify(initialMembers));
  },{initialMembers:members,storageKey});
  const sections=page.locator('#shelfScene .shelf-section');
  const sample=sections.nth(0).getByRole('button',{name:'Ajustar medidas de Dom Casmurro',exact:true});
  const imported=sections.nth(1).getByRole('button',{name:'Ajustar medidas de Mar de Inverno',exact:true});
  await page.reload();
  await sample.waitFor({state:'visible'});
  await imported.waitFor({state:'visible'});
  return {page,sections,sample,imported};
}

test('o editor mostra os exemplares vinculados e conserva as lombadas ao decorar a estante',browserOnly,async t=>{
  const {page,sections,sample,imported}=await openEditor(t);
  const original=await imported.elementHandle();
  await page.getByRole('button',{name:'Velas',exact:false}).click();
  await page.getByRole('button',{name:'Par de velas marfim'}).click();
  await sections.nth(0).locator('.shelf-object').waitFor({state:'visible'});
  assert.ok(await original.evaluate(book=>book.isConnected),'decorar a prateleira manteve a mesma lombada');
  assert.ok(await imported.isVisible());
  assert.equal(await sections.locator('[data-personal-book-key]').count(),2);

  await page.reload();
  await sample.waitFor({state:'visible'});
  await imported.waitFor({state:'visible'});
});

test('as medidas salvas pertencem ao exemplar desta estante e cancelar descarta a prévia',browserOnly,async t=>{
  const {page,imported}=await openEditor(t);
  const original={height:'original',width:'original'};
  const pocket={height:'bolso',width:'fino'};
  const otherKey='aurora-estante-exemplares-v1:outra';
  const otherMembers=[{key:importedKey,section:0}];
  await page.evaluate(({otherKey,otherMembers})=>{
    AuroraEstantesSalvas.save({id:'outra',name:'Outra estante',sections:1,objects:[]},true);
    localStorage.setItem(otherKey,JSON.stringify(otherMembers));
  },{otherKey,otherMembers});

  const stored=key=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  const size=()=>page.evaluate(key=>AuroraEstanteExemplares.getSize(key),importedKey);
  const save=values=>page.evaluate(({key,values})=>AuroraEstanteExemplares.saveSize(key,values),{key:importedKey,values});
  const dimensions=()=>imported.evaluate(book=>[book.offsetHeight,book.offsetWidth]);
  const before=await dimensions();
  assert.deepEqual(await size(),original);
  assert.deepEqual(await stored(storageKey),initialMembers,'abrir um vínculo antigo conserva o registro original');

  await save(pocket);
  const after=await dimensions();
  assert.ok(after[0]<before[0]&&after[1]<before[1],'o formato de bolso fino reduz altura e largura');
  const expected=[{...initialMembers[0],...pocket},initialMembers[1]];
  assert.deepEqual(await stored(storageKey),expected);
  await save(pocket);
  assert.deepEqual(await stored(storageKey),expected,'salvar de novo não cria outro exemplar');
  assert.deepEqual(await dimensions(),after,'salvar de novo não multiplica a escala');
  await page.reload();
  await imported.waitFor({state:'visible'});
  assert.deepEqual(await size(),pocket);
  assert.deepEqual(await dimensions(),after);

  await imported.press('Enter');
  const dialog=page.getByRole('dialog');
  await dialog.locator('input[name="height"][value="grande"]').press('Space');
  await dialog.getByRole('tab',{name:'Largura'}).click();
  await dialog.locator('input[name="width"][value="grande"]').press('Space');
  const preview=await dimensions();
  assert.ok(preview[0]>after[0]&&preview[1]>after[1],'a prévia já aparece no exemplar');
  assert.deepEqual(await stored(storageKey),expected,'a prévia não escreve na estante');
  await dialog.getByRole('button',{name:'Fechar sem salvar'}).click();
  await dialog.waitFor({state:'hidden'});
  await page.locator('#shelfScene [data-shelf-height="bolso"][data-shelf-width="fino"]').waitFor();
  assert.deepEqual(await dimensions(),after,'cancelar recupera as últimas medidas salvas');
  assert.deepEqual(await size(),pocket);
  assert.deepEqual(await stored(storageKey),expected);
  assert.deepEqual(await stored(otherKey),otherMembers,'o mesmo livro segue com suas medidas na outra estante');

  await save(original);
  assert.deepEqual(await stored(storageKey),initialMembers,'restaurar as medidas remove os dois campos opcionais');
  assert.deepEqual(await dimensions(),before);
});

test('soltar a pressão longa no celular mantém o painel aberto para escolher uma medida',browserOnly,async t=>{
  const {page,sample}=await openEditor(t,{hasTouch:true,isMobile:true});
  await sample.scrollIntoViewIfNeeded();
  const book=await sample.boundingBox();
  const point={x:book.x+book.width/2,y:book.y+book.height/2};
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  const dialog=page.getByRole('dialog');
  await dialog.waitFor({state:'visible'});
  const panel=await dialog.boundingBox();
  assert.ok(point.y<panel.y,'o dedo continua sobre a lombada, acima do painel');
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touch.detach();
  assert.ok(await dialog.isVisible(),'soltar o dedo sobre o fundo não fecha o painel recém-aberto');

  const pocket=dialog.getByRole('radio',{name:'Bolso',exact:true});
  await pocket.tap({timeout:5000});
  assert.ok(await pocket.isChecked());
  assert.equal(await sample.getAttribute('data-shelf-height'),'bolso');
  assert.ok(await dialog.isVisible());
});

test('editar a aparência conserva as medidas antigas, os demais vínculos e a leitura do exemplar',browserOnly,async t=>{
  const {page,imported}=await openEditor(t);
  const legacySize={height:'brochura',width:'medio'};
  const members=[{...initialMembers[0],...legacySize,etiqueta:'Favorito'},initialMembers[1]];
  const progress={id:'epub-1',page:17,bookmark:12};
  await page.evaluate(async({storageKey,members,progress})=>{
    localStorage.setItem(storageKey,JSON.stringify(members));
    await AuroraFormats.saveRecord('progress',progress);
  },{storageKey,members,progress});
  const bookRecord=()=>page.evaluate(()=>AuroraFormats.readRecord('books','epub-1'));
  const before=await bookRecord();
  const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  await page.reload();
  await imported.waitFor();
  assert.deepEqual(await stored(),members,'abrir um vínculo antigo conserva seus campos');

  const dialog=page.getByRole('dialog');
  const choose=label=>dialog.getByRole('button',{name:label,exact:true}).click();
  await imported.press('Enter');
  await choose('Horizontal');
  await choose('Capa');
  await choose('Girar 5°');
  assert.equal(await imported.getAttribute('data-shelf-orientation'),'horizontal');
  assert.equal(await imported.getAttribute('data-shelf-face'),'cover');
  assert.deepEqual(await stored(),members,'a prévia ainda não grava na estante');
  await dialog.press('Escape');
  await page.locator('#shelfScene [data-personal-book-key="arquivo:epub-1"]:not([data-shelf-orientation="horizontal"])').waitFor();
  assert.deepEqual(await stored(),members);

  await imported.press('Enter');
  await choose('Horizontal');
  await choose('Capa');
  await choose('Girar 5°');
  await choose('Pronto');
  await dialog.waitFor({state:'hidden'});
  const pose={orientation:'horizontal',face:'cover',angle:5};
  assert.deepEqual(await stored(),[{...members[0],pose},members[1]]);
  await page.reload();
  await imported.waitFor();
  assert.equal(await imported.getAttribute('data-shelf-orientation'),'horizontal');
  assert.equal(await imported.getAttribute('data-shelf-face'),'cover');
  assert.equal(await imported.getAttribute('data-shelf-height'),legacySize.height);

  const newSize={height:'bolso',width:'fino'};
  await page.evaluate(({key,size})=>AuroraEstanteExemplares.saveSize(key,size),{key:importedKey,size:newSize});
  const resized=[{...members[0],...newSize,pose},members[1]];
  assert.deepEqual(await stored(),resized,'a API de medidas preserva a aparência salva');
  const moved={...pose,x:.4,y:.15,layer:1};
  await page.evaluate(({key,moved})=>{
    const editor=AuroraEstanteExemplares;
    return editor.savePose(key,{...editor.getPose(key),...moved});
  },{key:importedKey,moved});
  const positioned=[{...resized[0],pose:moved},members[1]];
  assert.deepEqual(await stored(),positioned,'mover o livro preserva as medidas e a etiqueta');
  await imported.press('Enter');
  await choose('Redefinir');
  assert.deepEqual(await stored(),positioned,'redefinir também aguarda confirmação');
  await choose('Pronto');
  await dialog.waitFor({state:'hidden'});
  assert.deepEqual(await stored(),[{...initialMembers[0],etiqueta:'Favorito'},members[1]]);
  assert.deepEqual(await bookRecord(),before);
  assert.deepEqual(await page.evaluate(()=>AuroraFormats.readRecord('progress','epub-1')),progress);
});

test('a pilha acompanha a base, recarrega os apoios e rejeita referências inválidas',browserOnly,async t=>{
  const baseKey='demo:A Moreninha',middleKey='demo:Senhora',elsewhere='demo:Dom Casmurro';
  const stack=[baseKey,middleKey,importedKey];
  const members=[...stack.map(key=>({key,section:1,height:'bolso',width:'fino',pose:{orientation:'horizontal'}})),
    {key:elsewhere,section:0,pose:{orientation:'horizontal'}}];
  const {page,imported}=await openEditor(t,{},members);
  const book=key=>page.locator('#shelfScene [data-personal-book-key="'+key+'"]');
  const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  const attach=(top,base)=>page.evaluate(async({top,base})=>{
    const editor=AuroraEstanteExemplares;
    const pose=editor.stackPose(top,base);
    if(!pose)throw new Error('Os livros deitados deveriam poder formar a pilha');
    await editor.savePose(top,pose);
  },{top,base});
  const contact=async()=>{
    const [base,middle,top]=await Promise.all(stack.map(key=>book(key).boundingBox()));
    for(const [lower,upper] of [[base,middle],[middle,top]]){
      assert.ok(Math.abs(lower.y-(upper.y+upper.height))<1.1,'a base do livro toca o de baixo');
      assert.ok(Math.min(lower.x+lower.width,upper.x+upper.width)>Math.max(lower.x,upper.x),'os volumes se apoiam na horizontal');
    }
    return top.x;
  };
  await attach(middleKey,baseKey);
  await attach(importedKey,middleKey);
  const beforeX=await contact();
  await page.evaluate(async key=>{
    const editor=AuroraEstanteExemplares;
    await editor.savePose(key,{...editor.getPose(key),x:.65,y:0});
  },baseKey);
  assert.ok(Math.abs((await contact())-beforeX)>5,'mover a base desloca também o topo');
  const valid=await stored();
  assert.equal(valid.find(entry=>entry.key===middleKey).pose.stackOn,baseKey);
  assert.equal(valid.find(entry=>entry.key===importedKey).pose.stackOn,middleKey);

  const targets=await page.evaluate(key=>AuroraEstanteExemplares.stackTargets(key).map(entry=>entry.key),baseKey);
  assert.ok(![baseKey,middleKey,importedKey,elsewhere].some(key=>targets.includes(key)),'uma base não pode se apoiar em si mesma, em descendentes ou em outra seção');
  for(const invalid of [importedKey,elsewhere,'arquivo:ausente']){
    await assert.rejects(page.evaluate(({key,invalid})=>{
      const editor=AuroraEstanteExemplares;
      return editor.savePose(key,{...editor.getPose(key),stackOn:invalid});
    },{key:baseKey,invalid}));
  }
  assert.deepEqual(await stored(),valid,'uma tentativa inválida não altera a pilha anterior');
  await page.reload();
  await imported.waitFor();
  await contact();

  await page.evaluate(async key=>{
    const editor=AuroraEstanteExemplares;
    await editor.savePose(key,{...editor.getPose(key),orientation:'vertical',angle:50});
  },importedKey);
  const tilt=(await stored()).find(entry=>entry.key===importedKey).pose;
  assert.equal(tilt.angle,50);
  assert.equal(tilt.stackOn,middleKey);
  await page.reload();
  await imported.waitFor();
  assert.equal(await imported.getAttribute('data-shelf-orientation'),'vertical');
  assert.equal(await imported.getAttribute('data-shelf-stack-on'),middleKey);
  assert.equal(await imported.evaluate(el=>parseFloat(getComputedStyle(el).getPropertyValue('--pose-angle'))),50);
  await contact();

  await imported.press('Enter');
  const panel=page.getByRole('dialog');
  await panel.getByRole('button',{name:'Redefinir'}).click();
  await panel.getByRole('button',{name:'Pronto'}).click();
  await panel.waitFor({state:'hidden'});
  assert.equal(await imported.getAttribute('data-shelf-stack-on'),null);
  const restored=await stored();
  assert.equal(restored.find(entry=>entry.key===importedKey).pose?.stackOn,undefined);
  assert.deepEqual(restored.filter(entry=>entry.key!==importedKey),valid.filter(entry=>entry.key!==importedKey));

  // Referências inválidas também podem chegar por um backup antigo ou incompleto.
  const broken=structuredClone(valid);
  broken.find(entry=>entry.key===baseKey).pose.stackOn=middleKey;
  broken.find(entry=>entry.key===importedKey).pose.stackOn='arquivo:ausente';
  await page.evaluate(({storageKey,broken})=>localStorage.setItem(storageKey,JSON.stringify(broken)),{storageKey,broken});
  await page.reload();
  await imported.waitFor();
  const cyclic=(await book(baseKey).getAttribute('data-shelf-stack-on'))===middleKey &&
    (await book(middleKey).getAttribute('data-shelf-stack-on'))===baseKey;
  assert.equal(cyclic,false,'a estante não desenha um ciclo de apoios');
  assert.equal(await imported.getAttribute('data-shelf-stack-on'),null);
  assert.deepEqual(await stored(),broken,'abrir o backup não reescreve seus dados');
});

test('o giro 3D é uma prévia até confirmar e redefinir recupera a lombada anterior',browserOnly,async t=>{
  const {page,imported}=await openEditor(t);
  const dialog=page.getByRole('dialog');
  const yaw=dialog.getByRole('slider',{name:'Giro 3D'});
  const art=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');
    const panel=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);return canvas.toDataURL();};
    const faces={cover:panel('#26745a'),spine:panel('#b9834f'),back:panel('#452365')};
    const book=await AuroraFormats.readRecord('books','epub-1');
    await AuroraFormats.saveRecord('books',{...book,...faces,coverSource:'original'});
    return faces;
  });
  await page.reload();
  await imported.waitFor();
  const turn=degrees=>yaw.evaluate((slider,value)=>{
    slider.value=String(value);
    slider.dispatchEvent(new Event('input',{bubbles:true}));
  },degrees);
  const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  await imported.press('Enter');
  const volume=imported.locator(':scope > .shelf-volume');
  await turn(45);
  await volume.locator('[data-volume-face="spine"]:not([hidden])').waitFor();
  await volume.locator('[data-volume-face="cover"]:not([hidden])').waitFor();
  assert.equal(await volume.locator('[data-volume-face="spine"] img').getAttribute('src'),art.spine);
  assert.equal(await volume.locator('[data-volume-face="cover"] img').getAttribute('src'),art.cover);
  assert.equal(await imported.getAttribute('data-shelf-yaw'),'45');
  assert.deepEqual(await stored(),initialMembers);
  await dialog.press('Escape');
  await page.locator('#shelfScene [data-personal-book-key="arquivo:epub-1"]:not([data-shelf-yaw])').waitFor();

  await imported.press('Enter');
  await turn(270);
  await dialog.getByRole('button',{name:'Pronto'}).click();
  await dialog.waitFor({state:'hidden'});
  assert.equal((await stored()).find(entry=>entry.key===importedKey).pose.yaw,270);
  await page.reload();
  await imported.waitFor();
  assert.equal(await imported.getAttribute('data-shelf-yaw'),'270');
  await volume.locator('[data-volume-face="back"]:not([hidden])').waitFor();
  assert.equal(await volume.locator('[data-volume-face="back"] img').getAttribute('src'),art.back);
  await imported.press('Enter');
  assert.equal(await yaw.inputValue(),'270');
  await dialog.getByRole('button',{name:'Redefinir'}).click();
  assert.equal(await imported.getAttribute('data-shelf-yaw'),null);
  await dialog.getByRole('button',{name:'Pronto'}).click();
  await dialog.waitFor({state:'hidden'});
  assert.deepEqual(await stored(),initialMembers);
});

test('uma segunda gravação não ocupa a base que outra aba acabou de usar',browserOnly,async t=>{
  const base='demo:A Moreninha',firstSaved='demo:Senhora';
  // O concorrente vem primeiro no registro. A ordem da lista não lhe dá preferência.
  const members=[importedKey,firstSaved,base].map(key=>({key,section:1,pose:{orientation:'horizontal'}}));
  members.push(initialMembers[1]);
  const {page}=await openEditor(t,{},members);
  const other=await page.context().newPage();
  await other.goto(page.url());
  await other.locator('[data-personal-book-key="arquivo:epub-1"]').waitFor();
  const propose=(tab,key)=>tab.evaluate(({key,base})=>{
    const editor=AuroraEstanteExemplares,pose=editor.stackPose(key,base);
    if(!pose||!editor.previewPose(key,pose))throw new Error('A base deveria estar livre na prévia');
    return pose;
  },{key,base});
  const stale=await propose(page,importedKey);
  const winning=await propose(other,firstSaved);
  const save=(tab,key,pose)=>tab.evaluate(({key,pose})=>AuroraEstanteExemplares.savePose(key,pose),{key,pose});
  await save(other,firstSaved,winning);
  await page.waitForFunction(({storageKey,firstSaved,base})=>{
    const members=JSON.parse(localStorage.getItem(storageKey));
    return members.find(entry=>entry.key===firstSaved)?.pose?.stackOn===base;
  },{storageKey,firstSaved,base});
  const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  const afterFirst=await stored();
  assert.equal(afterFirst.find(entry=>entry.key===firstSaved).pose.stackOn,base);
  await assert.rejects(save(page,importedKey,stale));
  assert.deepEqual(await stored(),afterFirst,'a prévia antiga não desloca o ocupante nem altera outro vínculo');
});

test('dois livros são arrastados, encaixados e ajustados antes de uma única confirmação',browserOnly,async t=>{
  const baseKey='demo:Dom Casmurro',topKey='demo:A Moreninha';
  const members=[initialMembers[0],...[baseKey,topKey].map((key,i)=>({
    key,section:0,height:'bolso',width:'fino',pose:{orientation:'horizontal',x:i===0 ? .1 : .7,y:0}
  }))];
  const {page,sample:base}=await openEditor(t,{},members);
  const top=page.locator('#shelfScene [data-personal-book-key="'+topKey+'"]');
  const dialog=page.getByRole('dialog');
  const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  async function drag(book,dx,dy){
    const box=await book.boundingBox();
    const x=box.x+box.width/2,y=box.y+box.height/2;
    const hit=await book.evaluate((el,p)=>{
      const target=document.elementFromPoint(p.x,p.y);
      return el.contains(target) ? null : [target?.className,p,el.dataset.rawTitle];
    },{x,y});
    assert.equal(hit,null,'o exemplar está ao alcance do ponteiro: '+JSON.stringify(hit));
    await page.mouse.move(x,y);
    await page.mouse.down();
    await page.mouse.move(x+dx,y+dy,{steps:8});
    await page.mouse.up();
  }
  const turn=degrees=>dialog.getByRole('slider',{name:'Giro 3D'}).evaluate((input,degrees)=>{
    input.value=String(degrees);input.dispatchEvent(new Event('input',{bubbles:true}));
  },degrees);
  await base.press('Enter');
  await drag(base,32,0);
  await dialog.getByRole('radio',{name:'Brochura',exact:true}).check();
  const low=await base.boundingBox(),high=await top.boundingBox();
  await drag(top,(low.x+low.width/2)-(high.x+high.width/2),low.y-(high.y+high.height));
  assert.equal(await top.getAttribute('aria-pressed'),'true');
  assert.equal(await top.getAttribute('data-shelf-stack-on'),baseKey,'o segundo arrasto encaixou o topo sobre a base já movida');
  await turn(35);
  assert.deepEqual(await stored(),members,'os dois arrastos, a altura e o giro continuam em prévia');
  await dialog.getByRole('button',{name:'Pronto'}).click();
  await dialog.waitFor({state:'hidden'});
  const saved=await stored();
  const baseRecord=saved.find(entry=>entry.key===baseKey),topRecord=saved.find(entry=>entry.key===topKey);
  assert.ok(baseRecord.pose.x>.1);
  assert.equal(baseRecord.height,'brochura');
  assert.equal(topRecord.pose.stackOn,baseKey);
  assert.equal(topRecord.pose.yaw,35);
  assert.deepEqual(saved[0],initialMembers[0]);
  await page.reload();
  await top.waitFor();
  assert.equal(await top.getAttribute('data-shelf-stack-on'),baseKey);

  for(const close of ['Fechar sem salvar','Escape']){
    const atRest=await base.boundingBox();
    await base.press('Enter');
    const start=await base.boundingBox();
    await base.press('Shift+ArrowRight');
    assert.ok((await base.boundingBox()).x>start.x+4,'as setas movem o livro selecionado');
    await top.press('Enter');
    await turn(90);
    assert.equal(await top.getAttribute('data-shelf-yaw'),'90');
    assert.deepEqual(await stored(),saved);
    if(close==='Escape')await top.press('Escape');
    else await dialog.getByRole('button',{name:close}).click();
    await dialog.waitFor({state:'hidden'});
    await page.locator('#shelfScene [data-personal-book-key="'+topKey+'"][data-shelf-yaw="35"]').waitFor();
    assert.deepEqual(await stored(),saved,'cancelar descarta os dois rascunhos');
    assert.equal(await top.getAttribute('data-shelf-stack-on'),baseKey);
    assert.ok(Math.abs((await base.boundingBox()).x-atRest.x)<1,'a base voltou à posição salva');
  }
});

test('um conflito entre abas impede toda a gravação e conserva os rascunhos até cancelar',browserOnly,async t=>{
  const {page,imported}=await openEditor(t);
  const other=await page.context().newPage();
  await other.goto(page.url());
  await other.locator('[data-personal-book-key="arquivo:epub-1"]').waitFor();
  const otherBook=initialMembers[1].key;
  await page.evaluate(({first,second})=>{
    const editor=AuroraEstanteExemplares;
    editor.beginAppearanceSession();
    editor.previewSize(first,{height:'bolso',width:'fino'});
    editor.previewPose(second,{...editor.getPose(second),yaw:45});
  },{first:importedKey,second:otherBook});
  await other.evaluate(key=>{
    const editor=AuroraEstanteExemplares;
    return editor.savePose(key,{...editor.getPose(key),yaw:270});
  },otherBook);
  await page.waitForFunction(({storageKey,otherBook})=>JSON.parse(localStorage.getItem(storageKey))
    .find(book=>book.key===otherBook)?.pose?.yaw===270,{storageKey,otherBook});
  const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
  const committed=await stored();
  const result=await page.evaluate(async()=>{
    try {await AuroraEstanteExemplares.saveAppearanceSession();return null;}
    catch(error){return error.code;}
  });
  assert.equal(result,'APPEARANCE_CONFLICT');
  assert.deepEqual(await stored(),committed,'o primeiro livro do lote não foi gravado parcialmente');
  assert.equal(await imported.getAttribute('data-shelf-height'),'bolso','a falha preserva o rascunho para revisão');
  const draft=await page.evaluate(key=>AuroraEstanteExemplares.getDraftAppearance(key),otherBook);
  assert.equal(draft.pose.yaw,45);
  await page.evaluate(()=>AuroraEstanteExemplares.cancelAppearanceSession());
  assert.equal(await imported.getAttribute('data-shelf-height'),null);
  assert.deepEqual(await stored(),committed);

  // Altura e largura do mesmo exemplar podem ser alteradas independentemente.
  await page.evaluate(key=>{
    const editor=AuroraEstanteExemplares;
    editor.beginAppearanceSession();
    editor.previewSize(key,{...editor.getSize(key),height:'brochura'});
  },importedKey);
  await other.evaluate(key=>{
    const editor=AuroraEstanteExemplares;
    return editor.saveSize(key,{...editor.getSize(key),width:'grande'});
  },importedKey);
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key))[0].width==='grande',storageKey);
  await page.evaluate(()=>AuroraEstanteExemplares.saveAppearanceSession());
  assert.deepEqual(await stored(),[{...committed[0],height:'brochura',width:'grande'},committed[1]]);
});
