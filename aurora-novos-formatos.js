/* EPUB e audiolivros entram no mesmo acervo local e na mesma estante 3D. */
(() => {
  'use strict';
  const formats=window.AuroraFormats;
  if(!formats)return;
  const $=id=>document.getElementById(id);
  const status=$('pdfImportStatus');
  const trigger=$('importTrigger');
  const category=$('importCategory');
  const report=message=>{status.hidden=false;status.textContent=message;};
  let selectedAudioCover=null;
  $('audioCoverFile')?.addEventListener('change',event=>{
    selectedAudioCover=event.target.files?.[0]||null;
    report(selectedAudioCover?'Capa selecionada: '+selectedAudioCover.name+'. Agora importe o EPUB ou audiolivro.':'Nenhuma capa selecionada.');
  });
  const importFile=async(file,format)=>{
    if(file.size>600*1024*1024)throw new Error('Este arquivo ultrapassa 600 MB. Escolha um arquivo menor.');
    if(format==='epub'&&!/\.epub$/i.test(file.name))throw new Error('Selecione um arquivo .epub.');
    if(format==='audio'&&!/\.(mp3|m4a|m4b)$/i.test(file.name))throw new Error('Selecione um arquivo MP3, M4A ou M4B.');
    report('Lendo a capa e os dados de '+file.name+'…');
    const data=await file.arrayBuffer();
    let details;
    if(format==='epub'){
      const epub=await formats.openEpub(data);
      details={name:window.AuroraTitles?.display(epub.title||formats.cleanName(file.name))||epub.title||formats.cleanName(file.name),author:epub.author,
        description:epub.description,cover:epub.cover,back:epub.back,spine:epub.spineImage,spineAspect:epub.spineAspect,total:epub.spine.length,
        coverSource:epub.cover?'original':'generated'};
    }else{
      details=await formats.audioMetadata(data,file.name);
      details.name=window.AuroraTitles?.display(details.title||formats.cleanName(file.name))||details.title||formats.cleanName(file.name);
      details.total=Math.max(130,Math.floor(data.byteLength/50000));
    }
    if(!details.cover&&format==='epub'){
      const catalog=await formats.catalogCover?.(details.name,details.author);
      if(catalog?.cover){details.cover=catalog.cover;details.coverSource=catalog.coverSource;}
    }
    if(!details.cover&&selectedAudioCover){details.cover=await formats.blobToData(selectedAudioCover);details.coverSource='custom';}
    const cover=details.cover||formats.createDigitalCover(details.name,details.author,format);
    const panel=await window.AuroraEditionArt.decode(cover).catch(()=>null);
    const ratio=panel?panel.naturalWidth/panel.naturalHeight:.72;
    const item={id:crypto.randomUUID(),name:details.name,author:details.author||'',
      description:details.description||'',format,mime:file.type|| (format==='audio'?'audio/mpeg':'application/epub+zip'),
      data,cover,coverSource:details.coverSource||(details.cover?'original':'generated'),back:details.back||'',editionArtVersion:1,coverCheckedVersion:52,backChecked:true,spine:details.spine||'',spineAspect:details.spineAspect||0,total:details.total,ratio,category:category.value,
      status:'quero-ler',created:Date.now(),page:0};
    report('Guardando na estante do seu aparelho…');
    await formats.saveRecord('books',item);
    return item;
  };
  [['epubFile','epub'],['audioFile','audio']].forEach(([inputId,format])=>{
    const input=$(inputId);
    input?.addEventListener('change',async event=>{
      const file=event.target.files?.[0];
      if(!file)return;
      trigger.disabled=true;
      try{
        const book=await importFile(file,format);
        selectedAudioCover=null;$('audioCoverFile').value='';
        report('“'+book.name+'” foi adicionado ao catálogo. Escolha uma estante quando quiser.');
        location.href='./index.html?catalogo=1&importado='+encodeURIComponent(book.id);
      }catch(error){
        report('Não foi possível importar: '+(error?.message||String(error)));
      }finally{input.value='';trigger.disabled=false;}
    });
  });
})();
