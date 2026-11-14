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
      details={name:epub.title||formats.cleanName(file.name),author:epub.author,
        description:epub.description,cover:epub.cover,total:epub.spine.length};
    }else{
      details=await formats.audioMetadata(data,file.name);
      details.name=details.title||formats.cleanName(file.name);
      details.total=Math.max(130,Math.floor(data.byteLength/50000));
    }
    if(!details.cover&&selectedAudioCover)details.cover=await formats.blobToData(selectedAudioCover);
    const cover=details.cover||'';
    const item={id:crypto.randomUUID(),name:details.name,author:details.author||'',
      description:details.description||'',format,mime:file.type|| (format==='audio'?'audio/mpeg':'application/epub+zip'),
      data,cover,back:'',spine:'',total:details.total,ratio:.72,category:category.value,
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
        report('“'+book.name+'” foi importado. Abrindo '+(format==='epub'?'a leitura':'o áudio')+'…');
        location.href='./'+(format==='epub'?'ler-epub.html':'ouvir-livro.html')+'?livro='+encodeURIComponent(book.id)+'&v=1';
      }catch(error){
        report('Não foi possível importar: '+(error?.message||String(error)));
      }finally{input.value='';trigger.disabled=false;}
    });
  });
})();
