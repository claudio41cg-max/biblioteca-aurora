/* Livro físico em WebGL: capa, contracapa, lombada e miolo são faces distintas.
   Arte original na frente, acabamento de estúdio e movimento com inércia limitada.
   O visor CSS permanece disponível se o WebGL não conseguir exibir a capa. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';

const stage=document.getElementById('scene');
const fallback=document.getElementById('book3d');
if(stage && fallback){
  try {initialize();} catch(error) {console.warn('O modo 3D usará a versão compatível:',error);}
}

function initialize(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,2));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  // Neutral mantém a arte das capas mais próxima das cores originais.
  renderer.toneMapping=THREE.NeutralToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.domElement.className='aurora-webgl';
  renderer.domElement.setAttribute('aria-label','Livro tridimensional: arraste para girar e toque para abrir');
  renderer.domElement.setAttribute('role','button');
  renderer.domElement.tabIndex=0;
  stage.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',event=>{
    event.preventDefault();
    // Em celulares que perdem o contexto gráfico, a capa original continua
    // disponível no livro CSS, sem mostrar a capa provisória marrom.
    stage.classList.remove('three-ready');
  });
  renderer.domElement.addEventListener('webglcontextrestored',()=>{
    if(currentBook) display(currentBook);
  });

  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const maxAniso=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,80);
  // Distância constante: rolar a página não pode ampliar ou reduzir o exemplar.
  camera.position.set(0,.08,6.4);
  // Reflexos amplos de softboxes, criados uma vez e reutilizados em todos os livros.
  // Em aparelhos com pouca memória, a iluminação convencional continua suficiente.
  function buildEnvironment(){
    const pmrem=new THREE.PMREMGenerator(renderer);
    try{
      const studio=new THREE.Scene();
      studio.add(new THREE.Mesh(new THREE.BoxGeometry(10,10,10),
        new THREE.MeshBasicMaterial({color:0x66584c,side:THREE.BackSide})));
      function softbox(width,height,color,x,y,z){
        const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),
          new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false}));
        panel.position.set(x,y,z);
        panel.lookAt(0,0,0);
        studio.add(panel);
      }
      softbox(4,3,0xffe8c7,-3.5,3.8,4);
      softbox(3,4,0xbfd9df,4,1,-3.5);
      softbox(5,5,0xfff8e8,0,4.9,0);
      const environment=pmrem.fromScene(studio,.06).texture;
      studio.traverse(item=>{item.geometry?.dispose();item.material?.dispose();});
      return environment;
    } finally {pmrem.dispose();}
  }
  try{
    if(navigator.deviceMemory === undefined || navigator.deviceMemory>=3){
      scene.environment=buildEnvironment();
      scene.environmentIntensity=.5;
    }
  }catch(error){console.warn('Reflexos de estúdio indisponíveis; usando luzes padrão:',error);}
  scene.add(new THREE.HemisphereLight(0xfff4df,0x665144,1.65));
  const key=new THREE.DirectionalLight(0xfff0d9,2.35);
  key.position.set(-3.5,5,6);
  scene.add(key);
  const rim=new THREE.DirectionalLight(0xb8d8d1,1.15);
  rim.position.set(4,1.6,-3);
  scene.add(rim);
  const group=new THREE.Group();
  scene.add(group);

  // Sombra difusa atrás da base, separada do miolo para não escurecer as páginas.
  function makeContactShadow(){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');
    const shade=ctx.createRadialGradient(128,128,5,128,128,126);
    shade.addColorStop(0,'rgba(45,30,21,.35)');
    shade.addColorStop(.55,'rgba(45,30,21,.13)');
    shade.addColorStop(1,'rgba(45,30,21,0)');
    ctx.fillStyle=shade;
    ctx.fillRect(0,0,256,256);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(1,1),
      new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
  }
  const shadowMesh=makeContactShadow();
  scene.add(shadowMesh);

  let currentBook=null,frontHinge=null,shelfSpineMesh=null,down=null,rotation={x:-.09,y:.28},opening=false,modelGeneration=0;
  let shelfPreviewInProgress=false;
  let scheduled=false,requestId=0,inertiaId=0,velocityY=0,lastMoveTime=0;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const render=()=>renderer.render(scene,camera);
  const queueRender=()=>{
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;render();});
  };
  function resize(){
    const width=Math.max(stage.clientWidth,280),height=Math.max(stage.clientHeight,340);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    queueRender();
  }
  const ro=new ResizeObserver(resize);
  ro.observe(stage);

  function canvasTexture(canvas){
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=maxAniso;
    return texture;
  }
  function neutralCoverCanvas(back=false){
    const canvas=document.createElement('canvas');
    canvas.width=1024;canvas.height=1440;
    const ctx=canvas.getContext('2d');
    ctx.scale(2,2);
    const fade=ctx.createLinearGradient(0,0,512,720);
    fade.addColorStop(0,back?'#402a1f':'#62432d');
    fade.addColorStop(.65,back?'#251911':'#443126');
    fade.addColorStop(1,'#160f0b');
    ctx.fillStyle=fade;ctx.fillRect(0,0,512,720);
    // Não criamos títulos nem ilustrações fictícias. A imagem real substitui
    // esta superfície neutra assim que termina de carregar.
    const shadow=ctx.createLinearGradient(0,0,65,0);
    shadow.addColorStop(0,'#100b09b8');shadow.addColorStop(1,'#100b0900');
    ctx.fillStyle=shadow;ctx.fillRect(0,0,65,720);
    if(back){ctx.fillStyle='#c8a97d33';ctx.fillRect(30,25,452,1);}
    return canvas;
  }
  function edgeCanvas(orientation='vertical'){
    // O recorte fotográfico das fibras é compartilhado com a versão CSS.
    // Assim o mesmo livro mantém os filetes verticais mesmo sem WebGL.
    const detailed=window.AuroraEditionSurfaces?.paperEdgeCanvas?.(orientation);
    if(detailed)return canvasTexture(detailed);
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=512;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f6ebd3';ctx.fillRect(0,0,256,512);
    // O corte lateral do livro tem FILETES DE PÉ, paralelos à altura.
    // As faces superior e inferior usam textura independente.
    for(let i=0;i<(orientation==='vertical'?256:512);i+=2){
      ctx.fillStyle=i%10===0?'#b8a381':i%6===0?'#d9c8ac':'#e9dcc5';
      if(orientation==='vertical')ctx.fillRect(i,0,1,512);
      else ctx.fillRect(0,i,256,1);
    }
    const gradient=ctx.createLinearGradient(0,0,256,0);
    gradient.addColorStop(0,'#b7a08077');
    gradient.addColorStop(.18,'#ffffff00');
    gradient.addColorStop(.76,'#fff7e940');
    gradient.addColorStop(1,'#ad977766');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,256,512);
    return canvasTexture(canvas);
  }
  function isIracemaBook(book){
    const name=String(book?.title||book?.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return /\biracema\b/.test(name);
  }
  function spineCanvas(name){
    const canvas=document.createElement('canvas');
    canvas.width=512;canvas.height=1920;
    const ctx=canvas.getContext('2d');
    ctx.scale(2,2);
    const gradient=ctx.createLinearGradient(0,0,256,0);
    gradient.addColorStop(0,'#160c0a');gradient.addColorStop(.23,'#5c3426');
    gradient.addColorStop(.55,'#875334');gradient.addColorStop(.83,'#40251a');
    gradient.addColorStop(1,'#1b0e0b');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,256,960);
    ctx.strokeStyle='#d9b16f';ctx.lineWidth=7;
    [46,71,875,900].forEach(y=>{ctx.beginPath();ctx.moveTo(9,y);ctx.lineTo(247,y);ctx.stroke();});
    ctx.translate(128,480);ctx.rotate(-Math.PI/2);
    ctx.fillStyle='#ffe0a9';ctx.textAlign='center';
    ctx.font='bold 43px Georgia';ctx.fillText(String(name).slice(0,33),0,13,725);
    return canvasTexture(canvas);
  }
  // Ensaio visual de UMA edição: somente "Razão e Sensibilidade".
  // Interior da CAPA fina à esquerda e folha de rosto sobre o miolo à direita.
  // Nenhuma mudança no relógio, evento ou movimento da animação de abertura.
  function hasReasonOpening(book){
    const candidate=String(book.title||book.name||'')+' '+String(book.name||'');
    const normalized=candidate.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/gi,' ').toLowerCase();
    return /\brazao e sensibilidade\b/.test(normalized);
  }
  function isRichDadOpening(book){
    const name=String(book.title||book.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').toLowerCase();
    return /\bpai rico pai pobre\b/.test(name) && book.format==='epub';
  }
  function reasonOpeningCanvas(which,richDad=false){
    const canvas=document.createElement('canvas');
    canvas.width=1024;canvas.height=1440;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.scale(2,2);
    const W=512,H=720;
    const paper=ctx.createLinearGradient(0,0,W,H);
    paper.addColorStop(0,which==='inside'?'#e9dbc1':'#fff8e9');
    paper.addColorStop(.42,which==='inside'?'#f4e8d2':'#fcf3e2');
    paper.addColorStop(1,which==='inside'?'#e8d8bd':'#eadcc5');
    ctx.fillStyle=paper;ctx.fillRect(0,0,W,H);
    // Fibras quase invisíveis, sobre papel opaco, sem parecer outra capa ilustrada.
    let seed=which==='inside'?41:1811;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<2600;i++){
      ctx.fillStyle=random()>.52?'rgba(255,255,255,.10)':'rgba(123,94,64,.028)';
      ctx.fillRect(random()*W,random()*H,.35+random()*.9,.7+random()*2.5);
    }
    const edge=ctx.createLinearGradient(0,0,W,0);
    edge.addColorStop(0,'rgba(75,47,25,.24)');
    edge.addColorStop(.045,'rgba(115,83,52,.09)');
    edge.addColorStop(.16,'rgba(255,255,255,.06)');
    edge.addColorStop(.86,'rgba(255,255,255,.02)');
    edge.addColorStop(1,'rgba(77,50,28,.16)');
    ctx.fillStyle=edge;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle=which==='inside'?'rgba(134,94,54,.29)':'rgba(142,109,70,.34)';
    ctx.lineWidth=1.2;
    ctx.strokeRect(29,30,W-58,H-60);
    ctx.strokeStyle='rgba(255,255,248,.33)';
    ctx.lineWidth=.65;ctx.strokeRect(34,35,W-68,H-70);
    ctx.textAlign='center';ctx.textBaseline='middle';
    if(which==='inside'){
      // Guarda interna da própria capa: pouco texto e sem uma "segunda capa".
      ctx.fillStyle='#8c6d4b';
      ctx.font='18px Georgia,serif';ctx.fillText('✧',W/2,236);
      ctx.font='italic 25px Georgia,serif';
      ctx.fillText('Ex-líbris',W/2,286);
      ctx.fillStyle='#59452e';
      ctx.font='27px Georgia,serif';
      ctx.fillText('Biblioteca Aurora',W/2,328);
      ctx.strokeStyle='rgba(134,97,59,.36)';
      ctx.beginPath();ctx.moveTo(176,356);ctx.lineTo(336,356);ctx.stroke();
      ctx.fillStyle='#89765d';ctx.font='italic 17px Georgia,serif';
      ctx.fillText('Histórias para guardar.',W/2,390);
      ctx.fillText('Mundos para descobrir.',W/2,415);
    }else{
      // Primeira folha de rosto, ligada visualmente ao papel do bloco.
      ctx.fillStyle='#8d7350';ctx.font='16px Georgia,serif';
      ctx.fillText('BIBLIOTECA AURORA',W/2,119);
      ctx.font='italic 23px Georgia,serif';ctx.fillText(richDad?'Robert T. Kiyosaki':'Jane Austen',W/2,239);
      ctx.fillStyle='#4a3325';ctx.font='49px Georgia,serif';
      ctx.fillText(richDad?'Pai Rico,':'Razão e',W/2,318);
      ctx.fillText(richDad?'Pai Pobre':'Sensibilidade',W/2,378);
      ctx.strokeStyle='#ab865c';ctx.lineWidth=1.6;
      ctx.beginPath();ctx.moveTo(145,422);ctx.lineTo(229,422);
      ctx.moveTo(283,422);ctx.lineTo(367,422);ctx.stroke();
      ctx.fillStyle='#9b7850';ctx.font='25px Georgia,serif';ctx.fillText('❦',W/2,424);
      ctx.fillStyle='#745b43';ctx.font='italic 21px Georgia,serif';
      ctx.fillText(richDad?'Educação financeira':'Entre a prudência e o coração,',W/2,490);
      ctx.fillText(richDad?'e escolhas para o futuro.':'duas maneiras de sentir.',W/2,520);
      ctx.fillStyle='#9f8b70';ctx.font='14px Georgia,serif';
      ctx.fillText(richDad?'DESENVOLVA SUA INTELIGÊNCIA FINANCEIRA':'UMA HISTÓRIA DE JANE AUSTEN',W/2,620);
    }
    return canvas;
  }
  // Usa exatamente as mesmas superfícies da versão CSS de compatibilidade.
  function matchEditionSurfaces(img,book,backTexture,spineTexture,boardMaterial,trimMaterial){
    const surfaces=window.AuroraEditionSurfaces?.generate(img,book);
    if(!surfaces)return;
    boardMaterial.color.setStyle(surfaces.edge);
    trimMaterial.color.setStyle(surfaces.accent);
    if(surfaces.back){backTexture.image=surfaces.back;backTexture.needsUpdate=true;}
    if(surfaces.spine){spineTexture.image=surfaces.spine;spineTexture.needsUpdate=true;}
    queueRender();
  }
  const edgeTexture=edgeCanvas('vertical');
  const topTexture=edgeCanvas('horizontal');
  const pageMaterial=new THREE.MeshStandardMaterial({map:edgeTexture,roughness:.88,metalness:0});
  const topPageMaterial=new THREE.MeshStandardMaterial({map:topTexture,roughness:.92,metalness:0});
  const parchment=new THREE.MeshStandardMaterial({color:0xf3e4c8,roughness:1});
  // A imagem WebGL precisa autorizar CORS. Nunca tentar textura remota sem CORS:
  // o navegador bloquearia o upload para a GPU e deixaria a capa em branco.
  function loadImage(url,onload,onerror){
    const img=new Image();
    img.decoding='async';
    try{
      const parsed=new URL(url,location.href);
      if(!['data:','blob:'].includes(parsed.protocol) && parsed.origin!==location.origin)
        img.crossOrigin='anonymous';
    }catch{}
    img.onload=()=>onload(img);
    img.onerror=onerror;
    img.src=url;
  }
  function paintPhoto(texture,url,token,spine=false){
    if(!url)return;
    loadImage(url,img=>{
      if(token!==modelGeneration)return;
      const canvas=document.createElement('canvas');
      canvas.width=spine?512:1024;
      canvas.height=spine?1920:1440;
      const ctx=canvas.getContext('2d',{alpha:false});
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.fillStyle='#302016';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      // Preenche a face correspondente. Fotos já recortadas da edição preservam a arte.
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      texture.image=canvas;
      texture.needsUpdate=true;
      queueRender();
    },()=>{
      console.warn('Não foi possível carregar a foto desta face do exemplar.');
    });
  }
  function loadOriginalFront(material,url,token,bookId,onImage){
    if(typeof url!=='string'||!url.trim())return;
    loadImage(url,img=>{
      if(token!==modelGeneration || !img.naturalWidth || !img.naturalHeight)return;
      // A fotografia original é a própria textura WebGL. Não recriamos uma capa
      // marrom nem imprimimos o nome do livro sobre a imagem do PDF.
      const realTexture=new THREE.Texture(img);
      realTexture.colorSpace=THREE.SRGBColorSpace;
      realTexture.anisotropy=maxAniso;
      realTexture.needsUpdate=true;
      const provisional=material.map;
      material.map=realTexture;
      material.needsUpdate=true;
      try {
        try{onImage(img);}catch(error){console.warn('Texturas complementares indisponíveis:',error);}
        if(!shelfPreviewInProgress)resize();
        render();
        provisional?.dispose();
        // Só escondemos o livro CSS depois de o WebGL já ter a capa original.
        stage.classList.add('three-ready');
        window.dispatchEvent(new CustomEvent('aurora:book-ready',{detail:{id:bookId}}));
      } catch(error) {
        material.map=provisional;
        material.needsUpdate=true;
        realTexture.dispose();
        console.warn('A capa original continuará no livro 3D compatível:',error);
      }
    },()=>{
      if(token!==modelGeneration)return;
      console.warn('A imagem original do PDF não pôde ser decodificada pelo 3D.');
      window.dispatchEvent(new CustomEvent('aurora:cover-error',{detail:{id:bookId}}));
    });
  }
  function clearModel(){
    const disposed=new Set();
    while(group.children.length) {
      const child=group.children[0];
      group.remove(child);
      child.traverse(object=>{
        if(object.geometry) object.geometry.dispose();
        if(object.material){
          const materials=Array.isArray(object.material)?object.material:[object.material];
          materials.forEach(mat=>{
            if([parchment,pageMaterial,topPageMaterial].includes(mat)||disposed.has(mat)) return;
            disposed.add(mat);
            if(mat.map && ![edgeTexture,topTexture].includes(mat.map)) mat.map.dispose();
            mat.dispose();
          });
        }
      });
    }
  }
  function makeModel(book){
    clearModel();
    const token=++modelGeneration;
    const height=3.13,width=height*clamp(Number(book.ratio)||.72,.59,.84);
    const thickness=clamp(.25+(Number(book.total||180)/1000),.34,.72);
    shadowMesh.position.set(0,-height/2-.22,-thickness/2-.35);
    shadowMesh.scale.set(width*1.35,.52,1);
    const richDadOpening=isRichDadOpening(book);
    const previewOpening=hasReasonOpening(book)||richDadOpening;
    const titleLeaf=previewOpening?new THREE.MeshStandardMaterial({
      map:canvasTexture(reasonOpeningCanvas('title',richDadOpening)),roughness:.94,metalness:0
    }):parchment;
    const paper=new THREE.Mesh(new THREE.BoxGeometry(width-.12,height-.11,thickness-.075),[
      pageMaterial,pageMaterial,topPageMaterial,topPageMaterial,titleLeaf,parchment
    ]);
    paper.position.x=.04;
    group.add(paper);

    const coverBoard=new THREE.MeshStandardMaterial({color:0x433c36,roughness:.8,metalness:0});
    const trimBoard=new THREE.MeshStandardMaterial({color:0x665449,roughness:.7,metalness:0});
    const coverSurface=canvasTexture(neutralCoverCanvas());
    const frontMaterial=new THREE.MeshPhysicalMaterial({map:coverSurface,roughness:.5,metalness:0,clearcoat:.32,clearcoatRoughness:.3});
    const innerCover=previewOpening?new THREE.MeshStandardMaterial({
      map:canvasTexture(reasonOpeningCanvas('inside')),roughness:.86,metalness:0
    }):coverBoard;
    const faceSides=[coverBoard,coverBoard,trimBoard,coverBoard,frontMaterial,innerCover];
    frontHinge=new THREE.Group();
    frontHinge.position.set(-width/2,0,thickness/2+.028);
    const frontMesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,.052),faceSides);
    frontMesh.position.x=width/2;
    frontHinge.add(frontMesh);
    group.add(frontHinge);

    const backSurface=canvasTexture(neutralCoverCanvas(true));
    const backMaterial=new THREE.MeshPhysicalMaterial({map:backSurface,roughness:.67,metalness:0,clearcoat:.22});
    const backMesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,.055),[
      coverBoard,coverBoard,trimBoard,coverBoard,coverBoard,backMaterial
    ]);
    backMesh.position.z=-thickness/2-.03;
    group.add(backMesh);

    const spineTexture=spineCanvas(book.title||book.name);
    const spineMaterial=new THREE.MeshPhysicalMaterial({map:spineTexture,roughness:.6,metalness:.02,clearcoat:.28});
    shelfSpineMesh=new THREE.Mesh(new THREE.BoxGeometry(.14,height-.02,thickness+.09),[
      coverBoard,spineMaterial,trimBoard,trimBoard,coverBoard,coverBoard
    ]);
    shelfSpineMesh.position.x=-width/2+.015;
    group.add(shelfSpineMesh);

    // Filetes e relevos nas bordas das duas capas.
    [-1,1].forEach(side=>{
      const trim=new THREE.Mesh(new THREE.BoxGeometry(width-.07,.012,.012),trimBoard);
      trim.position.set(0,side*(height/2-.07),thickness/2+.063);
      group.add(trim);
    });

    loadOriginalFront(frontMaterial,book.cover,token,book.id,img=>
      matchEditionSurfaces(img,book,backSurface,spineTexture,coverBoard,trimBoard));
    paintPhoto(backSurface,book.back,token);
    paintPhoto(spineTexture,isIracemaBook(book)?'':book.spine,token,true);
    group.rotation.set(rotation.x,rotation.y,0);
    queueRender();
  }
  function stopMotion(){
    cancelAnimationFrame(requestId);
    cancelAnimationFrame(inertiaId);
    velocityY=0;
  }
  function display(book){
    stopMotion();
    currentBook=book;
    opening=false;
    rotation={x:-.09,y:.28};
    stage.classList.remove('three-ready');
    makeModel(book);
    resize();
  }
  function setPose(x,y){
    if(!currentBook||opening)return;
    cancelAnimationFrame(inertiaId);
    velocityY=0;
    rotation.x=clamp(Number(x)||0,-.85,.85);
    rotation.y=Number(y)||0;
    group.rotation.set(rotation.x,rotation.y,0);
    queueRender();
  }
  function reset(){
    stopMotion();
    opening=false;
    if(frontHinge) frontHinge.rotation.y=0;
    queueRender();
  }
  function playOpen(){
    if(opening || !frontHinge) return;
    cancelAnimationFrame(inertiaId);
    velocityY=0;
    opening=true;
    const start=performance.now();
    const duration=reducedMotion?1:670;
    function frame(now){
      const progress=clamp((now-start)/duration,0,1);
      const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
      frontHinge.rotation.y=-2.5*eased;
      render();
      if(progress<1) requestId=requestAnimationFrame(frame);
      else window.dispatchEvent(new Event('aurora:open-book'));
    }
    requestId=requestAnimationFrame(frame);
  }
  // Guarda velocidade em radianos/milissegundo, independente da taxa de quadros.
  // O limite evita o giro descontrolado após um arraste rápido no celular.
  function startInertia(){
    cancelAnimationFrame(inertiaId);
    let previous=performance.now();
    function frame(now){
      if(opening||down)return;
      const elapsed=clamp(now-previous,1,40);
      previous=now;
      rotation.y+=velocityY*elapsed;
      velocityY*=Math.pow(.87,elapsed/16.67);
      group.rotation.set(rotation.x,rotation.y,0);
      queueRender();
      if(Math.abs(velocityY)>.00012) inertiaId=requestAnimationFrame(frame);
    }
    inertiaId=requestAnimationFrame(frame);
  }
  let pointerStart=null;
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{
    if(!currentBook || opening) return;
    cancelAnimationFrame(inertiaId);
    velocityY=0;
    lastMoveTime=performance.now();
    down={x:event.clientX,y:event.clientY,rx:rotation.x,ry:rotation.y,id:event.pointerId};
    pointerStart={x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!down || event.pointerId!==down.id || opening) return;
    const deltaX=event.clientX-down.x,deltaY=event.clientY-down.y;
    if(Math.abs(deltaX)+Math.abs(deltaY)<3) return;
    const previous=rotation.y;
    rotation.y=down.ry+deltaX*.012;
    rotation.x=clamp(down.rx+deltaY*.005,-.85,.85);
    const now=performance.now();
    const elapsed=clamp(now-lastMoveTime,8,80);
    const instantaneous=clamp((rotation.y-previous)/elapsed,-.008,.008);
    velocityY=clamp(velocityY*.45+instantaneous*.55,-.008,.008);
    lastMoveTime=now;
    group.rotation.set(rotation.x,rotation.y,0);
    queueRender();
  });
  canvas.addEventListener('pointerup',event=>{
    if(!down || event.pointerId!==down.id) return;
    const distance=pointerStart?Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y):100;
    down=null;pointerStart=null;
    if(distance<12){velocityY=0;playOpen();return;}
    if(!reducedMotion && performance.now()-lastMoveTime<80 && Math.abs(velocityY)>.0006)
      startInertia();
    else velocityY=0;
  });
  canvas.addEventListener('pointercancel',()=>{down=null;pointerStart=null;velocityY=0;});
  canvas.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();playOpen();}
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();rotation.y+=(event.key==='ArrowLeft'?-1:1)*.2;
      group.rotation.y=rotation.y;queueRender();
    }
  });
  async function renderShelfPreview(book,options={}){
    if(!book?.cover||currentBook||shelfPreviewInProgress)return '';
    const width=Math.max(96,Math.min(420,Math.round(Number(options.width)||(options.view==='spine'?144:336))));
    const height=Math.max(240,Math.min(820,Math.round(Number(options.height)||(options.view==='spine'?540:448))));
    const previousSize=renderer.getSize(new THREE.Vector2());
    const previousPixelRatio=renderer.getPixelRatio();
    const previousAspect=camera.aspect;
    const previousCameraPosition=camera.position.clone();
    const previousReady=stage.classList.contains('three-ready');
    let generationAtStart=0,timeoutId=0,onReady=null,onSelected=null,previewVisibility=null,previewMesh=null,previewMaterials=null,previewShadowVisible=null;
    shelfPreviewInProgress=true;
    try{
      renderer.setPixelRatio(Math.min(3,Math.max(1,devicePixelRatio||1)));
      renderer.setSize(width,height,false);
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
      const previewBook={...book,id:book.id||'aurora-shelf-preview'};
      const ready=new Promise(resolve=>{
        let settled=false;
        const finish=value=>{
          if(settled)return;
          settled=true;
          clearTimeout(timeoutId);
          resolve(value);
        };
        onReady=event=>{
          if(String(event.detail?.id)===String(previewBook.id))finish(true);
        };
        onSelected=()=>finish(false);
        window.addEventListener('aurora:book-ready',onReady);
        window.addEventListener('aurora:book-selected',onSelected);
        timeoutId=setTimeout(()=>finish(false),7000);
        makeModel(previewBook);
        generationAtStart=modelGeneration;
      });
      const loaded=await ready;
      if(!loaded||modelGeneration!==generationAtStart||currentBook)return '';
      if(options.view==='spine'){
        // Renderiza somente a face texturizada da lombada: as capas e as
        // faces marrons do miolo não entram na imagem transparente da estante.
        previewMesh=shelfSpineMesh;
        if(!previewMesh)return '';
        previewVisibility=group.children.map(child=>[child,child.visible]);
        previewMaterials=previewMesh.material;
        const spineSurface=Array.isArray(previewMaterials)?previewMaterials[1]:previewMaterials;
        previewMesh.material=Array.isArray(previewMaterials)
          ?previewMaterials.map(()=>spineSurface):spineSurface;
        group.children.forEach(child=>{child.visible=child===previewMesh;});
        previewShadowVisible=shadowMesh.visible;
        shadowMesh.visible=false;
        group.rotation.set(0,Math.PI/2,0);
        camera.position.set(0,0,4.9);
        render();
      }
      const pixelWidth=Math.max(1,renderer.domElement.width);
      const pixelHeight=Math.max(1,renderer.domElement.height);
      const target=new THREE.WebGLRenderTarget(pixelWidth,pixelHeight,{
        format:THREE.RGBAFormat,type:THREE.UnsignedByteType,
        depthBuffer:true,stencilBuffer:false
      });
      target.texture.colorSpace=THREE.SRGBColorSpace;
      if(renderer.capabilities.isWebGL2)
        target.samples=Math.min(4,renderer.capabilities.maxSamples||4);
      const previousTarget=renderer.getRenderTarget();
      try{
        renderer.setRenderTarget(target);
        render();
        const pixels=new Uint8Array(pixelWidth*pixelHeight*4);
        renderer.readRenderTargetPixels(target,0,0,pixelWidth,pixelHeight,pixels);
        const imageCanvas=document.createElement('canvas');
        imageCanvas.width=pixelWidth;imageCanvas.height=pixelHeight;
        const imageContext=imageCanvas.getContext('2d',{alpha:true});
        const imageData=imageContext.createImageData(pixelWidth,pixelHeight);
        const rowBytes=pixelWidth*4;
        for(let y=0;y<pixelHeight;y++){
          const sourceStart=(pixelHeight-1-y)*rowBytes;
          imageData.data.set(pixels.subarray(sourceStart,sourceStart+rowBytes),y*rowBytes);
        }
        imageContext.putImageData(imageData,0,0);
        if(options.view==='spine'){
          // Corta só a área transparente ao redor da lombada. Sem esse recorte,
          // o fundo escuro do botão parece uma borda preta em volta do livro.
          let left=pixelWidth,top=pixelHeight,right=-1,bottom=-1;
          for(let y=0;y<pixelHeight;y++){
            for(let x=0;x<pixelWidth;x++){
              if(imageData.data[(y*pixelWidth+x)*4+3]>8){
                if(x<left)left=x;
                if(x>right)right=x;
                if(y<top)top=y;
                if(y>bottom)bottom=y;
              }
            }
          }
          if(right>=left&&bottom>=top){
            const cropWidth=right-left+1,cropHeight=bottom-top+1;
            const cropped=imageContext.createImageData(cropWidth,cropHeight);
            for(let y=0;y<cropHeight;y++){
              const sourceStart=((top+y)*pixelWidth+left)*4;
              const targetStart=y*cropWidth*4;
              cropped.data.set(imageData.data.subarray(sourceStart,sourceStart+cropWidth*4),targetStart);
            }
            const croppedCanvas=document.createElement('canvas');
            croppedCanvas.width=cropWidth;croppedCanvas.height=cropHeight;
            croppedCanvas.getContext('2d',{alpha:true}).putImageData(cropped,0,0);
            return croppedCanvas.toDataURL('image/webp',.97);
          }
        }
        return imageCanvas.toDataURL('image/webp',.97);
      }finally{
        renderer.setRenderTarget(previousTarget);
        target.dispose();
      }
    }catch(error){
      console.warn('Prévia 3D da estante indisponível:',error);
      return '';
    }finally{
      clearTimeout(timeoutId);
      if(onReady)window.removeEventListener('aurora:book-ready',onReady);
      if(onSelected)window.removeEventListener('aurora:book-selected',onSelected);
      const stillOwnsModel=generationAtStart&&modelGeneration===generationAtStart&&!currentBook;
      if(previewVisibility){
        previewVisibility.forEach(([child,visible])=>{
          if(child.parent===group)child.visible=visible;
        });
      }
      if(previewMesh?.parent===group&&previewMaterials)previewMesh.material=previewMaterials;
      if(previewShadowVisible!==null)shadowMesh.visible=previewShadowVisible;
      if(stillOwnsModel){
        clearModel();
        if(!previousReady)stage.classList.remove('three-ready');
      }
      renderer.setPixelRatio(previousPixelRatio);
      renderer.setSize(previousSize.x,previousSize.y,false);
      camera.aspect=previousAspect;
      camera.position.copy(previousCameraPosition);
      camera.updateProjectionMatrix();
      shelfPreviewInProgress=false;
      if(currentBook){resize();render();}
      else if(!previousReady)stage.classList.remove('three-ready');
    }
  }
  window.Aurora3D={display,setPose,reset,playOpen,renderShelfPreview};
  window.addEventListener('aurora:book-selected',event=>display(event.detail));
  window.addEventListener('aurora:book-closed',()=>{
    stopMotion();
    currentBook=null;
    opening=false;
    clearModel();
    stage.classList.remove('three-ready');
  });
  if(window.__auroraSelectedBook) display(window.__auroraSelectedBook);
  resize();
  window.dispatchEvent(new Event('aurora:3d-ready'));
}
