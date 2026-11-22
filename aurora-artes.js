/* Imagens da encadernação fornecidas pela própria edição. */
(() => {
  'use strict';
  function face(label) {
    const words = String(label || '').split('/').pop().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if (/\b(?:back|front) *matter\b/.test(words)) return '';
    if (/\b(?:full *cover|cover *spread|wrap *around|dust *jacket|capa *aberta|capa *completa|sobrecapa)\b/.test(words)) return 'wrap';
    if (/\b(?:spine|lombada|dorso)(?: *image)?\d*\b/.test(words)) return 'spine';
    if (/\b(?:back *cover|rear *cover|cover *back|back|contra *capa|quarta *capa|capa *(?:verso|traseira))(?: *image)?\d*\b/.test(words)) return 'back';
    if (/\b(?:front *cover|cover *front|frente|front|cover|capa)(?: *image)?\d*\b/.test(words)) return 'cover';
    return '';
  }
  const mime = name => ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',avif:'image/avif',svg:'image/svg+xml'})[String(name).split('.').pop().toLowerCase()];
  async function decode(src) {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  }
  async function spineArt(src) {
    if (!src) return {};
    const img = await decode(src);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (h >= w) return {spine:src, spineAspect:w/h};
    const canvas = document.createElement('canvas');
    canvas.width = h; canvas.height = w;
    const ctx = canvas.getContext('2d');
    ctx.translate(0,w); ctx.rotate(-Math.PI/2); ctx.drawImage(img,0,0);
    return {spine:canvas.toDataURL('image/png'), spineAspect:h/w};
  }
  // A largura de cada capa vem do formato medido do miolo ou de uma face avulsa.
  // Uma página dupla comum tem largura residual zero e não contém uma lombada.
  function spineFraction(spreadRatio, panelRatio) {
    const fraction = spreadRatio - 2 * panelRatio;
    return panelRatio >= .45 && panelRatio <= .90 && fraction >= .02 && fraction <= .22 ? fraction : 0;
  }
  // Em sobrecapas sem formato do miolo, aceita apenas duas dobras visíveis,
  // simétricas e contínuas na maior parte da altura.
  function measuredPanel(img) {
    const w=Math.min(1000,img.naturalWidth), h=48;
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0,w,h);
    const pixels=ctx.getImageData(0,0,w,h).data;
    function fold(x){
      let strong=0,total=0;
      for(let y=3;y<h-3;y++){
        const i=(y*w+x)*4;
        const diff=Math.max(...[0,1,2].map(c=>Math.abs(pixels[i+c]-pixels[i-4+c])));
        if(diff>=16)strong++;
        total+=diff;
      }
      return strong>=(h-6)*.72?total/(h-6):0;
    }
    let score=0,cut=0;
    for(let x=Math.ceil(w*.39);x<w*.495;x++){
      const strength=Math.min(fold(x),fold(w-x));
      if(strength>score){score=strength;cut=x;}
    }
    return cut/w*img.naturalWidth/img.naturalHeight;
  }
  async function splitWrap(src, panelRatio, rtl=false) {
    const img = await decode(src);
    if (!panelRatio) panelRatio=measuredPanel(img);
    if (!spineFraction(img.naturalWidth/img.naturalHeight,panelRatio)) return {};
    const panel = Math.round(img.naturalHeight*panelRatio);
    const strip = img.naturalWidth - panel*2;
    const crop = (x,width) => {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img,x,0,width,canvas.height,0,0,width,canvas.height);
      return canvas.toDataURL('image/png');
    };
    return {cover:crop(rtl?0:panel+strip,panel),back:crop(rtl?panel+strip:0,panel),
      spine:crop(panel,strip),spineAspect:strip/img.naturalHeight,ratio:panelRatio};
  }
  window.AuroraEditionArt = {face,mime,decode,spineArt,spineFraction,splitWrap};
})();
