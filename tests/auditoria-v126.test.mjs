import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const enabled={skip:process.env.AURORA_BROWSER_TEST!=='1',timeout:45000};
const root=fileURLToPath(new URL('..',import.meta.url));
const origin='http://local.test';
const membership='aurora-estante-exemplares-v1:auditoria';
const filename='Caderno Boreal';
const copyName=filename+' · cópia 2';

async function chromium(t,options={}){
  const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const require=createRequire(modules?join(modules,'test.cjs'):import.meta.url);
  const browser=await require('playwright').chromium.launch({
    executablePath:process.env.AURORA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']
  });
  t.after(()=>browser.close());
  return browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,...options});
}

async function app(t){
  const page=await chromium(t,{serviceWorkers:'block',reducedMotion:'reduce'});
  page.setDefaultTimeout(10000);
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin===origin?route.fulfill({path:join(root,url.pathname)}):route.abort();
  });
  await page.addInitScript(()=>localStorage.setItem('libria-profile-v1','{"setupComplete":true}'));
  await page.goto(origin+'/index.html');
  return page;
}

async function importText(page,category,text){
  await page.locator('#importTrigger').click();
  await page.locator('#importCategory').selectOption(category);
  await page.locator('#txtFile').setInputFiles({
    name:filename+'.txt',mimeType:'text/plain',buffer:Buffer.from(text)
  });
  await page.waitForFunction(text=>Object.values(JSON.parse(localStorage.getItem('aurora-books')||'{}')).includes(text),text);
}

async function openBook(page,title){
  await page.getByRole('button',{name:new RegExp('^Abrir '+title+' em 3D')}).click();
  await page.locator('#auroraShowcase.settled').waitFor();
}

test('duas importações TXT com o mesmo nome preservam conteúdo e gênero após recarregar',enabled,async t=>{
  const page=await app(t);
  await importText(page,'romance','Texto original de um conto.');
  await importText(page,'ficcao','O outro conto tem conteúdo diferente.');
  await page.reload();
  await openBook(page,copyName);
  assert.equal(await page.locator('#auroraShowCategory').inputValue(),'ficcao');
  await page.locator('#auroraShowCategory').selectOption('adulto');
  await page.locator('#auroraShowCategoryStatus').getByText(/Gênero atualizado/).waitFor();
  const saved=await page.evaluate(()=>({
    books:JSON.parse(localStorage.getItem('aurora-books')),
    categories:JSON.parse(localStorage.getItem('aurora-txt-categories'))
  }));
  assert.equal(saved.books[filename],'Texto original de um conto.');
  assert.equal(saved.books[copyName],'O outro conto tem conteúdo diferente.');
  assert.equal(saved.categories[filename],'romance');
  assert.equal(saved.categories[copyName],'adulto');
});

async function seedShelf(page){
  await page.evaluate(async membership=>{
    const name='Livro isolado';
    await AuroraFormats.saveRecord('books',{
      id:'alvo',name,author:'Autora Teste',format:'epub',category:'romance',
      cover:AuroraFormats.createDigitalCover(name,'Autora Teste','epub'),
      coverSource:'generated',coverCheckedVersion:52,editionArtVersion:1
    });
    await AuroraFormats.saveRecord('progress',{id:'alvo',page:3});
    AuroraEstantesSalvas.save({id:'auditoria',name:'Minha estante de romances',genre:'romance',sections:1,objects:[]},true);
    localStorage.setItem(membership,JSON.stringify([{key:'arquivo:alvo',section:0}]));
  },membership);
  await page.goto(origin+'/index.html?estante=auditoria');
}

test('alterar gênero pelo visor move somente a fonte e mantém a retirada do vínculo acessível',enabled,async t=>{
  const page=await app(t);
  await seedShelf(page);
  await page.locator('#personalScene [data-personal-book-key="arquivo:alvo"]').click();
  await page.locator('#auroraShowcase.settled').waitFor();
  await page.locator('#auroraShowCategory').selectOption('ficcao');
  await page.locator('#auroraShowCategoryStatus').getByText(/Gênero atualizado/).waitFor();
  assert.equal(await page.locator('#library [data-book-id=alvo]').count(),1);
  assert.equal(await page.locator('#shelf-ficcao [data-book-id=alvo]').count(),1);
  await page.reload();
  await page.getByRole('button',{name:'Adicionar livros',exact:true}).click();
  const option=page.locator('#shelfBookPicker [data-book-key="arquivo:alvo"]');
  assert.match(await option.getAttribute('aria-label'),/^Retirar/);
  await option.click();
  await option.waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),membership),[]);
  const records=await page.evaluate(async()=>({
    book:await AuroraFormats.readRecord('books','alvo'),
    page:(await AuroraFormats.readRecord('progress','alvo')).page
  }));
  assert.equal(records.book.category,'ficcao');
  assert.equal(records.page,3);
});

