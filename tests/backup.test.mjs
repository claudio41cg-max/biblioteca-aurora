import assert from 'node:assert/strict';
import test from 'node:test';
import {createBackup, openBackup, planRestore} from '../aurora-backup.mjs';

const binary = (...values) => Uint8Array.from(values).buffer;
const source = {
  books: [
    {id: 'pdf', name: 'PDF original', data: binary(1, 2, 3), cover: 'data:image/png;base64,AA=='},
    {id: 'epub', name: 'EPUB original', format: 'epub', data: binary(4, 5, 6)},
    {id: 'audio', name: 'Audiolivro', format: 'audio', data: binary(7, 8, 9)}
  ],
  progress: [{id: 'pdf', page: 7, bookmark: 5}, {id: 'audio', seconds: 60}, {id: 'txt:Diário', page: 9}],
  local: {
    'aurora-books': JSON.stringify({Diário: 'Texto do backup'}),
    'aurora-txt-categories': JSON.stringify({Diário: 'romance'}),
    'aurora-page-v2:Diário': '12',
    'aurora-estantes-personalizadas-v1': JSON.stringify([{id: 'minha-estante', name: 'Estante do backup'}]),
    'aurora-audio-speed': '1.5'
  }
};
const destination = {
  books: [{id: 'outro-id', name: 'PDF já no aparelho', data: binary(1, 2, 3)},
    {id: 'epub', name: 'Outro EPUB', format: 'epub', data: binary(20, 21, 22)}],
  progress: [{id: 'outro-id', page: 3, bookmark: 1}],
  local: {
    'aurora-books': JSON.stringify({Diário: 'Texto local'}),
    'aurora-estantes-personalizadas-v1': JSON.stringify([{id: 'minha-estante', name: 'Estante local'}])
  }
};

test('preserva arquivos e metadados sem recodificar os livros', async () => {
  const archive = createBackup(source);
  const copy = await openBackup(archive);
  for (const book of copy.books) book.data = await book.data.arrayBuffer();
  assert.deepEqual(copy, source);
  await assert.rejects(openBackup(archive.slice(0, -1)), /incompleto/);
  await assert.rejects(openBackup(new Blob(['qualquer outro arquivo'])), /compatível/);
});

test('mescla livros, estantes e textos e resolve progresso por exemplar', () => {
  const preview = planRestore(destination, source);
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.books.length, 2);
  assert.notEqual(preview.books[0].id, 'epub');
  assert.equal(preview.progress.some(record => record.id === 'outro-id'), false);
  assert.equal(preview.conflicts.length, 1);
  assert.match(preview.conflicts[0].backup, /página 8/);

  const plan = planRestore(destination, source, new Map([[preview.conflicts[0].id, 'backup']]));
  assert.deepEqual(plan.progress.find(record => record.id === 'outro-id'), {id: 'outro-id', page: 7, bookmark: 5});
  assert.equal(plan.progress.find(record => record.id === 'txt:Diário (backup 1)').page, 9);
  assert.equal(plan.local.get('aurora-page-v2:Diário (backup 1)'), '12');
  assert.equal(JSON.parse(plan.local.get('aurora-books')).Diário, 'Texto local');
  const shelves = JSON.parse(plan.local.get('aurora-estantes-personalizadas-v1'));
  assert.deepEqual(shelves.map(shelf => shelf.name), ['Estante local', 'Estante do backup']);

  const retry = planRestore({
    books: [...destination.books, ...plan.books],
    progress: plan.progress,
    local: {...destination.local, ...Object.fromEntries(plan.local)}
  }, source);
  assert.equal(retry.books.length, 0);
  assert.equal(retry.shelves, 0);
  assert.equal(retry.texts, 0);
  assert.equal(retry.conflicts.length, 0);
});
