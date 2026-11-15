/* Leitura local dos metadados e capas reais de EPUB, MP3 e M4B. */
(() => {
  'use strict';
  const cleanName=name=>String(name||'').replace(/\.(epub|mp3|m4a|m4b)$/i,'').replace(/[_-]+/g,' ').trim();
  const xml=source=>new DOMParser().parseFromString(source,'application/xml');
  const byLocal=(node,name)=>Array.from(node.getElementsByTagName('*')).find(item=>item.localName===name);
  const nodes=(node,name)=>Array.from(node.getElementsByTagName('*')).filter(item=>item.localName===name);
  const normalizePath=path=>{
    const parts=[];
    for(const part of String(path).split('/')){
      if(part==='..')parts.pop();else if(part&&part!=='.')parts.push(part);
    }
    return parts.join('/');
  };
  const sibling=(root,href)=>{
    const address=String(href||'').split('#')[0].split('?')[0];
    let decoded=address;
    try{decoded=decodeURIComponent(address);}catch{}
    return normalizePath(root.split('/').slice(0,-1).concat(decoded.replace(/\\/g,'/')).join('/'));
  };
  const blobToData=blob=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
  // Capa identificadora para livros sem imagem própria (EPUB, TXT, online).
  // Nunca é apresentada como fotografia da edição original.
  function createDigitalCover(title,author,format='EPUB'){
    const canvas=document.createElement('canvas');
    canvas.width=600;canvas.height=840;
    const ctx=canvas.getContext('2d');
    const shade=ctx.createLinearGradient(0,0,600,840);
    shade.addColorStop(0,'#17392f');shade.addColorStop(.48,'#1f3029');shade.addColorStop(1,'#101c1b');
    ctx.fillStyle=shade;ctx.fillRect(0,0,600,840);
    ctx.strokeStyle='#caa66c';ctx.lineWidth=4;ctx.strokeRect(32,32,536,776);
    ctx.strokeStyle='#caa66c66';ctx.lineWidth=1.5;ctx.strokeRect(44,44,512,752);
    ctx.fillStyle='#d8b784';ctx.textAlign='center';
    ctx.font='bold 19px Georgia,serif';ctx.fillText('BIBLIOTECA AURORA',300,104);
    ctx.lineWidth=2;ctx.strokeStyle='#d8b78488';
    ctx.beginPath();ctx.moveTo(185,134);ctx.lineTo(415,134);ctx.stroke();
    const name=String(title||'Livro digital').trim();
    const words=name.split(/\s+/);
    const lines=[];let line='';
    ctx.font='bold 57px Georgia,serif';
    for(const word of words){
      const value=line?line+' '+word:word;
      if(line&&ctx.measureText(value).width>480){lines.push(line);line=word;}
      else line=value;
    }
    if(line)lines.push(line);
    const fontSize=lines.length>5?35:lines.length>3?44:57;
    ctx.font='bold '+fontSize+'px Georgia,serif';
    ctx.fillStyle='#fff4db';
    const visible=lines.slice(0,7);
    const spacing=fontSize*1.28;
    const top=405-(visible.length-1)*spacing/2;
    visible.forEach((text,i)=>ctx.fillText(text,300,top+i*spacing,500));
    ctx.fillStyle='#e7cda7';ctx.font='26px Georgia,serif';
    const writer=String(author||'').trim();
    if(writer)ctx.fillText(writer,300,645,500);
    ctx.strokeStyle='#d8b78488';ctx.beginPath();ctx.moveTo(185,696);ctx.lineTo(415,696);ctx.stroke();
    ctx.font='18px Georgia,serif';ctx.fillStyle='#d8b784';
    const labels={epub:'EPUB',txt:'TEXTO',online:'LIVRO ONLINE',demo:'DEMONSTRAÇÃO',audio:'AUDIOLIVRO'};
    ctx.fillText('CAPA ILUSTRATIVA • '+(labels[String(format).toLowerCase()]||'LIVRO DIGITAL'),300,758);
    return canvas.toDataURL('image/png');
  }
  const createEpubCover=(title,author)=>createDigitalCover(title,author,'epub');
  async function openEpub(data){
    if(!window.JSZip)throw new Error('O módulo EPUB ainda não carregou. Abra o aplicativo novamente.');
    const zip=await JSZip.loadAsync(data);
    // Algumas edições trazem nomes percent-encoded ou diferenças de maiúsculas no ZIP.
    const filenames=new Map(Object.keys(zip.files).filter(path=>!zip.files[path].dir).map(path=>[path.toLowerCase(),path]));
    const entry=path=>zip.file(path)||zip.file(filenames.get(String(path).toLowerCase())||'');
    const container=zip.file('META-INF/container.xml');
    if(!container)throw new Error('Este arquivo não possui a estrutura de um EPUB válido.');
    const containerXML=xml(await container.async('text'));
    const opfPath=byLocal(containerXML,'rootfile')?.getAttribute('full-path');
    const opf=opfPath&&entry(opfPath);
    if(!opf)throw new Error('O índice do EPUB não foi encontrado.');
    const packageXML=xml(await opf.async('text'));
    const manifest=new Map(nodes(packageXML,'item').map(item=>[item.getAttribute('id'),{
      path:sibling(opfPath,item.getAttribute('href')||''),
      type:item.getAttribute('media-type')||'',
      properties:item.getAttribute('properties')||''
    }]));
    const metaCover=nodes(packageXML,'meta').find(item=>item.getAttribute('name')==='cover')?.getAttribute('content');
    const images=[...manifest.entries()].filter(([,item])=>item.type.startsWith('image/')&&entry(item.path));
    let coverEntry=images.find(([id,item])=>item.properties.split(/\s+/).includes('cover-image')||id===metaCover)?.[1];
    if(!coverEntry)coverEntry=images.find(([id,item])=>/cover|capa|front/i.test(id)||
      /(?:^|\/)(?:cover|capa|front)[^/]*\.(?:jpe?g|png|webp|svg)$/i.test(item.path))?.[1];
    // EPUB 2 frequentemente aponta a capa por <guide><reference type="cover">.
    if(!coverEntry){
      const reference=nodes(packageXML,'reference').find(item=>/cover/i.test(item.getAttribute('type')||''));
      const coverPath=reference&&sibling(opfPath,reference.getAttribute('href'));
      const coverFile=coverPath&&entry(coverPath);
      if(coverFile){
        if(images.some(([,item])=>item.path===coverPath))coverEntry=images.find(([,item])=>item.path===coverPath)?.[1];
        else if(/\.x?html?$/i.test(coverPath)){
          const doc=new DOMParser().parseFromString(await coverFile.async('text'),'text/html');
          const source=doc.querySelector('img')?.getAttribute('src')||'';
          const path=source&&sibling(coverFile.name,source);
          coverEntry=images.find(([,item])=>item.path===path)?.[1];
        }
      }
    }
    let cover='';
    if(coverEntry&&entry(coverEntry.path)){
      const bytes=await entry(coverEntry.path).async('uint8array');
      const mime=coverEntry.type.startsWith('image/')?coverEntry.type:'image/jpeg';
      cover=await blobToData(new Blob([bytes],{type:mime}));
    }
    const isReadable=item=>item&&(/xhtml|html/.test(item.type)||/\.x?html?$/i.test(item.path))&&entry(item.path);
    let spine=nodes(packageXML,'itemref').filter(item=>item.getAttribute('linear')!=='no')
      .map(item=>manifest.get(item.getAttribute('idref'))).filter(isReadable);
    // Recupera edições imperfeitas sem spine, seguindo a ordem do manifest.
    if(!spine.length)spine=[...manifest.values()].filter(item=>
      isReadable(item)&&!item.properties.split(/\s+/).includes('nav')&&!/\b(cover|capa)\b/i.test(item.path));
    if(!spine.length)throw new Error('Não encontramos capítulos de texto neste EPUB.');
    const metadata=byLocal(packageXML,'metadata')||packageXML;
    return {zip,filenames,spine:spine.map(item=>({...item,path:entry(item.path).name})),title:byLocal(metadata,'title')?.textContent?.trim()||'',
      author:byLocal(metadata,'creator')?.textContent?.trim()||'',
      description:byLocal(metadata,'description')?.textContent?.trim()||'',
      cover};
  }
  // Mantém a ordem original de texto e imagens, inclusive nas páginas de abertura.
  // Todas as imagens são lidas de dentro do próprio EPUB, sem requisições externas.
  async function epubChapterContent(book,index){
    const item=book.spine[index];
    if(!item)return [];
    const doc=new DOMParser().parseFromString(await book.zip.file(item.path).async('text'),'text/html');
    doc.querySelectorAll('script,style,nav,aside,head,iframe,form').forEach(node=>node.remove());
    const body=doc.body;
    if(!body)return [];
    const blocks=[];
    const breaks=new Set(['p','div','section','article','h1','h2','h3','h4','h5','h6','li','ul','ol','blockquote','pre','br','hr','figure','figcaption','table','tr']);
    let pending='';
    const flush=()=>{
      const value=pending.replace(/\s+/g,' ').trim();
      if(value)blocks.push({type:'text',text:value});
      pending='';
    };
    function walk(node){
      if(node.nodeType===3){pending+=node.nodeValue||'';return;}
      if(node.nodeType!==1)return;
      const tag=node.localName?.toLowerCase()||'';
      if(['script','style','iframe','form','nav','aside','head'].includes(tag))return;
      if(tag==='img'||tag==='image'||tag==='object'){
        flush();
        const src=node.getAttribute('src')||node.getAttribute('href')||node.getAttribute('xlink:href')||node.getAttribute('data')||'';
        if(src)blocks.push({type:'image',path:src,alt:node.getAttribute('alt')||node.getAttribute('title')||''});
        return;
      }
      if(tag==='br'||tag==='hr'){flush();return;}
      if(breaks.has(tag))flush();
      for(const child of node.childNodes)walk(child);
      if(breaks.has(tag))flush();
    }
    walk(body);flush();
    const resolved=[];
    for(const block of blocks){
      if(block.type==='text'){resolved.push(block);continue;}
      const source=block.path;
      if(/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(source)&&source.length<9e6){
        resolved.push({type:'image',src:source,alt:block.alt});continue;
      }
      if(/^(?:https?:|file:|\/\/)/i.test(source))continue;
      const path=sibling(item.path,source);
      const file=book.zip.file(path)||book.zip.file(book.filenames?.get(path.toLowerCase())||'');
      if(!file||file._data?.uncompressedSize>8e6)continue;
      const extension=path.split('.').pop()?.toLowerCase();
      const mime=({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml'})[extension];
      if(!mime)continue;
      try{
        const bytes=await file.async('uint8array');
        resolved.push({type:'image',src:await blobToData(new Blob([bytes],{type:mime})),alt:block.alt});
      }catch(error){console.warn('Imagem deste capítulo EPUB não pôde ser exibida:',error);}
    }
    return resolved;
  }
  async function epubChapter(book,index){
    const blocks=await epubChapterContent(book,index);
    return blocks.filter(part=>part.type==='text').map(part=>part.text).join('\n\n');
  }
  const decodeText=(bytes,encoding)=>{
    const codec=encoding===1||encoding===2?'utf-16':encoding===3?'utf-8':'iso-8859-1';
    try{return new TextDecoder(codec).decode(bytes).replace(/\0/g,'').trim();}catch{return '';}
  };
  const be32=(bytes,i)=>((bytes[i]*16777216)+(bytes[i+1]<<16)+(bytes[i+2]<<8)+bytes[i+3])>>>0;
  async function audioMetadata(data,filename){
    const bytes=new Uint8Array(data);
    let cover='',title='',author='';
    if(bytes.length>10&&String.fromCharCode(...bytes.slice(0,3))==='ID3'){
      const version=bytes[3];
      const end=10+((bytes[6]&127)<<21|(bytes[7]&127)<<14|(bytes[8]&127)<<7|(bytes[9]&127));
      let offset=10;
      while(offset+10<=Math.min(end,bytes.length)){
        const id=String.fromCharCode(...bytes.slice(offset,offset+4));
        const size=version===4?((bytes[offset+4]&127)<<21|(bytes[offset+5]&127)<<14|(bytes[offset+6]&127)<<7|(bytes[offset+7]&127)):be32(bytes,offset+4);
        if(!/^[A-Z0-9]{4}$/.test(id)||!size||offset+10+size>bytes.length)break;
        const body=bytes.subarray(offset+10,offset+10+size);
        if(id==='TIT2')title=decodeText(body.subarray(1),body[0]);
        if(id==='TPE1')author=decodeText(body.subarray(1),body[0]);
        if(id==='APIC'&&size<6e6){
          let cursor=1;
          while(cursor<body.length&&body[cursor]!==0)cursor++;
          const mime=new TextDecoder('latin1').decode(body.subarray(1,cursor))||'image/jpeg';
          cursor+=2; // fim do MIME e tipo de imagem
          const encoding=body[0],step=encoding===1||encoding===2?2:1;
          while(cursor+step<body.length&&(step===1?body[cursor]!==0:(body[cursor]!==0||body[cursor+1]!==0)))cursor+=step;
          cursor+=step;
          if(cursor<body.length)cover=await blobToData(new Blob([body.subarray(cursor)],{type:mime}));
        }
        offset+=10+size;
      }
    }
    // Algumas edições M4B guardam a capa no átomo MP4 "covr/data".
    if(!cover&&/\.m4[ab]$/i.test(filename)){
      for(let i=4,limit=Math.min(bytes.length,25*1024*1024);i+24<limit;i++){
        if(bytes[i]!==99||bytes[i+1]!==111||bytes[i+2]!==118||bytes[i+3]!==114)continue;
        if(String.fromCharCode(...bytes.subarray(i+8,i+12))!=='data')continue;
        const length=be32(bytes,i+4);
        const start=i+20,end=i+4+length;
        if(length>16&&length<6e6&&end<=bytes.length&&end>start){
          const magic=bytes[start]===0x89?'image/png':'image/jpeg';
          cover=await blobToData(new Blob([bytes.subarray(start,end)],{type:magic}));break;
        }
      }
    }
    return {cover,title:title||cleanName(filename),author};
  }
  function database(){return new Promise((resolve,reject)=>{
    const request=indexedDB.open('aurora-pdf-library',2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('books'))db.createObjectStore('books',{keyPath:'id'});
      if(!db.objectStoreNames.contains('progress'))db.createObjectStore('progress',{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Não foi possível abrir o acervo.'));
  });}
  function readRecord(store,id){return database().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(id);
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    tx.oncomplete=()=>db.close();tx.onerror=()=>db.close();
  }));}
  function saveRecord(store,item){return database().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(item);
    tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
  }));}
  window.AuroraFormats={openEpub,epubChapter,epubChapterContent,audioMetadata,database,readRecord,saveRecord,cleanName,blobToData,createEpubCover,createDigitalCover};
})();