test('favoritos são independentes e segurar com toque abre exclusão sem entrar no leitor',enabled,async t=>{
  const page=await app(t);
  await page.evaluate(()=>localStorage.setItem('aurora-reacoes-livros-v1','{"demo:Dom Casmurro":"love"}'));
  await openBook(page,'Dom Casmurro');
  const favorite=page.getByRole('button',{name:'Meus favoritos',exact:true});
  const like=page.getByRole('button',{name:'Gostei',exact:true});
  assert.equal(await favorite.getAttribute('aria-pressed'),'true','preserva o coração antigo');
  await like.click();
  await page.waitForFunction(()=>document.querySelector('[data-reaction=like]').getAttribute('aria-pressed')==='true');
  assert.equal(await favorite.getAttribute('aria-pressed'),'true');
  await page.reload();
  await openBook(page,'Dom Casmurro');
  assert.equal(await like.getAttribute('aria-pressed'),'true');
  assert.equal(await favorite.getAttribute('aria-pressed'),'true');
  const model=await page.locator('#book3d').boundingBox();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:model.x+model.width/2,y:model.y+model.height/2,id:1}]});
  await page.locator('.aurora-delete-options').waitFor();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await cdp.detach();
  assert.ok(await page.locator('.aurora-delete-options').isVisible());
  assert.ok(await page.locator('#auroraShowcase').isVisible());
});

test('exclusão com falha conserva livro e progresso, e uma nova tentativa limpa ambos e o vínculo',enabled,async t=>{
  const page=await app(t);
  await seedShelf(page);
  await page.locator('#personalScene [data-personal-book-key="arquivo:alvo"]').click();
  await page.locator('#auroraShowcase.settled').waitFor();
  await page.getByRole('button',{name:'Excluir livro',exact:true}).click();
  const remove=async()=>{
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('[data-remove-scope=app]').click();
  };
  await page.evaluate(key=>{
    window.originalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
      if(k===key)throw new Error('Sem espaço para salvar vínculos.');
      return originalSetItem.call(this,k,v);
    };
  },membership);
  await remove();
  await page.locator('.aurora-book-actions [role=status]').getByText(/Sem espaço/).waitFor();
  assert.equal(await page.locator('canvas.aurora-book-particles').count(),0);
  assert.ok(await page.evaluate(()=>AuroraFormats.readRecord('books','alvo')));
  assert.ok(await page.evaluate(()=>AuroraFormats.readRecord('progress','alvo')));
  await page.evaluate(()=>{Storage.prototype.setItem=originalSetItem;});
  await remove();
  await page.locator('#auroraShowcase').waitFor({state:'hidden'});
  await page.waitForFunction(async()=>!await AuroraFormats.readRecord('books','alvo'));
  assert.equal(await page.evaluate(()=>AuroraFormats.readRecord('progress','alvo')),undefined);
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),membership),[]);
});

test('primeira abertura prepara o catálogo offline e página não guardada tem aviso próprio',enabled,async t=>{
  const port=20000+Math.floor(Math.random()*10000);
  const server=spawn(process.execPath,['dev-server.mjs','--host','127.0.0.1','--port',String(port)],
    {cwd:root,stdio:['ignore','pipe','inherit']});
  t.after(()=>server.kill());
  await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw new Error('Servidor de teste indisponível.');})]);
  const page=await chromium(t);
  const base='http://127.0.0.1:'+port;
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  await page.goto(base+'/');
  await page.locator('#libriaWelcomeSkip').click();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const books=page.locator('.libria-home-book-grid button');
  const count=await books.count();
  assert.ok(count>0);
  await page.context().setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await books.count(),count);
  const response=await page.goto(base+'/nova-estante.html?nova=1');
  assert.equal(response.status(),503);
  await page.getByRole('heading',{name:'Esta página precisa de conexão'}).waitFor();
});
