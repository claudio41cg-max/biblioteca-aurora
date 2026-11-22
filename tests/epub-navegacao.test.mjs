import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const reader=read('aurora-epub-reader.js');
const html=read('ler-epub.html');
for(const id of ['previousPage','nextPage','readLocation']){
  assert.ok(html.includes('id="'+id+'"'),'Controle EPUB ausente: '+id);
}
assert.doesNotMatch(html,/id="previousChapter"|id="nextChapter"/);
assert.match(reader,/PAGE_WINDOW=24/,'Um capítulo extenso deve usar páginas opacas em lotes econômicos');
assert.match(reader,/if\(next>=pages\.length\)/,'Fim do capítulo deve avançar para o próximo');
assert.match(reader,/host\.classList\.add\('epub-static'\)/,'Leitura precisa funcionar sem biblioteca externa');
assert.match(read('sw.js'),/ignoreSearch:\s*true/,'A navegação EPUB offline precisa ignorar a consulta da URL');

// Execute com AURORA_BROWSER_TEST=1 para abrir um EPUB sintético no navegador real.
if(process.env.AURORA_BROWSER_TEST==='1'){
  const directory=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if(!directory)throw new Error('Dependências do navegador indisponíveis');
  const require=createRequire(pathToFileURL(directory+'/runtime-test.cjs'));
  const {chromium}=require('playwright');
  const port=18000+Math.floor(Math.random()*8000);
  const server=spawn(process.execPath,['dev-server.mjs','--host','127.0.0.1','--port',String(port)],{cwd:new URL('..',import.meta.url),stdio:'ignore'});
  let browser;
  try{
    const base='http://127.0.0.1:'+port;
    for(let i=0;i<40;i++){
      try{const response=await fetch(base+'/ler-epub.html');if(response.ok)break;}catch{}
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
    const context=await browser.newContext({viewport:{width:390,height:830}});
    const page=await context.newPage();
    await page.route('**/vendor/page-flip-2.0.7.browser.js',route=>route.abort());
    await page.goto(base+'/ler-epub.html');
    await page.evaluate(async()=>{
      const zip=new JSZip();
      zip.file('META-INF/container.xml','<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>');
      zip.file('OPS/package.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Livro de teste</dc:title></metadata><manifest><item id="c1" href="cap%201.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="cap2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>');
      zip.file('OPS/cap 1.xhtml','<html><body><h1>Primeiro capítulo</h1>'+Array.from({length:65},(_,i)=>'<p>Parágrafo número '+i+' com bastante conteúdo para continuar folheando o livro e ler todas as partes sem interrupção.</p>').join('')+'</body></html>');
      zip.file('OPS/cap2.xhtml','<html><body><section><div>Final do livro. Segunda parte com texto dentro de uma div, sem parágrafo.</div></section></body></html>');
      const data=await zip.generateAsync({type:'arraybuffer'});
      const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('aurora-pdf-library',2);req.onupgradeneeded=()=>{const db=req.result;for(const s of ['books','progress'])if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
      await new Promise((resolve,reject)=>{const tx=db.transaction('books','readwrite');tx.objectStore('books').put({id:'teste-epub',name:'Livro de teste',format:'epub',data});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      db.close();
    });
    await page.goto(base+'/ler-epub.html?livro=teste-epub');
    await page.waitForFunction(()=>document.querySelector('#readLocation')?.textContent?.includes('/'));
    const first=await page.locator('#readLocation').innerText();
    assert.ok(Number(first.split('/')[1])>2,'O primeiro capítulo deve conter várias páginas');
    await page.locator('#nextPage').click();
    assert.match(await page.locator('#readLocation').innerText(),/^2 \/ /);
    await page.locator('#progress').evaluate(input=>{input.value='85';input.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.waitForFunction(()=>document.querySelector('#epubAccessibleText')?.textContent?.includes('Final do livro'));
    await page.locator('#previousPage').click();
    await page.waitForFunction(()=>document.querySelector('#readLocation')?.textContent?.includes('/'));
    console.log('EPUB real: paginação, próximo capítulo, retorno e modo offline sem PageFlip OK.');
  }finally{
    await browser?.close();
    server.kill();
  }
}
console.log('Controles EPUB e modo de navegação verificados.');
