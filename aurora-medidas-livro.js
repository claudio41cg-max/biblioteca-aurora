/* Controles de um único exemplar da estante em edição. */
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
    for (const input of sheet.querySelectorAll('input')) input.checked = session.draft[input.name] === input.value;
    const pose = session.pose;
    for (const button of sheet.querySelectorAll('[data-field]')) {
      button.setAttribute('aria-pressed',String(button.value === pose[button.dataset.field]));
    }
    sheet.querySelector('.medidas-escala').textContent = Math.round(pose.scale * 100)+'%';
    sheet.querySelector('[data-action=smaller]').disabled = pose.scale <= .5;
    sheet.querySelector('[data-action=larger]').disabled = pose.scale >= 1.5;
    sheet.querySelector('.medidas-angulo').textContent = pose.angle ? ((pose.angle + 360) % 360)+'°' : '';
  }

  function preview(next, kind = 'size') {
    if (!session || session.saving || !next) return;
    const pose = kind === 'pose';
    const updated = pose ? api().previewPose(session.key, next) : api().previewSize(session.key, next);
    if (!updated) {
      sheet.querySelector('[role=status]').textContent = 'Este livro saiu da estante.';
      sheet.querySelector('.medidas-pronto').disabled = true;
      return;
    }
    if (pose) session.pose = next;
    else session.draft = next;
    sheet.querySelector('[role=status]').textContent = '';
    showChoice();
    if (!sheet.hasAttribute('data-moving')) revealBook();
  }

  function revealBook() {
    if (!session || !sheet.open || !session.button.isConnected) return;
    const target = session.button.getBoundingClientRect();
    const roomTop = Math.max(0, canvas.getBoundingClientRect().top) + 6;
    const panel = sheet.hasAttribute('data-moving') ? sheet.querySelector('.medidas-mover-barra') : sheet;
    const roomBottom = panel.getBoundingClientRect().top - 14;
    if (roomBottom <= roomTop || target.bottom <= roomBottom || target.top <= roomTop) return;
    const overlap = Math.ceil(Math.min(target.bottom - roomBottom, target.top - roomTop));
    if (!canvas.classList.contains('medidas-em-edicao')) {
      // Mesmo quando toda a estante cabe no documento, movemos só o conteúdo do canvas.
      canvas.style.setProperty('--medidas-altura-cena', canvas.getBoundingClientRect().height + 'px');
      canvas.classList.add('medidas-em-edicao');
    }
    canvas.scrollTop += overlap;
  }

  function startMove() {
    session.moveStart = {...session.pose};
    sheet.setAttribute('data-moving','');
    sheet.setAttribute('aria-labelledby','medidas-mover-titulo medidas-title');
    session.button.classList.add('medidas-livro-em-movimento');
    const area = sheet.querySelector('#medidas-arrasto');
    area.setAttribute('aria-label','Mover '+sheet.querySelector('#medidas-title').textContent);
    window.AuroraMoverExemplar.ativar({
      area, livro:session.button, getDraft:() => session.pose, preview:next => preview(next,'pose')
    });
    canvas.scrollTop = session.scroll;
    revealBook();
    area.focus({preventScroll:true});
  }

  function endMove(keep) {
    window.AuroraMoverExemplar.desativar();
    if (!keep) preview(session.moveStart,'pose');
    session.moveStart = null;
    session.button.classList.remove('medidas-livro-em-movimento');
    sheet.removeAttribute('data-moving');
    sheet.setAttribute('aria-labelledby','medidas-caption medidas-title');
    sheet.querySelector('[data-action=move]').focus({preventScroll:true});
    revealBook();
  }

  function editPose(button) {
    const {action,field} = button.dataset;
    if (field === 'orientation') return preview({...session.pose,orientation:button.value,angle:0},'pose');
    if (field === 'face') return preview({...session.pose,face:button.value},'pose');
    const {scale,angle} = session.pose;
    switch (action) {
      case 'smaller':
      case 'larger':
        return preview({...session.pose,scale:Math.round(scale * 10 + (action === 'larger' ? 1 : -1))/10},'pose');
      case 'rotate': return preview({...session.pose,angle:angle === 180 ? -175 : angle+5},'pose');
      case 'front':
      case 'back': return preview(api().layerPose(session.key,action),'pose');
      case 'move': return startMove();
    }
  }

  function makeSheet() {
    const dialog = document.createElement('dialog');
    dialog.id = 'bookSizeDialog';
    dialog.setAttribute('aria-labelledby','medidas-caption medidas-title');
    dialog.innerHTML = `
      <header class="medidas-cabecalho">
        <div><p id="medidas-caption">Ajustar livro</p><h2 id="medidas-title"></h2></div>
        <button class="medidas-fechar" type="button" aria-label="Fechar sem salvar">×</button>
      </header>
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
          <button type="button" data-action="move"><span aria-hidden="true">✥</span> Mover</button>
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
        <div class="medidas-camadas" role="group" aria-label="Camada do livro">
          <button type="button" data-action="front"><span aria-hidden="true">▴</span> Para frente</button>
          <button type="button" data-action="back"><span aria-hidden="true">▾</span> Para trás</button>
        </div>
      </div>
      </div>
      <p class="medidas-status" role="status"></p>
      <footer><button class="medidas-redefinir" type="button">Redefinir</button><button class="medidas-pronto" type="button">Pronto</button></footer>
      <div id="medidas-arrasto" role="group" tabindex="0" aria-describedby="medidas-mover-instrucao"></div>
      <div class="medidas-mover-barra">
        <div><strong id="medidas-mover-titulo">Arraste o livro na prateleira</strong><small id="medidas-mover-instrucao">Pelo teclado, use as setas.</small></div>
        <div><button type="button" data-mover="cancel">Voltar</button><button type="button" data-mover="done">Usar posição</button></div>
      </div>`;

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
      if (event.target.matches('input[type=radio]')) preview({...session.draft, [event.target.name]:event.target.value});
    });
    dialog.querySelector('.medidas-posicao').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button && !session.saving) editPose(button);
    });
    dialog.querySelector('.medidas-mover-barra').addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button) endMove(button.dataset.mover === 'done');
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
      preview({height:'original',width:'original'});
      preview(api().defaultPose(),'pose');
    });
    dialog.querySelector('.medidas-pronto').addEventListener('click', async () => {
      if (!session || session.saving) return;
      session.saving = true;
      for (const control of dialog.querySelectorAll('button, input')) control.disabled = true;
      try {
        await api().saveAppearance(session.key, {...session.draft}, {...session.pose});
        session.saved = true;
        dialog.close();
      } catch {
        dialog.querySelector('[role=status]').textContent = 'Não foi possível salvar. Tente novamente.';
      } finally {
        session.saving = false;
        for (const control of dialog.querySelectorAll('button, input')) control.disabled = false;
        showChoice();
      }
    });
    dialog.addEventListener('cancel', event => {
      if (session?.saving) event.preventDefault();
      else if (dialog.hasAttribute('data-moving')) { event.preventDefault(); endMove(false); }
    });
    let pressedBackdrop = false;
    function isBackdrop(event) {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right);
    }
    dialog.addEventListener('pointerdown', event => {
      if (session) session.waitingForRelease = false;
      pressedBackdrop = isBackdrop(event);
    },true);
    dialog.addEventListener('keydown', () => { if (session) session.waitingForRelease = false; },true);
    dialog.addEventListener('click', event => {
      // Em telas pequenas a soltura também pode cair sobre uma opção recém-exibida.
      if (!session?.waitingForRelease || event.detail === 0) return;
      session.waitingForRelease = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    },true);
    dialog.addEventListener('pointercancel', () => { pressedBackdrop = false; });
    dialog.addEventListener('click', event => {
      // Soltar o dedo que abriu o painel ainda é parte da pressão longa sobre a lombada.
      if (pressedBackdrop && !session?.saving && isBackdrop(event)) dialog.close();
      pressedBackdrop = false;
    });
    dialog.addEventListener('close', () => {
      pressedBackdrop = false;
      if (!session) return;
      if (dialog.hasAttribute('data-moving')) endMove(true);
      if (!session.saved) {
        api().cancelSize(session.key);
        api().cancelPose(session.key);
      }
      canvas.classList.remove('medidas-em-edicao');
      canvas.style.removeProperty('--medidas-altura-cena');
      canvas.scrollTop = session.scroll;
      session.button.focus({preventScroll:true});
      session = null;
      for (const prop of ['--medidas-capa','--medidas-lombada','--medidas-posicao','--medidas-textura']) dialog.style.removeProperty(prop);
    });
    document.body.append(dialog);
    return dialog;
  }

  function open(button, fromHold = false) {
    if (!button?.isConnected || session) return;
    const key = button.dataset.personalBookKey;
    const saved = api()?.getSize(key);
    if (!saved) return;
    if (!sheet) sheet = makeSheet();
    const pose = api().getPose(key);
    if (!pose) return;
    session = {key, button, draft:{...saved}, pose:{...pose}, scroll:canvas.scrollTop, waitingForRelease:fromHold};
    sheet.querySelector('.medidas-conteudo').scrollTop = 0;
    const title = button.querySelector('.spine-title')?.textContent.trim() || button.dataset.rawTitle;
    sheet.querySelector('h2').textContent = title;
    const cover = button.querySelector('.shelf-book-cover img')?.src;
    const style = getComputedStyle(button);
    sheet.style.setProperty('--medidas-lombada', style.backgroundImage);
    sheet.style.setProperty('--medidas-capa', cover ? 'url('+JSON.stringify(cover)+')' : style.backgroundImage);
    sheet.style.setProperty('--medidas-posicao', style.backgroundPosition);
    sheet.style.setProperty('--medidas-textura', style.backgroundSize);
    sheet.toggleAttribute('data-sem-capa', !cover);
    sheet.querySelector('[role=status]').textContent = '';
    sheet.querySelector('.medidas-pronto').disabled = false;
    setTab('height');
    showChoice();
    sheet.showModal();
    sheet.querySelector('[aria-selected="true"]').focus({preventScroll:true});
    revealBook();
  }

  function stopPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }
  scene.addEventListener('pointerdown', event => {
    stopPress();
    const button = event.target.closest(selector);
    if (!button || !event.isPrimary || event.button !== 0) return;
    press = {id:event.pointerId, x:event.clientX, y:event.clientY,
      timer:setTimeout(() => { stopPress(); open(button, true); }, 500)};
  });
  window.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) stopPress();
  }, {passive:true});
  for (const name of ['pointerup','pointercancel']) window.addEventListener(name, stopPress, true);
  window.addEventListener('blur', stopPress);
  window.addEventListener('scroll', stopPress, {capture:true,passive:true});
  window.addEventListener('resize', revealBook);
  scene.addEventListener('contextmenu', event => { if (event.target.closest(selector)) event.preventDefault(); });
  scene.addEventListener('click', event => {
    if (event.detail === 0) open(event.target.closest(selector));
  });
})();
