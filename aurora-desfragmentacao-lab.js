/* Laboratório integrado: usa o mesmo visor WebGL e o mesmo livro 3D da Aurora.
   O exemplar de demonstração existe apenas em memória e nunca entra no acervo. */
(()=> {
  'use strict';
  const $=id=>document.getElementById(id);
  const showcase=$('auroraShowcase'),tools=document.querySelector('.library-tools');
  if(!showcase||!tools||document.getElementById('auroraLabLaunch'))return;

  const style=document.createElement('style');
  style.textContent=`
    .aurora-lab-launch{
      border:1px solid rgba(218,190,139,.5);border-radius:999px;padding:9px 13px;
      background:linear-gradient(145deg,#34564d,#1c3834);color:#f4dfb8;
      font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 4px 13px #0002
    }
    .aurora-lab-launch:focus-visible,.aurora-desintegration-lab button:focus-visible,
    .aurora-desintegration-lab input:focus-visible{outline:2px solid #e8c58b;outline-offset:3px}
    .aurora-lab-demo .aurora-book-actions,
    .aurora-lab-demo .aurora-show-description{display:none!important}
    .aurora-desintegration-lab{
      width:min(620px,calc(100% - 26px));margin:8px auto 20px;padding:15px 16px;
      border:1px solid rgba(206,173,119,.34);border-radius:17px;
      background:linear-gradient(150deg,rgba(26,48,43,.96),rgba(11,27,27,.97));
      color:#f3e6cf;box-shadow:0 12px 30px #0003;font-family:system-ui,sans-serif
    }
    .aurora-desintegration-lab[hidden]{display:none!important}
    .aurora-lab-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:5px}
    .aurora-lab-heading strong{font:600 14px Georgia,serif;color:#f0d7a9}
    .aurora-lab-heading small{font-size:10px;color:#b7c2b8}
    .aurora-lab-description{margin:0 0 13px;color:#c3c9be;font-size:11px;line-height:1.45}
    .aurora-lab-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin:10px 0}
    .aurora-lab-row label{font-size:12px;color:#e3d7c4}
    .aurora-lab-row output{font-size:12px;color:#e6c38b;font-variant-numeric:tabular-nums}
    .aurora-lab-row input[type=range]{grid-column:1/-1;width:100%;accent-color:#c69a5e}
    .aurora-lab-toggles{display:flex;flex-wrap:wrap;gap:15px;margin:12px 0}
    .aurora-lab-toggles label{display:flex;align-items:center;gap:7px;color:#d6d7ca;font-size:11px}
    .aurora-lab-toggles input{accent-color:#c69a5e}
    .aurora-lab-actions{display:flex;gap:9px;align-items:center}
    .aurora-lab-actions button{min-height:42px;border-radius:11px;padding:9px 15px;font:600 12px system-ui,sans-serif}
    #auroraLabRun{flex:1;border:1px solid #d7b579;background:linear-gradient(180deg,#c59b61,#8a653c);color:#fff4df}
    #auroraLabRun:disabled{opacity:.55}
    #auroraLabStatus{min-height:20px;margin:11px 0 0;color:#ddcba8;font-size:11px;line-height:1.45}
    .aurora-lab-note{margin:7px 0 0;color:#9faea5;font-size:10px;line-height:1.4}
    @media(max-width:430px){.aurora-lab-heading{align-items:flex-start;flex-direction:column;gap:3px}.aurora-lab-toggles{gap:11px}}
  `;
  document.head.append(style);

  const launch=document.createElement('button');
  launch.type='button';launch.id='auroraLabLaunch';launch.className='aurora-lab-launch';
  launch.textContent='✦ Testar desfragmentação 3D';
  launch.setAttribute('aria-label','Abrir livro temporário no visor 3D para testar a desfragmentação');
  tools.append(launch);

  const actions=showcase.querySelector('.aurora-book-actions');
  const panel=document.createElement('section');
  panel.id='auroraDesintegrationLab';panel.className='aurora-desintegration-lab';
  panel.hidden=true;
  panel.setAttribute('aria-label','Controles do laboratório de desfragmentação');
  panel.innerHTML=`
    <div class="aurora-lab-heading">
      <strong>Laboratório de desfragmentação</strong>
      <small>Exemplar temporário • sem exclusão do acervo</small>
    </div>
    <p class="aurora-lab-description">Este é o mesmo visor 3D usado pelos livros da sua estante. A animação é executada sobre a captura do volume real, mantendo perspectiva, iluminação, lombada e espessura.</p>
    <div class="aurora-lab-row">
      <label for="auroraLabFragmentSize">Tamanho dos quadradinhos</label>
      <output id="auroraLabFragmentValue" for="auroraLabFragmentSize">1,45×</output>
      <input id="auroraLabFragmentSize" type="range" min="1.2" max="1.8" step="0.05" value="1.45">
    </div>
    <div class="aurora-lab-toggles">
      <label><input id="auroraLabSound" type="checkbox" checked> Som da desfragmentação</label>
      <label><input id="auroraLabVibration" type="checkbox" checked> Vibração suave</label>
    </div>
    <div class="aurora-lab-actions">
      <button id="auroraLabRun" type="button">Executar desfragmentação</button>
    </div>
    <p id="auroraLabStatus" role="status" aria-live="polite">O livro de teste permanece no visor e reaparece ao final de cada execução.</p>
    <p class="aurora-lab-note">O exemplar é criado somente em memória. Não é salvo, importado, retirado nem excluído do seu acervo.</p>
  `;
  if(actions)actions.after(panel);else showcase.append(panel);

  const scene=$('scene'),cssBook=$('book3d'),back=$('auroraShowBack');
  const run=$('auroraLabRun'),slider=$('auroraLabFragmentSize'),value=$('auroraLabFragmentValue');
  const sound=$('auroraLabSound'),vibration=$('auroraLabVibration'),status=$('auroraLabStatus');
  let busy=false,stopSound=null,stopVibration=null;

  function drawCover(backSide=false){
    const c=document.createElement('canvas');c.width=900;c.height=1320;
    const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,900,1320);
    g.addColorStop(0,backSide?'#243c37':'#31554a');
    g.addColorStop(.55,'#183630');g.addColorStop(1,'#0c2224');
    x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
    for(let i=0;i<34;i++){
      x.strokeStyle='rgba(218,190,137,'+(.025+(i%4)*.009)+')';x.lineWidth=1;
      x.beginPath();x.moveTo(50,70+i*35);x.lineTo(850,70+i*35);x.stroke();
    }
    x.strokeStyle='#c9a66d';x.lineWidth=5;x.strokeRect(38,38,824,1244);
    x.strokeStyle='rgba(240,220,178,.55)';x.lineWidth=2;x.strokeRect(57,57,786,1206);
    x.textAlign='center';
    if(!backSide){
      x.beginPath();x.arc(450,335,92,0,Math.PI*2);x.strokeStyle='#d7b77e';x.lineWidth=4;x.stroke();
      x.beginPath();x.moveTo(450,245);x.lineTo(450,425);x.moveTo(360,335);x.lineTo(540,335);x.stroke();
      x.fillStyle='#e6d4ae';x.font='600 42px Georgia,serif';x.fillText('BIBLIOTECA AURORA',450,555);
      x.fillStyle='#f5e7c8';x.font='bold 88px Georgia,serif';x.fillText('LIVRO DE',450,700);x.fillText('TESTE',450,800);
      x.fillStyle='#d7b77e';x.font='italic 36px Georgia,serif';x.fillText('Desfragmentação 3D',450,905);
      x.strokeStyle='rgba(220,190,137,.8)';x.lineWidth=2;x.beginPath();x.moveTo(190,1000);x.lineTo(710,1000);x.stroke();
      x.fillStyle='#cdbb99';x.font='24px system-ui,sans-serif';x.fillText('EDIÇÃO DE LABORATÓRIO',450,1070);
    }else{
      x.fillStyle='#e5d3ad';x.font='600 40px Georgia,serif';x.fillText('BIBLIOTECA AURORA',450,220);
      x.fillStyle='#cbb994';x.font='26px Georgia,serif';x.fillText('Exemplar temporário para',450,380);
      x.fillText('testes visuais da desfragmentação.',450,425);
      x.fillStyle='#d7b77e';x.font='italic 28px Georgia,serif';x.fillText('Não pertence ao acervo',450,1110);
    }
    return c.toDataURL('image/webp',.96);
  }
  function drawSpine(){
    const c=document.createElement('canvas');c.width=360;c.height=1500;
    const x=c.getContext('2d'),g=x.createLinearGradient(0,0,c.width,0);
    g.addColorStop(0,'#0e2522');g.addColorStop(.45,'#c29a5d');g.addColorStop(.7,'#345448');g.addColorStop(1,'#102521');
    x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
    x.strokeStyle='#e0c18a';x.lineWidth=5;x.strokeRect(18,18,324,1464);
    x.save();x.translate(180,750);x.rotate(-Math.PI/2);
    x.fillStyle='#f4e3bf';x.textAlign='center';x.font='600 45px Georgia,serif';
    x.fillText('LIVRO DE TESTE • AURORA',0,14);x.restore();
    return c.toDataURL('image/webp',.94);
  }
  function createDemoBook(){
    return {
      id:'aurora-lab-demo-v114',
      name:'Livro de teste Aurora',
      title:'Livro de teste Aurora',
      author:'Laboratório visual da Biblioteca Aurora',
      description:'Exemplar temporário criado exclusivamente para avaliar a desfragmentação.',
      country:'Biblioteca Aurora',year:'—',category:'ficcao',
      format:'demo',coverSource:'generated',
      cover:drawCover(false),back:drawCover(true),spine:drawSpine(),
      spineAspect:.14,ratio:.69,total:180
    };
  }

  function startSound(){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return null;
    let context;
    try{
      context=new AudioContext();
      const now=context.currentTime,duration=8.7;
      const master=context.createGain();master.gain.setValueAtTime(.0001,now);
      master.gain.linearRampToValueAtTime(.15,now+.45);
      master.gain.setValueAtTime(.12,now+5.9);
      master.gain.exponentialRampToValueAtTime(.0001,now+duration);
      master.connect(context.destination);

      const length=Math.floor(context.sampleRate*duration);
      const buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<length;i++){
        const t=i/context.sampleRate;
        const fade=Math.min(1,t/.35,(duration-t)/1.1);
        const grains=.52+.24*Math.sin(t*2*Math.PI*5.2)+.13*Math.sin(t*2*Math.PI*12.5);
        data[i]=(Math.random()*2-1)*Math.max(0,fade)*grains;
      }
      const noise=context.createBufferSource();noise.buffer=buffer;
      const high=context.createBiquadFilter();high.type='highpass';high.frequency.setValueAtTime(105,now);
      const low=context.createBiquadFilter();low.type='lowpass';low.frequency.setValueAtTime(1650,now);low.frequency.exponentialRampToValueAtTime(430,now+duration);
      noise.connect(high).connect(low).connect(master);noise.start(now);noise.stop(now+duration);

      const rumble=context.createOscillator(),rumbleGain=context.createGain();
      rumble.type='triangle';rumble.frequency.setValueAtTime(68,now);rumble.frequency.exponentialRampToValueAtTime(34,now+duration);
      rumbleGain.gain.setValueAtTime(.0001,now);rumbleGain.gain.linearRampToValueAtTime(.022,now+.6);
      rumbleGain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      rumble.connect(rumbleGain).connect(master);rumble.start(now);rumble.stop(now+duration);

      const crackleLength=Math.floor(context.sampleRate*.055);
      const crackleBuffer=context.createBuffer(1,crackleLength,context.sampleRate);
      const crackleData=crackleBuffer.getChannelData(0);
      for(let i=0;i<crackleLength;i++)crackleData[i]=(Math.random()*2-1)*(1-i/crackleLength);
      for(let i=0;i<22;i++){
        const when=now+.35+Math.random()*7.5;
        const pop=context.createBufferSource();pop.buffer=crackleBuffer;
        const band=context.createBiquadFilter();band.type='bandpass';band.frequency.value=750+Math.random()*1750;band.Q.value=.85;
        const gain=context.createGain();gain.gain.setValueAtTime(.0001,when);
        gain.gain.linearRampToValueAtTime(.16,when+.006);gain.gain.exponentialRampToValueAtTime(.0001,when+.06);
        pop.connect(band).connect(gain).connect(master);pop.start(when);pop.stop(when+.07);
      }
      context.resume?.().catch(()=>{});
      return ()=>{
        try{const t=context.currentTime;master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(.0001,t,.035);}catch{}
        setTimeout(()=>{try{context.close();}catch{}},180);
      };
    }catch(error){
      try{context?.close();}catch{}
      console.warn('Som da desfragmentação indisponível:',error);
      return null;
    }
  }

  function startVibration(){
    if(typeof navigator.vibrate!=='function')return null;
    const pulse=(pattern)=>{try{navigator.vibrate(pattern);}catch{}};
    pulse([10,42,8]);
    const timers=[
      setTimeout(()=>pulse([8,48,8]),2450),
      setTimeout(()=>pulse([10,54,8]),5050),
      setTimeout(()=>pulse([8,38,8]),7200)
    ];
    return ()=>{
      timers.forEach(clearTimeout);
      try{navigator.vibrate(0);}catch{}
    };
  }

  function cleanup(){
    stopSound?.();stopSound=null;
    stopVibration?.();stopVibration=null;
    busy=false;run.disabled=false;slider.disabled=false;sound.disabled=false;vibration.disabled=false;
    showcase.classList.remove('aurora-lab-demo');
    panel.hidden=true;
  }

  async function runTest(){
    if(busy||!showcase.classList.contains('aurora-lab-demo'))return;
    const shot=window.AuroraBookActions?.capture(scene,cssBook);
    if(!shot){
      status.textContent='Não consegui capturar o volume 3D. Aguarde o livro terminar de carregar e tente novamente.';
      return;
    }
    shot.cinematic=true;
    shot.fragmentScale=Number(slider.value)||1.45;
    shot.fragmentCountScale=1.12;
    shot.dustScale=1.12;

    busy=true;run.disabled=true;slider.disabled=true;sound.disabled=true;vibration.disabled=true;
    status.textContent='Desfragmentando o livro 3D… os fragmentos e a poeira estão acompanhando a erosão.';
    if(sound.checked){
      stopSound=startSound();
      if(!stopSound)status.textContent='Som indisponível neste navegador. A animação continuará normalmente.';
    }
    if(vibration.checked){
      stopVibration=startVibration();
      if(!stopVibration)status.textContent='Vibração não disponível neste navegador. A animação continuará normalmente.';
    }
    try{
      await window.AuroraBookParticles?.play(shot);
      status.textContent='Teste concluído. O mesmo livro 3D continua no visor; nenhum item do acervo foi alterado.';
    }catch(error){
      console.warn('Falha no laboratório de desfragmentação:',error);
      status.textContent='A animação foi interrompida. O livro de teste continua preservado.';
    }finally{
      stopSound?.();stopSound=null;stopVibration?.();stopVibration=null;
      busy=false;run.disabled=false;slider.disabled=false;sound.disabled=false;vibration.disabled=false;
    }
  }

  slider.addEventListener('input',()=>{value.value=Number(slider.value).toFixed(2).replace('.',',')+'×';});
  run.addEventListener('click',runTest);
  launch.addEventListener('click',()=>{
    if(!window.AuroraShelfViewer?.open){
      status.textContent='O visor 3D ainda está carregando. Aguarde alguns segundos e tente novamente.';
      return;
    }
    panel.hidden=false;showcase.classList.add('aurora-lab-demo');
    status.textContent='Abrindo o livro temporário no mesmo visor 3D da estante…';
    window.AuroraShelfViewer.open(launch,createDemoBook());
  });

  // O livro de teste não abre o leitor quando alguém toca na capa.
  window.addEventListener('aurora:open-book',event=>{
    if(!showcase.classList.contains('aurora-lab-demo'))return;
    event.preventDefault();event.stopImmediatePropagation();
    window.Aurora3D?.reset?.();
    status.textContent='Este exemplar é somente para teste. Use “Executar desfragmentação” abaixo.';
  },true);
  window.addEventListener('aurora:book-closed',cleanup);
})();
