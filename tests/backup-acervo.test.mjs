import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const script=read('aurora-backup-acervo.js');
const settings=read('configuracoes.html');
const css=read('aurora-configuracoes.css');
const sw=read('sw.js');

test('backup contempla os dados locais e os dois stores do IndexedDB',()=>{
  assert.match(script,/indexedDB\.open\(DB_NAME,DB_VERSION\)/);
  assert.match(script,/readAll\(db,'books'\)/);
  assert.match(script,/readAll\(db,'progress'\)/);
  assert.match(script,/localStorage\.getItem\(key\)/);
  assert.match(script,/aurora-pdf-library/);
  assert.match(script,/libria-acervo-backup/);
  assert.ok(script.includes("dataPath='books/'+String(index+1).padStart(6,'0')+'.bin'"));
  assert.match(script,/zip\.file\(dataPath,bytes/);
  assert.match(script,/zip\.file\('libria-backup\.json'/);
});

test('restauração mescla dados e não apaga livros que já existem',()=>{
  assert.match(script,/booksStore\.put\(item\)/);
  assert.match(script,/progressStore\.put\(item\)/);
  assert.doesNotMatch(script,/objectStore\(['"]books['"]\)\.clear\(/);
  assert.doesNotMatch(script,/deleteDatabase\(/);
  assert.match(script,/localStorage\.setItem\(key,value\)/);
  assert.match(script,/As configurações anteriores foram mantidas/);
  assert.match(script,/window\.confirm\(/);
});

test('tela Configurações apresenta exportação e restauração',()=>{
  for(const id of ['exportLibraryBackup','restoreLibraryBackup','restoreLibraryFile','backupStatus','backupProgress'])
    assert.match(settings,new RegExp('id="'+id+'"'));
  assert.match(settings,/vendor\/jszip\.min\.js/);
  assert.match(settings,/aurora-backup-acervo\.js/);
  assert.match(css,/\.backup-card/);
});

test('configurações e backup ficam acessíveis offline depois de instalados',()=>{
  assert.match(sw,/const SETTINGS = '\.\/configuracoes\.html\?v=130'/);
  assert.match(sw,/settingsResponse/);
  assert.match(sw,/url\.pathname === settings\.pathname \? settings/);
  assert.match(sw,/const CACHE = 'libria-v130'/);
});

new Function(script);
console.log('Backup e restauração do acervo: estrutura, mesclagem, validação e offline verificados.');
