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
  }

  function showChoice() {
    for (const input of sheet.querySelectorAll('input')) input.checked = session.draft[input.name] === input.value;
  }

  function preview(next) {
    if (!session || session.saving) return;
    if (!api().previewSize(session.key, next)) {
      sheet.querySelector('[role=status]').textContent = 'Este livro saiu da estante.';
      sheet.querySelector('.medidas-pronto').disabled = true;
      return;
    }
    session.draft = next;
    sheet.querySelector('[role=status]').textContent = '';
    showChoice();
    revealBook();
  }

  function revealBook() {
    if (!session || !sheet.open || !session.button.isConnected) return;
    const target = session.button.getBoundingClientRect();
    const roomTop = Math.max(0, canvas.getBoundingClientRect().top) + 6;
    const roomBottom = sheet.getBoundingClientRect().top - 14;
    if (roomBottom <= roomTop || target.bottom <= roomBottom || target.top <= roomTop) return;
    const overlap = Math.ceil(Math.min(target.bottom - roomBottom, target.top - roomTop));
    if (!canvas.classList.contains('medidas-em-edicao')) {
      // Mesmo quando toda a estante cabe no documento, movemos só o conteúdo do canvas.
      canvas.style.setProperty('--medidas-altura-cena', canvas.getBoundingClientRect().height + 'px');
      canvas.classList.add('medidas-em-edicao');
    }
    canvas.scrollTop += overlap;
  }

  function makeSheet() {
    const dialog = document.createElement('dialog');
    dialog.id = 'bookSizeDialog';
    dialog.setAttribute('aria-labelledby','medidas-caption medidas-title');
    dialog.innerHTML = `
      <header class="medidas-cabecalho">
        <div><p id="medidas-caption">Medidas do livro</p><h2 id="medidas-title"></h2></div>
        <button class="medidas-fechar" type="button" aria-label="Fechar sem salvar">×</button>
      </header>
      <div class="medidas-abas" role="tablist" aria-label="Medida do livro">
        <button type="button" role="tab" id="medidas-tab-height" aria-controls="medidas-panel-height" data-tab="height">Altura</button>
        <button type="button" role="tab" id="medidas-tab-width" aria-controls="medidas-panel-width" data-tab="width">Largura</button>
      </div>
      <div class="medidas-paineis"></div>
      <p class="medidas-status" role="status"></p>
      <footer><button class="medidas-redefinir" type="button">Redefinir</button><button class="medidas-pronto" type="button">Pronto</button></footer>`;

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
    dialog.querySelector('.medidas-redefinir').addEventListener('click', () => preview({height:'original',width:'original'}));
    dialog.querySelector('.medidas-pronto').addEventListener('click', async () => {
      if (!session || session.saving) return;
      session.saving = true;
      for (const control of dialog.querySelectorAll('button, input')) control.disabled = true;
      try {
        await api().saveSize(session.key, {...session.draft});
        session.saved = true;
        dialog.close();
      } catch {
        dialog.querySelector('[role=status]').textContent = 'Não foi possível salvar. Tente novamente.';
      } finally {
        session.saving = false;
        for (const control of dialog.querySelectorAll('button, input')) control.disabled = false;
      }
    });
    dialog.addEventListener('cancel', event => { if (session?.saving) event.preventDefault(); });
    let pressedBackdrop = false;
    function isBackdrop(event) {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right);
    }
    dialog.addEventListener('pointerdown', event => { pressedBackdrop = isBackdrop(event); });
    dialog.addEventListener('pointercancel', () => { pressedBackdrop = false; });
    dialog.addEventListener('click', event => {
      // Soltar o dedo que abriu o painel ainda é parte da pressão longa sobre a lombada.
      if (pressedBackdrop && !session?.saving && isBackdrop(event)) dialog.close();
      pressedBackdrop = false;
    });
    dialog.addEventListener('close', () => {
      pressedBackdrop = false;
      if (!session) return;
      if (!session.saved) api().cancelSize(session.key);
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

  function open(button) {
    if (!button?.isConnected || session) return;
    const key = button.dataset.personalBookKey;
    const saved = api()?.getSize(key);
    if (!saved) return;
    if (!sheet) sheet = makeSheet();
    session = {key, button, draft:{...saved}, scroll:canvas.scrollTop};
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
      timer:setTimeout(() => { stopPress(); open(button); }, 500)};
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
