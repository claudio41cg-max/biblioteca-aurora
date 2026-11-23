/* Painel de ajustes e seleção dos exemplares durante uma edição da estante. */
(() => {
  'use strict';
  const scene = document.getElementById('shelfScene');
  if (!scene) return;
  const canvas = scene.closest('.shelf-canvas');
  const selector = '.editor-book-row > [data-personal-book-key]';
  const choices = {
    height:[['original','Original'],['bolso','Bolso','17,5 cm'],['brochura','Brochura','21,6 cm'],['capa-dura','Capa dura','22,9 cm'],['grande','Grande','27,9 cm']],
    width:[['original','Original'],['fino','Fino'],['medio','Médio'],['grande','Grande']]
  };
  const yawFaces = {0:'Lombada',90:'Capa',180:'Corte das páginas',270:'Contracapa',360:'Lombada'};
  const api = () => window.AuroraEstanteExemplares;
  let sheet, session, press;

  function setTab(name, focus = false) {
    for (const tab of sheet.querySelectorAll('[role=tab]')) {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
      if (selected && focus) tab.focus({preventScroll:true});
    }
    revealBook();
  }

  function showChoice() {
    for (const input of sheet.querySelectorAll('.medidas-opcoes input')) input.checked = session.draft[input.name] === input.value;
    const pose = session.pose;
    const yaw = pose.yaw ?? (pose.face === 'cover' ? 90 : 0);
    const slider = sheet.querySelector('#medidas-giro');
    slider.value = yaw;
    slider.setAttribute('aria-valuetext',yaw+' graus'+(yawFaces[yaw] ? ', '+yawFaces[yaw] : ''));
    sheet.querySelector('#medidas-giro-leitura').textContent = yaw+'°'+(yawFaces[yaw] ? ' · '+yawFaces[yaw] : '');
    for (const button of sheet.querySelectorAll('[data-field]')) {
      const selected = button.dataset.field === 'face' && pose.yaw != null ?
        yaw % 360 === (button.value === 'cover' ? 90 : 0) : button.value === pose[button.dataset.field];
      button.setAttribute('aria-pressed',String(selected));
    }
    sheet.querySelector('[data-action=unstack]').hidden = !pose.stackOn;
    sheet.querySelector('.medidas-deslocamento').hidden = !pose.stackOn;
    const offset = Math.round((pose.stackOffset || 0)*100);
    sheet.querySelector('#medidas-deslocamento').value = offset;
    sheet.querySelector('#medidas-deslocamento').setAttribute('aria-valuetext',offset===0?'Centralizado':Math.abs(offset)+'% para a '+(offset<0?'esquerda':'direita'));
    sheet.querySelector('.medidas-escala').textContent = Math.round(pose.scale * 100)+'%';
    sheet.querySelector('[data-action=smaller]').disabled = pose.scale <= .5;
    sheet.querySelector('[data-action=larger]').disabled = pose.scale >= 1.5;
    sheet.querySelector('.medidas-angulo').textContent = pose.angle ? ((pose.angle + 360) % 360)+'°' : '';
  }

  function preview(next, kind = 'size', reveal = true) {
    if (!session || session.saving || !next) return;
    const pose = kind === 'pose';
    const updated = pose ? api().previewPose(session.key, next) : api().previewSize(session.key, next);
    if (!updated) {
      const missing = !api().getSize(session.key);
      sheet.querySelector('.medidas-status').textContent = missing ? 'Este livro saiu da estante.' : 'Este ajuste precisa de mais espaço ou de um apoio livre na pilha.';
      sheet.querySelector('.medidas-pronto').disabled = missing;
      showChoice();
      return false;
    }
    if (pose) session.pose = next;
    else session.draft = next;
    sheet.querySelector('.medidas-status').textContent = '';
    showChoice();
    if (reveal) revealBook();
    return true;
  }

  function revealBook() {
    if (!session || !sheet.open || !session.button.isConnected) return;
    const box = session.button.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    const top = bounds.top + 6, bottom = bounds.bottom - 10;
    if (box.top < top) canvas.scrollTop += Math.floor(box.top - top);
    else if (box.bottom > bottom) canvas.scrollTop += Math.ceil(Math.min(box.bottom - bottom,box.top - top));
    const row = session.button.parentElement;
    if (row.dataset.placement || row.scrollWidth <= row.clientWidth) return;
    const lane = row.getBoundingClientRect();
    if (box.left < lane.left) row.scrollLeft += Math.floor(box.left - lane.left);
    else if (box.right > lane.right) row.scrollLeft += Math.ceil(box.right - lane.right);
  }

  function fitCanvas() {
    if (!session) return;
    canvas.style.setProperty('--medidas-altura-parede',scene.offsetHeight+'px');
    revealBook();
  }

  function closeStackOptions() {
    sheet.querySelector('#medidas-pilha-opcoes').hidden = true;
    sheet.querySelector('[data-action=stack]').setAttribute('aria-expanded','false');
  }

  function openStackOptions() {
    const form = sheet.querySelector('#medidas-pilha-opcoes');
    if (!form.hidden) { closeStackOptions(); return; }
    const base = form.querySelector('select');
    const targets = new Map();
    for (const orientation of ['horizontal','vertical']) {
      for (const book of api().stackTargets(session.key,orientation)) targets.set(book.key,book.title);
    }
    const placeholder = new Option('Escolha um livro','');
    placeholder.disabled = true;
    base.replaceChildren(placeholder);
    for (const [key,title] of targets) base.add(new Option(title,key));
    const current = session.pose.stackOn;
    base.value = current || '';
    base.disabled = !targets.size;
    for (const radio of form.querySelectorAll('input')) {
      radio.checked = radio.value === (current ? session.pose.orientation : 'horizontal');
      radio.disabled = !targets.size;
    }
    form.querySelector('.medidas-pilha-aviso').textContent = !targets.size ?
      'Nenhum apoio disponível. Deite um livro nesta prateleira e deixe o topo dele livre, com espaço acima.' : '';
    form.hidden = false;
    sheet.querySelector('[data-action=stack]').setAttribute('aria-expanded','true');
    if (targets.size) base.focus({preventScroll:true});
    const scroller = sheet.querySelector('.medidas-conteudo');
    scroller.scrollTop += Math.max(0,form.getBoundingClientRect().bottom-scroller.getBoundingClientRect().bottom+4);
  }

  function chooseSupport() {
    const form = sheet.querySelector('#medidas-pilha-opcoes');
    const base = form.querySelector('select');
    const orientation = form.querySelector('input:checked')?.value;
    const message = form.querySelector('.medidas-pilha-aviso');
    if (!base.value || !orientation) {
      message.textContent = base.value ? 'Escolha a posição do livro sobre a base.' : 'Escolha o livro de apoio.';
      return;
    }
    const next = api().stackPose(session.key,base.value,orientation);
    if (!next) {
      message.textContent = 'Esta posição não cabe sobre a base escolhida. Tente outra posição ou outro apoio.';
      return;
    }
    if (preview(next,'pose')) message.textContent = 'Apoiado em '+base.selectedOptions[0].textContent+'.';
  }

  function editPose(button) {
    const {action,field} = button.dataset;
    if (field === 'orientation') {
      closeStackOptions();
      return preview({...session.pose,orientation:button.value,angle:0},'pose');
    }
    if (field === 'face') {
      const yaw = session.pose.yaw == null ? null : button.value === 'cover' ? 90 : 0;
      return preview({...session.pose,face:button.value,yaw},'pose');
    }
    const {scale,angle} = session.pose;
    switch (action) {
      case 'smaller':
      case 'larger':
        return preview({...session.pose,scale:Math.round(scale * 10 + (action === 'larger' ? 1 : -1))/10},'pose');
      case 'rotate': return preview({...session.pose,angle:angle === 180 ? -175 : angle+5},'pose');
      case 'front':
      case 'back': return preview(api().layerPose(session.key,action),'pose');
      case 'stack': return openStackOptions();
      case 'unstack':
        if (preview(api().unstackPose(session.key),'pose')) {
          closeStackOptions();
          sheet.querySelector('[data-action=stack]').focus({preventScroll:true});
          sheet.querySelector('.medidas-status').textContent = 'Livro retirado da pilha.';
        }
        break;
    }
  }

  function makeSheet() {
    const dialog = document.createElement('dialog');
    dialog.id = 'bookSizeDialog';
    dialog.setAttribute('closedby','closerequest');
    dialog.setAttribute('aria-labelledby','medidas-caption medidas-title');
    dialog.innerHTML = `
      <header class="medidas-cabecalho">
        <div><p id="medidas-caption">Ajustar livro</p><h2 id="medidas-title" aria-live="polite"></h2></div>
        <button class="medidas-fechar" type="button" aria-label="Fechar sem salvar">×</button>
      </header>
      <p class="medidas-instrucao">Toque em um livro para selecionar. Arraste para mover.</p>
      <div class="medidas-conteudo">
      <div class="medidas-abas" role="tablist" aria-label="Medida do livro">
        <button type="button" role="tab" id="medidas-tab-height" aria-controls="medidas-panel-height" data-tab="height">Altura</button>
        <button type="button" role="tab" id="medidas-tab-width" aria-controls="medidas-panel-width" data-tab="width">Largura</button>
      </div>
      <div class="medidas-paineis"></div>
      <div class="medidas-posicao" role="group" aria-label="Posição e aparência do livro">
        <div class="medidas-ferramentas">
          <div class="medidas-zoom" role="group" aria-label="Escala">
            <button type="button" data-action="smaller" aria-label="Diminuir livro">−</button>
            <span class="medidas-escala" aria-live="polite"></span>
            <button type="button" data-action="larger" aria-label="Aumentar livro">+</button>
          </div>
          <button type="button" data-action="rotate" aria-label="Girar 5°"><span aria-hidden="true">↻</span> Girar 5° <small class="medidas-angulo"></small></button>
        </div>
        <div class="medidas-pares">
          <div role="group" aria-label="Orientação">
            <button type="button" data-field="orientation" value="vertical">Vertical</button>
            <button type="button" data-field="orientation" value="horizontal">Horizontal</button>
          </div>
          <div role="group" aria-label="Face visível">
            <button type="button" data-field="face" value="spine">Lombada</button>
            <button type="button" data-field="face" value="cover">Capa</button>
          </div>
        </div>
        <div class="medidas-giro">
          <label for="medidas-giro">Giro 3D</label><span id="medidas-giro-leitura" aria-hidden="true"></span>
          <input id="medidas-giro" type="range" min="0" max="360" step="1" value="0">
        </div>
        <div class="medidas-camadas" role="group" aria-label="Camada do livro">
          <button type="button" data-action="front"><span aria-hidden="true">▴</span> Para frente</button>
          <button type="button" data-action="back"><span aria-hidden="true">▾</span> Para trás</button>
        </div>
        <div class="medidas-deslocamento" hidden>
          <label for="medidas-deslocamento">Deslocamento lateral na pilha</label>
          <input id="medidas-deslocamento" type="range" min="-35" max="35" step="1" value="0">
          <div><span>Esquerda</span><span>Direita</span></div>
        </div>
        <div class="medidas-pilha-acoes">
          <button type="button" data-action="stack" aria-expanded="false" aria-controls="medidas-pilha-opcoes">Empilhar</button>
          <button type="button" data-action="unstack" hidden>Retirar da pilha</button>
        </div>
        <div class="medidas-pilha-opcoes" id="medidas-pilha-opcoes" hidden>
          <label for="medidas-apoio">Livro de apoio</label>
          <select id="medidas-apoio"></select>
          <fieldset>
            <legend>Posição sobre a base</legend>
            <label><input type="radio" name="apoio-orientacao" value="horizontal"> Deitado</label>
            <label><input type="radio" name="apoio-orientacao" value="vertical"> Em pé</label>
          </fieldset>
          <p class="medidas-pilha-aviso" aria-live="polite"></p>
        </div>
      </div>
      </div>
      <p class="medidas-status" role="status"></p>
      <footer><button class="medidas-redefinir" type="button">Redefinir</button><button class="medidas-pronto" type="button">Pronto</button></footer>
`;

    for (const [axis, options] of Object.entries(choices)) {
      const panel = document.createElement('div');
      panel.id = 'medidas-panel-' + axis;
      panel.setAttribute('role','tabpanel');
      panel.setAttribute('aria-labelledby','medidas-tab-' + axis);
      const group = document.createElement('div');
      group.className = 'medidas-opcoes';
      group.setAttribute('role','radiogroup');
      group.setAttribute('aria-labelledby','medidas-tab-' + axis);
      for (const [value,label,measurement] of options) {
        const option = document.createElement('label');
        option.className = 'medidas-opcao';
        option.dataset.sample = value;
        option.innerHTML = `<input type="radio" name="${axis}" value="${value}" aria-label="${label}">
          <span class="medidas-cartao"><span class="medidas-amostra" aria-hidden="true"><i></i></span><span>${label}</span></span>`;
        if (measurement) {
          const note = document.createElement('small');
          note.id = 'medidas-cm-' + value;
          note.textContent = measurement;
          option.querySelector('input').setAttribute('aria-describedby',note.id);
          option.querySelector('.medidas-cartao').append(note);
        }
        group.append(option);
      }
      panel.append(group);
      dialog.querySelector('.medidas-paineis').append(panel);
    }
    dialog.addEventListener('change', event => {
      if (event.target.matches('.medidas-opcoes input')) preview({...session.draft, [event.target.name]:event.target.value});
    });
    dialog.querySelector('#medidas-giro').addEventListener('input', event => {
      preview({...session.pose,yaw:event.target.valueAsNumber},'pose');
    });
    dialog.querySelector('#medidas-deslocamento').addEventListener('input',event=>{
      preview({...session.pose,stackOffset:event.target.valueAsNumber/100},'pose');
    });
    dialog.querySelector('#medidas-pilha-opcoes').addEventListener('change',chooseSupport);
    dialog.querySelector('.medidas-posicao').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button && !session.saving) editPose(button);
    });
    const tabs = dialog.querySelector('[role=tablist]');
    tabs.addEventListener('click', event => {
      if (event.target.dataset.tab) setTab(event.target.dataset.tab, true);
    });
    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'height' : event.key === 'End' ? 'width' : event.target.dataset.tab === 'height' ? 'width' : 'height';
      setTab(next, true);
    });
    dialog.querySelector('.medidas-fechar').addEventListener('click', () => dialog.close());
    dialog.querySelector('.medidas-redefinir').addEventListener('click', () => {
      closeStackOptions();
      preview({height:'original',width:'original'});
      preview(api().defaultPose(),'pose');
    });
    dialog.querySelector('.medidas-pronto').addEventListener('click', async () => {
      if (!session || session.saving) return;
      session.saving = true;
      const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
      for (const control of controls) control.disabled = true;
      try {
        await api().saveAppearanceSession();
        session.saved = true;
        dialog.close();
      } catch (error) {
        let message = 'Não foi possível salvar. Tente novamente.';
        if (error?.code === 'STACK_INVALID') message = error.message;
        if (error?.code === 'APPEARANCE_CONFLICT' || error?.code === 'BOOK_REMOVED') {
          message = error.message+' Feche pelo × e reabra o painel para carregar a estante atual.';
        }
        dialog.querySelector('.medidas-status').textContent = message;
      } finally {
        session.saving = false;
        for (const control of controls) control.disabled = false;
        showChoice();
      }
    });
    dialog.addEventListener('cancel',event => { if (session?.saving) event.preventDefault(); });
    dialog.addEventListener('close', () => {
      if (!session) return;
      window.AuroraMoverExemplar.desativar();
      if (!session.saved) api().cancelAppearanceSession();
      markSelected(session.button,false);
      for (const element of session.inert) element.inert = false;
      document.documentElement.classList.remove('medidas-sessao');
      canvas.classList.remove('medidas-estante-aberta');
      canvas.style.removeProperty('--medidas-altura-parede');
      canvas.scrollTop = session.scroll;
      window.scrollTo({left:session.pageX,top:session.pageY,behavior:'instant'});
      const focus = session.origin.isConnected ? session.origin : session.button;
      focus.focus({preventScroll:true});
      session = null;
      for (const prop of ['--medidas-capa','--medidas-lombada','--medidas-posicao','--medidas-textura']) dialog.style.removeProperty(prop);
    });
    document.body.append(dialog);
    return dialog;
  }

  function markSelected(button, selected) {
    if (!button) return;
    button.classList.toggle('medidas-livro-selecionado',selected);
    if (selected) button.setAttribute('aria-pressed','true');
    else button.removeAttribute('aria-pressed');
  }

  function selectBook(button) {
    if (!session || session.saving || !button?.isConnected) return false;
    if (button === session.button) return true;
    const key = button.dataset.personalBookKey;
    const appearance = api().getDraftAppearance(key);
    if (!appearance) return false;
    markSelected(session.button,false);
    Object.assign(session,{button,key,draft:{...appearance.size},pose:{...appearance.pose}});
    markSelected(button,true);
    const title = button.querySelector('.spine-title')?.textContent.trim() || button.dataset.rawTitle;
    sheet.querySelector('h2').textContent = title;
    const cover = button.querySelector('.shelf-book-cover img')?.src;
    const style = getComputedStyle(button);
    sheet.style.setProperty('--medidas-lombada', style.backgroundImage);
    sheet.style.setProperty('--medidas-capa', cover ? 'url('+JSON.stringify(cover)+')' : style.backgroundImage);
    sheet.style.setProperty('--medidas-posicao', style.backgroundPosition);
    sheet.style.setProperty('--medidas-textura', style.backgroundSize);
    sheet.toggleAttribute('data-sem-capa', !cover);
    sheet.querySelector('.medidas-status').textContent = '';
    closeStackOptions();
    sheet.querySelector('.medidas-pronto').disabled = false;
    showChoice();
    return true;
  }

  function open(button, hold) {
    if (session || !button?.isConnected || !api()?.beginAppearanceSession()) return;
    if (!sheet) sheet = makeSheet();
    session = {
      origin:button, scroll:canvas.scrollTop, pageX:window.scrollX, pageY:window.scrollY,
      inert:[], waitingForRelease:Boolean(hold)
    };
    if (!selectBook(button)) {
      api().cancelAppearanceSession();
      session = null;
      return;
    }
    for (const element of document.querySelectorAll('.studio-top,.studio-actions,.editor-dock,#canvas .shelf-object-layer,#canvas .object-size-controls')) {
      if (!element.inert) { element.inert = true; session.inert.push(element); }
    }
    document.documentElement.classList.add('medidas-sessao');
    canvas.classList.add('medidas-estante-aberta');
    sheet.querySelector('.medidas-conteudo').scrollTop = 0;
    setTab('height');
    // A estante e o painel são duas regiões interativas da mesma sessão.
    sheet.show();
    fitCanvas();
    button.focus({preventScroll:true});
    window.AuroraMoverExemplar.ativar({
      area:canvas, hold, getBook:() => session.button, selectBook,
      getDraft:() => session.pose, preview:next => preview(next,'pose',false)
    });
  }

  document.addEventListener('pointerdown', () => { if (session) session.waitingForRelease = false; },true);
  document.addEventListener('keydown', event => {
    if (!session) return;
    session.waitingForRelease = false;
    if (event.key === 'Escape' && !session.saving) {
      event.preventDefault();
      event.stopPropagation();
      sheet.close();
    }
  },true);
  document.addEventListener('click', event => {
    // A soltura da pressão que abre o painel pode coincidir com outro livro ou controle.
    if (!session?.waitingForRelease || event.detail === 0) return;
    session.waitingForRelease = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  },true);

  function stopPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }
  scene.addEventListener('pointerdown', event => {
    stopPress();
    const button = event.target.closest(selector);
    if (session || !button || !event.isPrimary || event.button !== 0) return;
    press = {id:event.pointerId, x:event.clientX, y:event.clientY,
      timer:setTimeout(() => { stopPress(); open(button, {pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY}); }, 500)};
  });
  window.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) stopPress();
  }, {passive:true});
  for (const name of ['pointerup','pointercancel']) window.addEventListener(name, stopPress, true);
  window.addEventListener('blur', stopPress);
  window.addEventListener('scroll', stopPress, {capture:true,passive:true});
  window.addEventListener('resize', fitCanvas);
  scene.addEventListener('contextmenu', event => { if (event.target.closest(selector)) event.preventDefault(); });
  scene.addEventListener('click', event => {
    if (!session && event.detail === 0) open(event.target.closest(selector));
  });
})();
