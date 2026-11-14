/* Reprodutor local de MP3, M4A e M4B, com continuação por posição. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const audio=$('audio'),seek=$('audioSeek');
  const id=new URLSearchParams(location.search).get('livro');
  const formats=window.AuroraFormats;
  let url='',book=null,lastSaved=0;
  const status=text=>$('audioStatus').textContent=text;
  const time=value=>{
    const seconds=Math.max(0,Math.floor(Number(value)||0));
    const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
    return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(s).padStart(2,'0');
  };
  const sync=()=>{
    if(Number.isFinite(audio.duration)){
      seek.max=String(audio.duration);seek.value=String(audio.currentTime||0);
      $('duration').textContent=time(audio.duration);
    }
    $('elapsed').textContent=time(audio.currentTime);
    $('play').textContent=audio.paused?'▶':'Ⅱ';
    $('play').setAttribute('aria-label',audio.paused?'Reproduzir':'Pausar');
  };
  const save=force=>{
    if(!book||(!force&&Date.now()-lastSaved<3500))return;
    lastSaved=Date.now();
    formats.saveRecord('progress',{id:book.id,seconds:audio.currentTime||0,
      percent:Number.isFinite(audio.duration)&&audio.duration?Math.floor(audio.currentTime/audio.duration*100):0,
      updated:Date.now()}).catch(console.warn);
  };
  $('play').addEventListener('click',async()=>{
    if(!audio.src)return;
    if(!audio.paused){audio.pause();return;}
    try{await audio.play();}catch(error){status('Não foi possível iniciar o áudio: '+error.message);}
  });
  $('skipBack').addEventListener('click',()=>{audio.currentTime=Math.max(0,audio.currentTime-15);sync();save(true);});
  $('skipAhead').addEventListener('click',()=>{audio.currentTime=Math.min(Number.isFinite(audio.duration)?audio.duration:Infinity,audio.currentTime+15);sync();save(true);});
  $('speed').addEventListener('change',event=>{audio.playbackRate=Number(event.target.value);try{localStorage.setItem('aurora-audio-speed',event.target.value);}catch{}});
  seek.addEventListener('change',event=>{if(Number.isFinite(audio.duration)){audio.currentTime=Number(event.target.value);save(true);}});
  ['timeupdate','loadedmetadata','play','pause','ended','seeked'].forEach(event=>audio.addEventListener(event,()=>{
    sync();if(event==='timeupdate')save(false);if(event==='pause'||event==='ended'||event==='seeked')save(true);
  }));
  audio.addEventListener('error',()=>status('O formato de áudio não é compatível com este navegador. Experimente um arquivo MP3.'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)save(true);});
  window.addEventListener('pagehide',()=>{save(true);if(url)URL.revokeObjectURL(url);});
  (async()=>{
    try{
      if(!id)throw new Error('Nenhum audiolivro foi selecionado.');
      book=await formats.readRecord('books',id);
      if(!book||book.format!=='audio')throw new Error('O audiolivro não foi encontrado neste aparelho.');
      $('audioTitle').textContent=book.name;
      $('audioAuthor').textContent=book.author?'por '+book.author:'';
      if(book.cover){$('audioCover').src=book.cover;$('audioCover').hidden=false;$('audioPlaceholder').hidden=true;}
      url=URL.createObjectURL(new Blob([book.data],{type:book.mime||'audio/mpeg'}));
      audio.src=url;
      const speed=Number(localStorage.getItem('aurora-audio-speed'))||1;
      if(Array.from($('speed').options).some(option=>Number(option.value)===speed)){$('speed').value=String(speed);audio.playbackRate=speed;}
      const saved=await formats.readRecord('progress',id).catch(()=>null);
      audio.addEventListener('loadedmetadata',()=>{
        if(Number.isFinite(saved?.seconds)&&saved.seconds>0&&saved.seconds<audio.duration-1){audio.currentTime=saved.seconds;status('Continuando de onde você parou: '+time(saved.seconds)+'.');}
        else status('Pronto para ouvir. Seu progresso será salvo automaticamente.');
        sync();
      },{once:true});
      audio.load();
    }catch(error){status('Não foi possível abrir o audiolivro: '+error.message);}
  })();
})();
