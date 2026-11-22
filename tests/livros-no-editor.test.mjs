import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

// Mesmo modo de integração com Chromium usado pelo teste de navegação do EPUB.
test('o editor mostra os exemplares vinculados e conserva as lombadas ao decorar a estante', {
  skip:process.env.AURORA_BROWSER_TEST !== '1'
}, async t => {
  const directory=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const require=createRequire(directory ? join(directory,'runtime-test.cjs') : import.meta.url);
  const {chromium}=require('playwright');
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  // O editor deve funcionar com os scripts e o acervo do aparelho.
  const origin='http://127.0.0.1';
  const root=fileURLToPath(new URL('..',import.meta.url));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin===origin ? route.fulfill({path:join(root,url.pathname)}) : route.abort();
  });
  await page.goto(origin+'/nova-estante.html?id=romances');
  await page.evaluate(async()=>{
    await AuroraFormats.saveRecord('books',{id:'epub-1',format:'epub',name:'Mar de Inverno',author:'Ana'});
    AuroraEstantesSalvas.save({id:'romances',name:'Romances',sections:2,objects:[]},true);
    localStorage.setItem('aurora-estante-exemplares-v1:romances',JSON.stringify([
      {key:'arquivo:epub-1',section:1},{key:'demo:Dom Casmurro',section:0}
    ]));
  });
  const sections=page.locator('#shelfScene .shelf-section');
  const sample=sections.nth(0).getByRole('img',{name:'Dom Casmurro',exact:true});
  const imported=sections.nth(1).getByRole('img',{name:'Mar de Inverno',exact:true});
  await page.reload();
  await sample.waitFor({state:'visible'});
  await imported.waitFor({state:'visible'});
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
