/* Importação de PDFs diretamente da estante principal, sem estante intermediária. */
(() => {
  'use strict';
  const input=document.getElementById('pdfFile');
  const category=document.getElementById('importCategory');
  const status=document.getElementById('pdfImportStatus');
  const trigger=document.getElementById('importTrigger');
  if(!input||!category||!status) return;
  const report=message=>{status.hidden=false;status.textContent=message;};
  const readableName=filename=>filename.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim()
    .replace(/(^|\s)\S/g,match=>match.toUpperCase());

  function openDatabase(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open('aurora-pdf-library',2);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains('books'))db.createObjectStore('books',{keyPath:'id'});
        if(!db.objectStoreNames.contains('progress'))db.createObjectStore('progress',{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Feche as outras abas da biblioteca e tente novamente.'));
    });
  }
  async function renderImage(pdf,pageNumber,width){
    const page=await pdf.getPage(pageNumber);
    const original=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:width/original.width});
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(viewport.width);
    canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
    return canvas.toDataURL('image/jpeg',.9);
  }
  async function importPDF(file,chosenCategory){
    if(!window.pdfjsLib)throw new Error('O leitor PDF não carregou. Confira a conexão e tente novamente.');
    if(!/\.pdf$/i.test(file.name) && file.type!=='application/pdf')throw new Error('Selecione um PDF.');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const data=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(data.slice(0))}).promise;
    let database;
    try{
      report('Extraindo a capa original do PDF…');
      const faces=await window.AuroraPDFCovers.readEdition(pdf);
      const first=await pdf.getPage(1);
      const size=first.getViewport({scale:1});
      const metadata=await pdf.getMetadata().catch(()=>null);
      const author=String(metadata?.info?.Author||'').trim();
      const subject=String(metadata?.info?.Subject||'').trim();
      const name=readableName(file.name);
      const known=window.AuroraBookInfo?.find(name);
      // Se uma contracapa estiver incluída no PDF, use a própria imagem.
      // Se não houver segurança, preserve o verso neutro e NÃO invente um.
      let back=faces.back||'';
      try {if(!back)back=await window.AuroraPDFCovers?.extractBack(pdf,renderImage)||'';}
      catch(error){console.warn('Não foi possível verificar a contracapa:',error);}
      const {cover,coverSource}=faces.cover?{cover:faces.cover,coverSource:'original'}:await window.AuroraPDFCovers.front(pdf,name,known?.author||author);
      const item={id:crypto.randomUUID(),name,data,cover,coverSource,back,spine:faces.spine||'',spineAspect:faces.spineAspect||0,editionArtVersion:1,backChecked:true,
        total:pdf.numPages,author:known?.author||(author.length<=120?author:''),
        description:subject.length>50?subject.slice(0,2800):'',
        created:Date.now(),page:0,category:chosenCategory,
        ratio:faces.ratio||Math.max(.59,Math.min(.84,size.width/size.height)),status:'quero-ler'};
      report('Guardando o livro na estante principal…');
      database=await openDatabase();
      await new Promise((resolve,reject)=>{
        const tx=database.transaction('books','readwrite');
        tx.objectStore('books').put(item);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
        tx.onabort=()=>reject(tx.error);
      });
      return item.id;
    }finally{
      database?.close();
      await pdf.destroy().catch(()=>{});
    }
  }
  // Atalho de teste: o arquivo é escolhido pelo usuário e fica somente no aparelho.
  // O leitor 3D e o folheio existentes não são alterados.
  const vetPilot=document.getElementById('vetAtlasPilot');
  vetPilot?.addEventListener('click',()=>{
    category.value='veterinaria';
    report('Escolha no celular o PDF do Atlas Colorido de Citologia Clínica de Cães e Gatos.');
  });
  input.addEventListener('change',async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    trigger.disabled=true;
    report('Preparando '+file.name+'…');
    try{
      const id=await importPDF(file,category.value);
      // O visor 3D é mantido. Ao voltar, o usuário encontra a estante única.
      location.href='./meus-livros.html?v=32&livro='+encodeURIComponent(id);
    }catch(error){
      report('Não foi possível importar o PDF: '+(error.message||String(error)));
    }finally{trigger.disabled=false;input.value='';}
  });
})();
