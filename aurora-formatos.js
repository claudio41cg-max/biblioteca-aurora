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
  const sibling=(root,href)=>normalizePath(root.split('/').slice(0,-1).concat(decodeURIComponent(href.split('#')[0])).join('/'));
  const blobToData=blob=>new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
  async function openEpub(data){
    if(!window.JSZip)throw new Error('O módulo EPUB ainda não carregou. Abra o aplicativo novamente.');
    const zip=await JSZip.loadAsync(data);
    const container=zip.file('META-INF/container.xml');
    if(!container)throw new Error('Este arquivo não possui a estrutura de um EPUB válido.');
    const containerXML=xml(await container.async('text'));
    const opfPath=byLocal(containerXML,'rootfile')?.getAttribute('full-path');
    const opf=opfPath&&zip.file(opfPath);
    if(!opf)throw new Error('O índice do EPUB não foi encontrado.');
    const packageXML=xml(await opf.async('text'));
    const manifest=new Map(nodes(packageXML,'item').map(item=>[item.getAttribute('id'),{
      path:sibling(opfPath,item.getAttribute('href')||''),
      type:item.getAttribute('media-type')||'',
      properties:item.getAttribute('properties')||''
    }]));
    const metaCover=nodes(packageXML,'meta').find(item=>item.getAttribute('name')==='cover')?.getAttribute('content');
    const coverEntry=[...manifest.entries()].find(([id,item])=>item.properties.split(/\s+/).includes('cover-image')||id===metaCover)?.[1];
    let cover='';
    if(coverEntry&&zip.file(coverEntry.path)){
      const bytes=await zip.file(coverEntry.path).async('uint8array');
      const mime=coverEntry.type.startsWith('image/')?coverEntry.type:'image/jpeg';
      cover=await blobToData(new Blob([bytes],{type:mime}));
    }
    const spine=nodes(packageXML,'itemref').map(item=>manifest.get(item.getAttribute('idref')))
      .filter(item=>item&&(/xhtml|html/.test(item.type)||/\.x?html?$/i.test(item.path))&&zip.file(item.path));
    if(!spine.length)throw new Error('Não encontramos capítulos de texto neste EPUB.');
    const metadata=byLocal(packageXML,'metadata')||packageXML;
    return {zip,spine,title:byLocal(metadata,'title')?.textContent?.trim()||'',
      author:byLocal(metadata,'creator')?.textContent?.trim()||'',
      description:byLocal(metadata,'description')?.textContent?.trim()||'',
      cover};
  }
  async function epubChapter(book,index){
    const item=book.spine[index];
    if(!item)return '';
    const doc=new DOMParser().parseFromString(await book.zip.file(item.path).async('text'),'text/html');
    doc.querySelectorAll('script,style,nav,svg,aside,head').forEach(node=>node.remove());
    const body=doc.body;
    const elements=Array.from(body.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre'));
    const paragraphs=(elements.length?elements:[body]).map(node=>node.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
    return paragraphs.join('\n\n');
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
  window.AuroraFormats={openEpub,epubChapter,audioMetadata,database,readRecord,saveRecord,cleanName,blobToData};
})();
