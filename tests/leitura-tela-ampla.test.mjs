import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const epub=read('ler-epub.html');
const epubCss=read('aurora-novos-leitores.css');
const text=read('index.html');
const textCss=read('aurora-estante.css');
const textJs=read('aurora-estante.js');
const online=read('ler-online.html');
const onlineCss=read('aurora-online.css');
const onlineJs=read('aurora-leitura-online.js');
const threeD=read('aurora-sala-3d.js');

assert.ok(epub.indexOf('id="previousChapter"')>epub.indexOf('id="settings"'), 'Capítulos EPUB ficam no painel Aa');
assert.match(epubCss,/\.epub-reader \.epub-page-controls\{\s*min-height:34px;height:34px/);
assert.match(read('aurora-epub-reader.js'),/const ratio=innerWidth<=670 \? \.64 : \.72/);
assert.match(threeD,/ler-epub\.html\?livro=/,'EPUB mantém entrada física 3D');

assert.match(text,/id="txtSettingsButton"/);
assert.match(text,/id="txtReaderPrefs" hidden/);
assert.match(textCss,/@media\(max-width:699px\).*#overlay \.paper\.right\{display:none!important\}/s,'TXT mostra uma página grande por vez no celular');
assert.match(textJs,/const txtStep=\(\)=>window\.innerWidth>=700\?2:1/);
assert.match(textJs,/AuroraShelfViewer\.open\(button/,'TXT preserva o livro 3D');

assert.match(online,/<details class="online-reader-options"/);
assert.match(onlineCss,/\.online-reader-page \.online-paper\{height:100%;min-height:0;overflow-y:auto/,'Texto online não fica cortado na folha');
assert.match(onlineJs,/AuroraPageSound\?\.play\(\)/,'Texto online tem som de folha');
assert.match(online,/aurora-leitura-online\.js\?v=6/);

console.log('Leitura de tela ampla: EPUB, TXT, online e 3D preservados.');
