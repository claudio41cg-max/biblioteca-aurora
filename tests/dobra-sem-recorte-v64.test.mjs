import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const html = read('meus-livros.html');
const launcher = read('aurora-sala-3d.js');

// O leitor delega a trajetória da dobra ao PageFlip. O ajuste de Razão e
// Sensibilidade determina o tamanho da folha e o acabamento do volume.
assert.match(html, /const reasonPdf = mobile && \$\('reader'\)\.classList\.contains\('aurora-page-curl-preview'\)/);
assert.match(html, /visualTitle\.includes\('razao e sensibilidade'\)/);
const measureLeaf = html.match(/const leafHeight = ([^\n;]+);/)?.[1];
assert.ok(measureLeaf, 'O leitor calcula a altura da folha antes de criar a animação');
const leafHeight = new Function('reasonPdf', 'height', '$', 'return ' + measureLeaf);
const viewport = () => ({clientHeight: 500});
assert.equal(leafHeight(false, 430, viewport), 430, 'Outros exemplares conservam a altura calculada');
assert.ok(leafHeight(true, 430, viewport) >= 430, 'A folha piloto pode usar o espaço adicional');
assert.ok(leafHeight(true, 495, viewport) <= 500, 'A folha piloto cabe na área disponível');

assert.match(html, /new St\.PageFlip\(host,\{\s*width,height:leafHeight/);
assert.match(html, /flippingTime:900,usePortrait:mobile/);
assert.match(html, /session\.flip\.loadFromHTML\(session\.pages\);\s*host\.classList\.add\('ready'\);\s*installReaderVolume/);
assert.match(html, /session\.flip\.on\('flip'/);
assert.match(html, /persistProgress\(session\)/);
assert.match(launcher, /meus-livros\.html\?livro=/);
