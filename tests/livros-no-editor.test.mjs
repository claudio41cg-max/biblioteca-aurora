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

async function openEditor(t,contextOptions={}){
  const directory=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const require=createRequire(directory ? join(directory,'runtime-test.cjs') : import.meta.url);
  const {chromium}=require('playwright');
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',...contextOptions});
  // O editor deve funcionar com os scripts e o acervo do aparelho.
  const origin='http://127.0.0.1';
  const root=fileURLToPath(new URL('..',import.meta.url));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin===origin ? route.fulfill({path:join(root,url.pathname)}) : route.abort();
  });
  await page.goto(origin+'/nova-estante.html?id=romances');
  await page.evaluate(async({initialMembers,storageKey})=>{
    await AuroraFormats.saveRecord('books',{id:'epub-1',format:'epub',name:'Mar de Inverno',author:'Ana'});
    AuroraEstantesSalvas.save({id:'romances',name:'Romances',sections:2,objects:[]},true);
    localStorage.setItem(storageKey,JSON.stringify(initialMembers));
  },{initialMembers,storageKey});
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
