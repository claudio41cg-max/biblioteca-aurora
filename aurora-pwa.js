/* Biblioteca Aurora: instalação PWA sem alterar o livro 3D ou os leitores. */
(() => {
  'use strict';
  const button = document.getElementById('auroraInstallButton');
  const help = document.getElementById('auroraInstallHelp');
  let installPrompt = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const android = /Android/i.test(navigator.userAgent);
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const showMessage = message => {
    if (!help) return;
    help.textContent = message;
    help.hidden = !message;
  };
  const refreshButton = () => {
    if (!button) return;
    button.hidden = standalone() || !(installPrompt || android || ios);
  };
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    refreshButton();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    showMessage('');
    refreshButton();
  });
  button?.addEventListener('click', async () => {
    if (standalone()) { refreshButton(); return; }
    if (installPrompt) {
      const event = installPrompt;
      installPrompt = null;
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice?.outcome === 'dismissed') {
          showMessage('Para instalar depois, abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.');
        } else {
          showMessage('Se você confirmou, aguarde a instalação do aplicativo.');
        }
      } catch {
        showMessage('Abra o menu ⋮ do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.');
      }
      refreshButton();
      return;
    }
    showMessage(ios
      ? 'No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.'
      : 'No Chrome ou Samsung Internet, toque no menu ⋮ e escolha Instalar aplicativo ou Adicionar à tela inicial.');
  });
  refreshButton();
  if ('serviceWorker' in navigator) {
    // Registra imediatamente. Esperar o evento load pode atrasar a instalação
    // em celulares com recursos externos lentos.
    navigator.serviceWorker.register('./sw.js', {scope: './', updateViaCache: 'none'})
      .catch(error => console.warn('Biblioteca Aurora: modo offline indisponível neste navegador.', error));
  }
})();
