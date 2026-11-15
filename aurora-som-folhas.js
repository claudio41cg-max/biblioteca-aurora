/* Som discreto de papel, sintetizado no aparelho. Não baixa arquivos de áudio. */
(() => {
  'use strict';
  const key='aurora-page-sound-enabled';
  let context=null,noise=null,lastPlayed=-1;
  const enabled=()=>{
    try{return localStorage.getItem(key)!=='false';}catch{return true;}
  };
  function setEnabled(value){
    try{localStorage.setItem(key,String(Boolean(value)));}catch{}
    document.querySelectorAll('[data-page-sound]').forEach(input=>input.checked=Boolean(value));
  }
  function unlock(){
    if(!enabled())return;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      if(!context)context=new Audio();
      if(context.state==='suspended')context.resume().catch(()=>{});
    }catch{}
  }
  function play(){
    if(!enabled())return;
    unlock();
    if(!context||context.state!=='running')return;
    const now=context.currentTime;
    if(now-lastPlayed<.13)return;
    lastPlayed=now;
    try{
      if(!noise){
        noise=context.createBuffer(1,Math.ceil(context.sampleRate*.38),context.sampleRate);
        const samples=noise.getChannelData(0);
        let previous=0;
        for(let i=0;i<samples.length;i++){
          const white=Math.random()*2-1;
          previous=(previous*.28)+(white*.72);
          samples[i]=previous;
        }
      }
      for(const [delay,gainValue,speed] of [[0,.024,.93],[.095,.016,1.22]]){
        const source=context.createBufferSource();
        source.buffer=noise;
        source.playbackRate.value=speed;
        const filter=context.createBiquadFilter();
        filter.type='bandpass';filter.frequency.value=1250;filter.Q.value=.6;
        const volume=context.createGain();
        const start=now+delay;
        volume.gain.setValueAtTime(.0001,start);
        volume.gain.exponentialRampToValueAtTime(gainValue,start+.035);
        volume.gain.exponentialRampToValueAtTime(.0001,start+.23);
        source.connect(filter);filter.connect(volume);volume.connect(context.destination);
        source.start(start);source.stop(start+.25);
      }
    }catch(error){console.warn('Som de folhas indisponível:',error);}
  }
  document.addEventListener('pointerdown',unlock,{passive:true});
  document.addEventListener('keydown',unlock);
  document.addEventListener('change',event=>{
    if(event.target.matches?.('[data-page-sound]'))setEnabled(event.target.checked);
  });
  const sync=()=>document.querySelectorAll('[data-page-sound]').forEach(input=>input.checked=enabled());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});
  else sync();
  window.AuroraPageSound={play,unlock,enabled,setEnabled};
})();
