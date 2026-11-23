import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const enabled={skip:process.env.AURORA_BROWSER_TEST!=='1'};
const key='aurora-estante-exemplares-v1:efeito';
async function editor(t,options={}){
  const directory=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const require=createRequire(directory?join(directory,'test.cjs'):import.meta.url);
  const {chromium}=require('playwright');
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',...options});
  const root=fileURLToPath(new URL('..',import.meta.url));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin==='http://local.test'?route.fulfill({path:join(root,url.pathname)}):route.abort();
  });
  await page.goto('http://local.test/nova-estante.html?id=efeito');
  await page.evaluate(async key=>{
    await AuroraFormats.saveRecord('books',{id:'poemas',name:'Poemas da Aurora',author:'Ana',format:'epub',cover:AuroraFormats.createDigitalCover('Poemas da Aurora','Ana','epub')});
    AuroraEstantesSalvas.save({id:'efeito',name:'Minha estante',sections:1,objects:[]},true);
    localStorage.setItem(key,JSON.stringify([{key:'arquivo:poemas',section:0,pose:{face:'cover',yaw:45}}]));
  },key);
  await page.reload();
  const book=page.locator('[data-personal-book-key="arquivo:poemas"]');
  await book.waitFor();
  await page.evaluate(key=>{
    window.effectCalls=[];
    const play=AuroraBookParticles.play;
    AuroraBookParticles.play=snapshot=>{
      effectCalls.push({snapshot:!!snapshot,stored:JSON.parse(localStorage.getItem(key))});
      return play(snapshot);
    };
  },key);
  return {page,book,panel:page.locator('#bookSizeDialog')};
}
test('partículas só aparecem após confirmar e salvar, com textura, queda e limpeza',enabled,async t=>{
  const {page,book,panel}=await editor(t);
  await book.press('Enter');
  await panel.getByRole('button',{name:'Excluir da estante',exact:true}).click();
  assert.equal(await page.evaluate(()=>effectCalls.length),0);
  await panel.getByRole('button',{name:'Desfazer exclusão',exact:true}).click();
  await panel.getByRole('button',{name:'Fechar sem salvar'}).click();
  await panel.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>effectCalls.length),0);
  await book.press('Enter');
  await panel.getByRole('button',{name:'Excluir da estante',exact:true}).click();
  await panel.getByRole('button',{name:'Pronto',exact:true}).click();
  const effect=page.locator('canvas.aurora-book-particles');
  await effect.waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>effectCalls),[{snapshot:true,stored:[]}]);
  assert.equal(await effect.getAttribute('aria-hidden'),'true');
  assert.equal(await effect.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  await page.waitForTimeout(420);
  const pixels=await effect.evaluate(canvas=>{
    const ctx=canvas.getContext('2d'),data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let painted=0;for(let i=3;i<data.length;i+=4)if(data[i]>5)painted++;
    return painted;
  });
  assert.ok(pixels>100,'os fragmentos estão efetivamente desenhados');
  if(process.env.AURORA_QA_SCREENSHOTS)await page.screenshot({path:process.env.AURORA_QA_SCREENSHOTS+'/livro-particulas.png'});
  await panel.waitFor({state:'hidden'});
  assert.equal(await effect.count(),0);
  assert.equal(await book.count(),0);
  assert.ok(await page.evaluate(()=>AuroraFormats.readRecord('books','poemas')));
});
test('falha ao salvar não dispara partículas nem remove o livro',enabled,async t=>{
  const {page,book,panel}=await editor(t);
  await book.press('Enter');
  await panel.getByRole('button',{name:'Excluir da estante',exact:true}).click();
  await page.evaluate(key=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){if(k===key)throw new Error('Sem espaço');return original.call(this,k,v);};
  },key);
  await panel.getByRole('button',{name:'Pronto',exact:true}).click();
  await panel.getByText('Não foi possível salvar. Tente novamente.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>effectCalls.length),0);
  assert.ok(await book.isVisible());
  await panel.getByRole('button',{name:'Fechar sem salvar'}).click();
  await panel.waitFor({state:'hidden'});
  assert.equal(await page.locator('canvas.aurora-book-particles').count(),0);
});
test('movimento reduzido e origem desconectada terminam sem resíduos',enabled,async t=>{
  const {page,book}=await editor(t,{reducedMotion:'reduce'});
  const result=await book.evaluate(async el=>{
    const snapshot=AuroraBookParticles.capture(el),start=performance.now();
    const pending=AuroraBookParticles.play(snapshot);
    el.remove();await pending;
    return {time:performance.now()-start,overlays:document.querySelectorAll('canvas.aurora-book-particles').length,visibility:el.style.visibility};
  });
  assert.ok(result.time<650);
  assert.equal(result.overlays,0);
  assert.equal(result.visibility,'');
});
test('exclusão na estante principal também anima após a confirmação',enabled,async t=>{
  const {page}=await editor(t);
  await page.goto('http://local.test/index.html');
  await page.locator('#arrangeButton').click();
  const book=page.locator('#library .book-spine[data-raw-title="Dom Casmurro"]');
  await book.click();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#deleteBook').click();
  await page.locator('canvas.aurora-book-particles').waitFor({state:'visible'});
  await book.waitFor({state:'detached'});
  assert.equal(await page.locator('canvas.aurora-book-particles').count(),0);
  await page.reload();
  assert.equal(await book.count(),0);
});
