import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pdf=read('meus-livros.html');
const epub=read('ler-epub.html');
const flip=read('aurora-epub-reader.js');
const main3d=read('aurora-sala-3d.css');
const pdf3d=read('aurora-vitrine.css');
const pdfCss=read('aurora-reader.css');

// Botões iguais, progresso central, marcador e painel Aa em ambos os formatos.
for(const html of [pdf,epub]){
  assert.match(html,/id="previousPage"/);
  assert.match(html,/id="nextPage"/);
  assert.match(html,/>↶<\/button>/);
  assert.match(html,/>↷<\/button>/);
  assert.match(html,/>Aa<\/button>/);
  assert.match(html,/🔖/);
  for(const title of ['Georgia','Palatino','Garamond','Times New Roman','Arial','Verdana'])
    assert.ok(html.includes('>'+title+'</option>'),'Falta a fonte '+title);
  for(const theme of ['Claro','Sépia','Noturno'])assert.ok(html.includes('>'+theme+'</button>'));
  assert.match(html,/Som suave de folhas ao virar/);
  assert.match(html,/Ouvir o texto/);
}
assert.doesNotMatch(epub,/id="(?:previousChapter|nextChapter|chapterLabel)"/,
  'Os três controles de capítulos não devem aparecer no painel');
assert.match(pdf,/Opções adicionais do PDF/,'As opções exclusivas do PDF ficam recolhidas');
assert.match(pdf,/active\.flip\.flipNext\('bottom'\)/);
assert.match(pdf,/active\.flip\.flipPrev\('bottom'\)/);
assert.match(flip,/loadFromImages\(imagePages\)/,
  'O EPUB deve usar CanvasRender para que não haja camadas HTML transparentes');
assert.doesNotMatch(flip,/flip\.loadFromHTML\(/,
  'Não voltar ao motor HTML que deixava folhas fantasmas');
assert.match(flip,/toDataURL\('image\/jpeg',\.97\)/,
  'Papel e texto devem virar imagens de alta qualidade, opacas');
assert.match(flip,/await Promise\.all\(elements\.map/,
  'As ilustrações precisam terminar de carregar antes da folha ser convertida');
assert.match(flip,/const currentDraw=\+\+drawGeneration/,
  'Mudar de capítulo rápido não pode trazer páginas de uma renderização antiga');
assert.match(flip,/aurora-reading-preferences-v2/);
assert.match(pdf,/aurora-reading-preferences-v2/);

// Ambos os visores 3D usam o mesmo creme, preservando o padrão da biblioteca.
assert.match(main3d,/#fff8ec 0%,#f6ebda 47%,#eadcc9/);
assert.match(pdf3d,/#fff8ec 0%,#f6ebda 47%,#eadcc9/);
assert.match(main3d,/\.aurora-show-description\{[\s\S]*?border:0/);
assert.match(pdf3d,/\.book-description\{[\s\S]*?border:0/);
assert.match(pdfCss,/\.showcase \.showhead button,\.showcase \.showhead \.category-editor select\{[\s\S]*?border:0/);
assert.match(pdfCss,/\.reader \.reader-prefs-card/);
assert.match(pdfCss,/\.pdf-page-controls/);
assert.match(read('sw.js'),/aurora-v44/);

console.log('V41: creme nos dois visores, mesmo Aa e navegação, EPUB sem transparência HTML.');
