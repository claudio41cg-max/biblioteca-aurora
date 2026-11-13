/* Livro físico em WebGL: capa, contracapa, lombada e miolo são faces distintas.
   A capa original do PDF é aplicada somente à FRENTE; nunca fica espelhada no verso. */
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
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.35;
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

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,1,.1,80);
  // Distância constante: rolar a página não pode ampliar ou reduzir o exemplar.
  camera.position.set(0,.08,6.4);
  scene.add(new THREE.HemisphereLight(0xffedce,0x281d16,2.5));
  const key=new THREE.DirectionalLight(0xffebc9,3.1);
  key.position.set(-3.5,5,6);
  scene.add(key);
  const rim=new THREE.DirectionalLight(0xb8d8d1,1.5);
  rim.position.set(4,1.6,-3);
  scene.add(rim);
  const group=new THREE.Group();
  scene.add(group);

  let currentBook=null,frontHinge=null,down=null,rotation={x:-.09,y:.28},opening=false,modelGeneration=0;
  let scheduled=false,requestId=0;
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
    texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    return texture;
  }
  function neutralCoverCanvas(back=false){
    const canvas=document.createElement('canvas');
    canvas.width=512;canvas.height=720;
    const ctx=canvas.getContext('2d');
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
  function edgeCanvas(){
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=512;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f1dfc1';ctx.fillRect(0,0,256,512);
    for(let y=0;y<512;y+=3){
      ctx.fillStyle=y%9===0?'#ae9877':'#d7c3a4';
      ctx.fillRect(0,y,256,1);
    }
    const gradient=ctx.createLinearGradient(0,0,256,0);
    gradient.addColorStop(0,'#987c57a8');
    gradient.addColorStop(.18,'#ffffff00');
    gradient.addColorStop(.84,'#fff5d030');
    gradient.addColorStop(1,'#8c6f4d7f');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,256,512);
    return canvasTexture(canvas);
  }
  function spineCanvas(name){
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=960;
    const ctx=canvas.getContext('2d');
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
  const edgeTexture=edgeCanvas();
  const pageMaterial=new THREE.MeshStandardMaterial({map:edgeTexture,roughness:1,metalness:0});
  const parchment=new THREE.MeshStandardMaterial({color:0xf3e4c8,roughness:1});
  function paintPhoto(texture,url,token,spine=false){
    if(!url)return;
    const img=new Image();
    img.onload=()=>{
      if(token!==modelGeneration)return;
      const canvas=document.createElement('canvas');
      canvas.width=spine?320:768;
      canvas.height=spine?1200:1080;
      const ctx=canvas.getContext('2d',{alpha:false});
      ctx.fillStyle='#302016';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      // Preenche a face correspondente. Fotos já recortadas da edição preservam a arte.
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      texture.image=canvas;
      texture.needsUpdate=true;
      queueRender();
    };
    img.onerror=()=>{
      console.warn('Não foi possível carregar a foto desta face do exemplar.');
      if(!spine && url===currentBook?.cover)
        window.dispatchEvent(new CustomEvent('aurora:cover-error',{detail:{id:currentBook.id}}));
    };
    img.src=url;
  }
  function loadOriginalFront(material,url,token,bookId,onImage){
    if(typeof url!=='string'||!url.trim())return;
    const img=new Image();
    img.decoding='async';
    img.onload=()=>{
      if(token!==modelGeneration || !img.naturalWidth || !img.naturalHeight)return;
      // A fotografia original é a própria textura WebGL. Não recriamos uma capa
      // marrom nem imprimimos o nome do livro sobre a imagem do PDF.
      const realTexture=new THREE.Texture(img);
      realTexture.colorSpace=THREE.SRGBColorSpace;
      realTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
      realTexture.needsUpdate=true;
      const provisional=material.map;
      material.map=realTexture;
      material.needsUpdate=true;
      try {
        try{onImage(img);}catch(error){console.warn('Texturas complementares indisponíveis:',error);}
        resize();
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
    };
    img.onerror=()=>{
      if(token!==modelGeneration)return;
      console.warn('A imagem original do PDF não pôde ser decodificada pelo 3D.');
      window.dispatchEvent(new CustomEvent('aurora:cover-error',{detail:{id:bookId}}));
    };
    img.src=url;
  }
  function clearModel(){
    while(group.children.length) {
      const child=group.children[0];
      group.remove(child);
      child.traverse(object=>{
        if(object.geometry) object.geometry.dispose();
        if(object.material){
          const materials=Array.isArray(object.material)?object.material:[object.material];
          materials.forEach(mat=>{
            if([parchment,pageMaterial].includes(mat)) return;
            if(mat.map && mat.map!==edgeTexture) mat.map.dispose();
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
    const paper=new THREE.Mesh(new THREE.BoxGeometry(width-.12,height-.11,thickness-.075),[
      pageMaterial,pageMaterial,pageMaterial,pageMaterial,parchment,parchment
    ]);
    paper.position.x=.04;
    group.add(paper);

    const coverBoard=new THREE.MeshStandardMaterial({color:0x433c36,roughness:.8,metalness:0});
    const trimBoard=new THREE.MeshStandardMaterial({color:0x665449,roughness:.7,metalness:0});
    const coverSurface=canvasTexture(neutralCoverCanvas());
    const frontMaterial=new THREE.MeshPhysicalMaterial({map:coverSurface,roughness:.56,metalness:0,clearcoat:.28,clearcoatRoughness:.34});
    const faceSides=[coverBoard,coverBoard,trimBoard,coverBoard,frontMaterial,coverBoard];
    frontHinge=new THREE.Group();
    frontHinge.position.set(-width/2,0,thickness/2+.028);
    const frontMesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,.052),faceSides);
    frontMesh.position.x=width/2;
    frontHinge.add(frontMesh);
    group.add(frontHinge);

    const backSurface=canvasTexture(neutralCoverCanvas(true));
    const backMaterial=new THREE.MeshPhysicalMaterial({map:backSurface,roughness:.71,metalness:0,clearcoat:.18});
    const backMesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,.055),[
      coverBoard,coverBoard,trimBoard,coverBoard,coverBoard,backMaterial
    ]);
    backMesh.position.z=-thickness/2-.03;
    group.add(backMesh);

    const spineTexture=spineCanvas(book.name);
    const spineMaterial=new THREE.MeshPhysicalMaterial({map:spineTexture,roughness:.65,metalness:.02,clearcoat:.24});
    const spineMesh=new THREE.Mesh(new THREE.BoxGeometry(.14,height-.02,thickness+.09),[
      coverBoard,spineMaterial,trimBoard,trimBoard,coverBoard,coverBoard
    ]);
    spineMesh.position.x=-width/2+.015;
    group.add(spineMesh);

    // Filetes e relevos nas bordas das duas capas.
    [-1,1].forEach(side=>{
      const trim=new THREE.Mesh(new THREE.BoxGeometry(width-.07,.012,.012),trimBoard);
      trim.position.set(0,side*(height/2-.07),thickness/2+.063);
      group.add(trim);
    });

    loadOriginalFront(frontMaterial,book.cover,token,book.id,img=>
      matchEditionSurfaces(img,book,backSurface,spineTexture,coverBoard,trimBoard));
    paintPhoto(backSurface,book.back,token);
    paintPhoto(spineTexture,book.spine,token,true);
    group.rotation.set(rotation.x,rotation.y,0);
    queueRender();
  }
  function display(book){
    currentBook=book;
    opening=false;
    rotation={x:-.09,y:.28};
    stage.classList.remove('three-ready');
    makeModel(book);
    resize();
  }
  function setPose(x,y){
    if(!currentBook||opening)return;
    rotation.x=clamp(Number(x)||0,-.85,.85);
    rotation.y=Number(y)||0;
    group.rotation.set(rotation.x,rotation.y,0);
    queueRender();
  }
  function reset(){
    opening=false;
    if(frontHinge) frontHinge.rotation.y=0;
    queueRender();
  }
  function playOpen(){
    if(opening || !frontHinge) return;
    opening=true;
    const start=performance.now();
    const duration=420;
    function frame(now){
      const progress=clamp((now-start)/duration,0,1);
      const eased=1-Math.pow(1-progress,3);
      frontHinge.rotation.y=-2.5*eased;
      render();
      if(progress<1) requestId=requestAnimationFrame(frame);
      else window.dispatchEvent(new Event('aurora:open-book'));
    }
    requestId=requestAnimationFrame(frame);
  }
  let pointerStart=null;
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',event=>{
    if(!currentBook || opening) return;
    down={x:event.clientX,y:event.clientY,rx:rotation.x,ry:rotation.y,id:event.pointerId};
    pointerStart={x:event.clientX,y:event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!down || event.pointerId!==down.id || opening) return;
    const deltaX=event.clientX-down.x,deltaY=event.clientY-down.y;
    if(Math.abs(deltaX)+Math.abs(deltaY)<3) return;
    rotation.y=down.ry+deltaX*.012;
    rotation.x=clamp(down.rx+deltaY*.005,-.85,.85);
    group.rotation.set(rotation.x,rotation.y,0);
    queueRender();
  });
  canvas.addEventListener('pointerup',event=>{
    if(!down || event.pointerId!==down.id) return;
    const distance=pointerStart?Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y):100;
    down=null;pointerStart=null;
    if(distance<12) playOpen();
  });
  canvas.addEventListener('pointercancel',()=>{down=null;pointerStart=null;});
  canvas.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();playOpen();}
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();rotation.y+=(event.key==='ArrowLeft'?-1:1)*.2;
      group.rotation.y=rotation.y;queueRender();
    }
  });
  window.Aurora3D={display,setPose,reset,playOpen};
  window.addEventListener('aurora:book-selected',event=>display(event.detail));
  if(window.__auroraSelectedBook) display(window.__auroraSelectedBook);
  resize();
}
