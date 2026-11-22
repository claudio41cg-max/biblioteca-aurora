/* Reconhece uma possível contracapa REAL quando ela consta no fim do PDF.
   Não usa a última página de texto de um romance como se fosse uma contracapa. */
(() => {
  'use strict';
  async function extractBack(pdf,renderImage) {
    if (!pdf || pdf.numPages < 2 || !window.pdfjsLib?.OPS) return '';
    const last = await pdf.getPage(pdf.numPages);
    const previous = await pdf.getPage(pdf.numPages-1);
    const [lastText,previousText,operators] = await Promise.all([
      last.getTextContent(),previous.getTextContent(),last.getOperatorList()
    ]);
    const textLength = data => (data.items||[]).map(item=>item.str||'').join(' ').trim().length;
    const length = textLength(lastText);
    const previousLength = textLength(previousText);
    // PDFs digitalizados com todas as páginas em imagem não permitem determinar
    // automaticamente se a página final é uma contracapa ou o fim do texto.
    if (pdf.numPages > 3 && previousLength < 25) return '';
    if (length > 950 || (previousLength > 100 && length > previousLength * .8)) return '';
    const ops = window.pdfjsLib.OPS;
    const imageOps = [ops.paintImageXObject,ops.paintInlineImageXObject,
      ops.paintJpegXObject,ops.paintImageXObjectRepeat,ops.paintInlineImageXObjectGroup];
    if (!operators.fnArray.some(operator=>imageOps.includes(operator))) return '';
    const first = await pdf.getPage(1);
    const firstSize = first.getViewport({scale:1});
    const lastSize = last.getViewport({scale:1});
    const ratioDifference=Math.abs(firstSize.width/firstSize.height-lastSize.width/lastSize.height);
    if (ratioDifference > .12) return '';
    return renderImage(pdf,pdf.numPages,1400);
  }
  async function renderImage(pdf,number,width){
    const page=await pdf.getPage(number);
    const size=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(width/size.width,2400/size.height)});
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
    return canvas.toDataURL('image/jpeg',.95);
  }

  async function edition(pdf){
    const art=window.AuroraEditionArt;
    const faces={};
    const attachments=await pdf.getAttachments();
    for(const attachment of Object.values(attachments||{})){
      const kind=art.face(attachment.filename),mime=art.mime(attachment.filename);
      if(!kind||!mime||faces[kind]||attachment.content.length>32*1024*1024)continue;
      try{
        const src=await new Promise((resolve,reject)=>{
          const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;
          reader.readAsDataURL(new Blob([attachment.content],{type:mime}));
        });
        if(kind==='spine')Object.assign(faces,await art.spineArt(src));
        else {await art.decode(src);faces[kind]=src;}
      }catch{/* Um anexo ilegível não impede a importação das outras faces. */}
    }
    const labels=await pdf.getPageLabels()||[];
    for(const [i,label] of labels.entries()){
      const kind=art.face(label);
      if(kind&&!faces[kind]){
        const src=await renderImage(pdf,i+1,kind==='wrap'?3400:1600);
        if(kind==='spine')Object.assign(faces,await art.spineArt(src));
        else faces[kind]=src;
      }
    }
    if(pdf.numPages>1&&(!faces.cover||!faces.back||!faces.spine)){
      const inner=(await pdf.getPage(Math.ceil((pdf.numPages+1)/2))).getViewport({scale:1});
      const ratio=inner.width/inner.height;
      const rtl=(await pdf.getViewerPreferences())?.Direction==='R2L';
      // Algumas gráficas entregam a lombada como uma página estreita junto à capa.
      if(!faces.spine&&ratio>=.45&&ratio<=.9){
        const edges=new Set([1,2,pdf.numPages-1,pdf.numPages]);
        for(const n of edges){
          const size=(await pdf.getPage(n)).getViewport({scale:1});
          const aspect=size.width/size.height;
          if(Math.abs(size.height/inner.height-1)>.015||aspect<.02||aspect>.25)continue;
          Object.assign(faces,await art.spineArt(await renderImage(pdf,n,512)));
          break;
        }
      }
      let spread=faces.wrap;
      if(!spread){
        for(const n of [1,pdf.numPages]){
          const outer=(await pdf.getPage(n)).getViewport({scale:1});
          if(Math.abs(outer.height/inner.height-1)>.015||!art.spineFraction(outer.width/outer.height,ratio))continue;
          spread=await renderImage(pdf,n,3400);break;
        }
      }
      if(spread){
        const panels=await art.splitWrap(spread,ratio,rtl);
        for(const [key,value] of Object.entries(panels))if(!faces[key])faces[key]=value;
      }
    }
    if(faces.wrap&&(!faces.cover||!faces.back||!faces.spine)){
      const rtl=(await pdf.getViewerPreferences())?.Direction==='R2L';
      const panels=await art.splitWrap(faces.wrap,0,rtl);
      for(const [key,value] of Object.entries(panels))if(!faces[key])faces[key]=value;
    }
    delete faces.wrap;
    return faces;
  }

  async function front(pdf,title,author){
    const first=await pdf.getPage(1);
    const text=(await first.getTextContent()).items.map(item=>item.str||'').join(' ').trim();
    if(text.length>800||!text){
      const ops=window.pdfjsLib.OPS;
      const graphics=[ops.paintImageXObject,ops.paintInlineImageXObject,ops.paintImageMaskXObject,
        ops.constructPath,ops.shadingFill,ops.paintFormXObjectBegin];
      if(!(await first.getOperatorList()).fnArray.some(op=>graphics.includes(op)))
        return {cover:window.AuroraFormats.createDigitalCover(title,author,'pdf'),coverSource:'generated'};
    }
    return {cover:await renderImage(pdf,1,1400),coverSource:'original'};
  }

  async function readEdition(pdf){
    try{return await edition(pdf);}
    catch(error){console.warn('Arte adicional do PDF indisponível:',error);return {};}
  }
  window.AuroraPDFCovers={extractBack,edition,readEdition,renderImage,front};
})();
