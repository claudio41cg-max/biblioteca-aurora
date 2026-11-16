import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=file('index.html');
const mainCss=file('aurora-sala-3d.css');
const mainJs=file('aurora-sala-3d.js');
const pdf=file('meus-livros.html');
const pdfCss=file('aurora-vitrine.css');

for(const css of [mainCss,pdfCss]){
  assert.match(css,/#fff8ec 0%,#f6ebda 47%,#eadcc9 82%,#e1ceb6 100%/,
    'As duas salas devem ter o mesmo creme mais quente');
  assert.match(css,/#432e22/,'Título marrom-escuro combina com o creme');
  assert.match(css,/Palatino Linotype/,'Tipografia editorial e serifada');
}
assert.match(main,/id="auroraShowDescription"[^>]*open>/);
assert.match(pdf,/id="descriptionDetails"[^>]*open>/);
assert.match(mainJs,/\$\('auroraShowDescription'\)\.open=true/);
assert.match(pdf,/\$\('descriptionDetails'\)\.open=true/);
assert.doesNotMatch(mainJs,/\$\('auroraShowDescription'\)\.open=false/);
assert.doesNotMatch(pdf,/\$\('descriptionDetails'\)\.open=false/);
assert.match(main,/aurora-sala-3d.css\?v=7/);
assert.match(main,/aurora-sala-3d.js\?v=16/);
assert.match(pdf,/aurora-vitrine.css\?v=8/);
assert.match(file('sw.js'),/aurora-v46/);

console.log('V41: o creme, a tipografia e a descrição aberta valem para as duas telas 3D.');
