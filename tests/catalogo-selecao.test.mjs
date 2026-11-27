import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

test('o catálogo da estante compartilha grade e paginação, abre o visor e mantém busca e vínculos', {skip:process.env.AURORA_BROWSER_TEST!=='1'}, async t=>{
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
        cover:AuroraFormats.createDigitalCover('Álbum '+category.name,'Autora Teste','epub'),coverSource:'generated',coverCheckedVersion:52,editionArtVersion:1});
    }
    const cover=AuroraFormats.createDigitalCover('Coleção de teste','Acervo','epub');
    for(let i=1;i<=33;i++){
      await AuroraFormats.saveRecord('books',{id:'lote-'+i,format:'epub',name:'Coleção '+i,author:'Acervo',category:'romance',
        cover,coverSource:'generated',coverCheckedVersion:52,editionArtVersion:1});
    }
  });
  await page.goto('http://local.test/index.html');
  if(await page.locator('#libriaWelcome').isVisible())await page.locator('#libriaWelcomeSkip').click();
  await page.locator('#library [data-book-id="lote-33"]').waitFor({state:'attached'});
  const principal = page.locator('#libriaHomeBooks [data-genre-section="romance"]');
  const mainCard = principal.locator('.libria-home-book').first();
  const presentation = card => card.evaluate(el=>{
    const style=getComputedStyle(el);
    const cover=el.querySelector('.libria-home-cover');
    return {
      background:style.backgroundColor,border:style.borderRadius,
      columns:getComputedStyle(el.closest('.libria-home-book-grid')).gridTemplateColumns.split(' ').length,
      faces:cover.querySelectorAll('.aurora-catalog-face').length
    };
  });
  const mainPresentation=await presentation(mainCard);
  assert.equal(mainPresentation.columns,3);

  await page.goto('http://local.test/index.html?estante=catalogo');
  await page.getByRole('button',{name:'Catálogo',exact:true}).click();
  const dialog=page.locator('#shelfBookPicker');
  const visual=dialog.getByRole('button',{name:'Buscar catálogo por imagem',exact:true});
  const alphabetic=dialog.getByRole('button',{name:'Buscar catálogo de A a Z',exact:true});
  const actions=dialog.locator('button[data-book-key]');
  const cards=dialog.locator('.libria-home-book');
  assert.equal(await visual.getAttribute('aria-pressed'),'true','abre no mesmo formato do catálogo principal');
  assert.deepEqual(await presentation(cards.first()),mainPresentation);
  assert.equal(await cards.count(),30);
  assert.equal(await dialog.locator('.libria-home-genre-heading h3').textContent(),'Romances');
  if(process.env.AURORA_QA_SCREENSHOTS){
    await page.screenshot({path:process.env.AURORA_QA_SCREENSHOTS+'/catalogo-estante-v127.png'});
  }
  await dialog.getByRole('button',{name:/Mostrar mais/}).tap();
  assert.ok(await cards.count()>30);
  assert.equal(await dialog.locator('[data-more-genre]').count(),0);
  assert.equal(await dialog.locator('[data-book-key="arquivo:teste-veterinaria"]').count(),0);


  await dialog.getByPlaceholder('Título ou autor').fill('autora teste');
  assert.equal(await actions.count(),1);
  await cards.first().tap();
  await page.locator('#auroraShowcase.settled').waitFor();
  assert.equal(await dialog.isVisible(),false);
  await page.locator('#auroraShowBack').tap();
  await dialog.waitFor();
  assert.equal(await dialog.getByPlaceholder('Título ou autor').inputValue(),'autora teste');
  assert.equal(await cards.count(),1);

  const original=await page.locator('#library [data-book-id="teste-romance"] .shelf-book-cover img').getAttribute('src');
  assert.equal(await cards.first().locator('.aurora-catalog-front img').getAttribute('src'),original);
  await dialog.getByLabel('Prateleira',{exact:true}).selectOption('1');
  await actions.first().tap();
  await dialog.getByRole('button',{name:'Retirar Álbum Romances desta estante',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('aurora-estante-exemplares-v1:catalogo'))),[{key:'arquivo:teste-romance',section:1}]);

  await alphabetic.tap();
  assert.equal(await alphabetic.getAttribute('aria-pressed'),'true');
  assert.equal(await cards.count(),0);
  await actions.first().tap();
  await dialog.getByRole('button',{name:'Adicionar Álbum Romances à estante',exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('aurora-estante-exemplares-v1:catalogo'))),[]);
  await dialog.getByPlaceholder('Título ou autor').fill('');
  const titles=await dialog.locator('li strong').allTextContents();
  assert.deepEqual(titles,[...titles].sort((a,b)=>a.localeCompare(b,'pt-BR')));

  await dialog.getByPlaceholder('Título ou autor').fill('sem resultado impossível');
  assert.equal(await dialog.locator('.shelf-picker-empty').count(),1);
  await visual.tap();
  assert.equal(await dialog.locator('.shelf-picker-empty').count(),1);
  await dialog.getByPlaceholder('Título ou autor').fill('');
  assert.equal(await cards.count(),30,'uma nova busca reinicia a paginação');
  await page.setViewportSize({width:320,height:700});
  assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),'o painel cabe na largura do celular');
});
