import {applyBackup, createBackup, openBackup, planRestore, readLibrary} from './aurora-backup.mjs';

const $ = id => document.getElementById(id);
const exportButton = $('backupExport');
const importButton = $('backupImport');
const fileInput = $('backupFile');
const review = $('backupReview');
const confirm = $('backupConfirm');
const cancel = $('backupCancel');
const status = $('backupStatus');
let incoming;
let plan;

function reset() {
  incoming = null;
  plan = null;
  review.hidden = true;
  $('backupConflicts').replaceChildren();
  fileInput.value = '';
}

async function run(message, task) {
  for (const button of [exportButton, importButton, confirm, cancel]) button.disabled = true;
  status.textContent = message;
  try {
    await task();
  } catch (error) {
    reset();
    status.textContent = error?.name === 'QuotaExceededError'
      ? 'Espaço insuficiente no aparelho para restaurar a biblioteca.'
      : 'Não foi possível concluir o backup. ' + (error?.message || 'Tente novamente.');
  } finally {
    for (const button of [exportButton, importButton, confirm, cancel]) button.disabled = false;
  }
}

exportButton.addEventListener('click', () => run('Preparando o arquivo de backup…', async () => {
  reset();
  const archive = createBackup(await readLibrary(true));
  const url = URL.createObjectURL(archive);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'biblioteca-aurora-' + new Date().toISOString().slice(0, 10) + '.aurora';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  status.textContent = 'O arquivo foi enviado para os downloads do navegador.';
}));

importButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  void run('Conferindo os livros e as posições do backup…', async () => {
    reset();
    incoming = await openBackup(file);
    for (const book of incoming.books) book.data = await book.data.arrayBuffer();
    plan = planRestore(await readLibrary(), incoming);
    $('backupSummary').textContent =
      plan.books.length + ' arquivos novos, ' + plan.duplicates + ' já presentes, ' +
      plan.texts + ' textos e ' + plan.shelves + ' estantes para incluir.';
    for (const conflict of plan.conflicts) {
      const label = document.createElement('label');
      label.textContent = conflict.name;
      const select = document.createElement('select');
      select.dataset.conflict = conflict.id;
      select.add(new Option('Manter neste aparelho — ' + conflict.current, 'current'));
      select.add(new Option('Usar do backup — ' + conflict.backup, 'backup'));
      label.append(select);
      $('backupConflicts').append(label);
    }
    review.hidden = false;
    status.textContent = plan.conflicts.length
      ? 'Escolha a posição que quer manter em cada livro abaixo.'
      : 'Confira o conteúdo antes de restaurar.';
    $('backupSummary').focus();
  });
});

confirm.addEventListener('click', () => {
  if (!incoming || !plan) return;
  void run('Restaurando a biblioteca…', async () => {
    const choices = new Map([...review.querySelectorAll('select')].map(select => [select.dataset.conflict, select.value]));
    const restored = await applyBackup(incoming, plan, choices);
    reset();
    status.textContent = 'Backup restaurado. ' + restored.books.length + ' arquivos adicionados.';
    document.dispatchEvent(new Event('aurora:backup-restored'));
    status.focus();
  });
});

cancel.addEventListener('click', () => {
  reset();
  status.textContent = 'Restauração cancelada.';
  importButton.focus();
});
