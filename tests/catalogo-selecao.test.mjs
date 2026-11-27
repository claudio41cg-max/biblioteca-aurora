import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

test('catálogos por imagem e A–Z conservam gêneros, busca e adição à prateleira', {skip:process.env.AURORA_BROWSER_TEST!=='1'}, async t=>{
  const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const require=createRequire(modules?join(modules,'runtime-test.cjs'):import.meta.url);
  const {chromium}=require('playwright');
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  page.setDefaultTimeout(10000);
  const root=fileURLToPath(new URL('..',import.meta.url));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://local.test'?route.fulfill({path:join(root,url.pathname)}):route.abort();
  });
  await page.goto('http://local.test/nova-estante.html?id=catalogo');
  await page.evaluate(async()=>{
    AuroraEstantesSalvas.save({id:'catalogo',name:'Meus livros',genre:'romance',sections:2,objects:[]},true);
    // Inclui um arquivo em cada gênero, inclusive nos que não têm amostras.
    for(const category of AuroraShelf.categories){
      await AuroraFormats.saveRecord('books',{id:'teste-'+category.id,format:'epub',name:'Álbum '+category.name,author:'Autora Teste',category:category.id,
        cover:AuroraFormats.createDigitalCover('Álbum '+category.name,'Autora Teste','epub')});
    }
  });
  await page.goto('http://local.test/index.html?estante=catalogo');
  await page.locator('#library [data-book-id="teste-veterinaria"]').waitFor({state:'attached'});
  await page.getByRole('button',{name:'Adicionar livros',exact:true}).click();
  const dialog=page.locator('#shelfBookPicker');
  const visual=dialog.getByRole('button',{name:'Buscar catálogo por imagem',exact:true});
  const alphabetic=dialog.getByRole('button',{name:'Buscar catálogo de A a Z',exact:true});
  const actions=dialog.locator('button[data-book-key]');
  const allKeys=await actions.evaluateAll(buttons=>buttons.map(button=>button.dataset.bookKey).sort());
  const titles=await dialog.locator('li strong').allTextContents();
  assert.deepEqual(titles,[...titles].sort((a,b)=>a.localeCompare(b,'pt-BR')));
  await visual.tap();
  assert.equal(await visual.getAttribute('aria-pressed'),'true');
  assert.deepEqual(await actions.evaluateAll(buttons=>buttons.map(button=>button.dataset.bookKey).sort()),allKeys);
  assert.equal(await dialog.locator('.aurora-catalog-volume').count(),allKeys.length);
  assert.equal(await dialog.locator('.shelf-picker-genre h3').textContent(),'Romances');
  assert.ok(allKeys.includes('arquivo:teste-romance'));
  assert.equal(allKeys.filter(key=>key.startsWith('arquivo:teste-')).length,1);
  const original=await page.locator('#library [data-book-id="teste-romance"] .shelf-book-cover img').getAttribute('src');
  const card=dialog.locator('li:has([data-book-key="arquivo:teste-romance"])');
  assert.equal(await card.locator('.aurora-catalog-front img').getAttribute('src'),original);
  await dialog.getByPlaceholder('Título ou autor').fill('autora teste');
  assert.equal(await actions.count(),1);
  await alphabetic.tap();
  assert.equal(await actions.count(),1);
  await visual.tap();
  await dialog.getByLabel('Prateleira',{exact:true}).selectOption('1');
  await actions.first().tap();
  await dialog.getByRole('button',{name:'Retirar Álbum Romances desta estante',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('aurora-estante-exemplares-v1:catalogo'))),[{key:'arquivo:teste-romance',section:1}]);
  await alphabetic.tap();
  await actions.first().tap();
  await dialog.getByRole('button',{name:'Adicionar Álbum Romances à estante',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('aurora-estante-exemplares-v1:catalogo'))),[]);
  await dialog.getByPlaceholder('Título ou autor').fill('sem resultado impossível');
  assert.equal(await dialog.locator('.shelf-picker-empty').count(),1);
  await visual.tap();
  assert.equal(await dialog.locator('.shelf-picker-empty').count(),1);
  await dialog.getByPlaceholder('Título ou autor').fill('');
  assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'o painel cabe na largura do celular');
  if(process.env.AURORA_QA_SCREENSHOTS){
    await page.screenshot({path:process.env.AURORA_QA_SCREENSHOTS+'/catalogo-imagens.png'});
    await alphabetic.tap();
    await page.screenshot({path:process.env.AURORA_QA_SCREENSHOTS+'/catalogo-az.png'});
  }
});
