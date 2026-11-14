import {strict as assert} from 'node:assert';
import {readFileSync,statSync} from 'node:fs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html');
const script=read('aurora-avancado.js');
const styles=read('aurora-ambiente.css');

assert.equal((html.match(/data-wall-option=/g)||[]).length,6,'cinco paredes e a opção original');
assert.equal((html.match(/data-shelf-option=/g)||[]).length,6,'cinco prateleiras e a opção original');
assert.equal((html.match(/data-wall-tone=/g)||[]).length,7,'tons de parede');
assert.equal((html.match(/data-shelf-tone=/g)||[]).length,7,'tons de prateleira');
assert.match(html,/data-wall-tone="rosa"/);
assert.match(html,/data-shelf-tone="rosa"/);
assert.match(html,/id="environmentSave"/);
assert.match(html,/id="environmentCancel"/);
assert.match(html,/class="environment-preview"/);
assert.match(html,/id="roomTheme"/);
assert.match(html,/id="roomPlants"/);
assert.match(html,/aurora-ambiente\.css\?v=2/);
assert.match(script,/aurora-environment-v1/);
assert.match(script,/persistedEnvironment/);
assert.match(script,/localStorage\.setItem\(environmentKey/);
assert.match(script,/discardEnvironment\(\)/);
assert.match(styles,/\.cabinet\{[\s\S]*?background-image:none!important/);
assert.match(styles,/body\[data-shelf="original"\]/);
assert.match(read('sw.js'),/aurora-v28/);
assert.match(styles,/@media\(max-width:550px\)\{[\s\S]*?body\[data-wall\] \.library\{[\s\S]*?width:100%;max-width:none;margin:8px 0 0;padding:20px 0 30px/);
assert.match(styles,/body\[data-shelf\]:not\(\[data-shelf="original"\]\) \.shelf-lip\{margin:0;height:25px\}/);

for(let i=0;i<5;i++){
  for(const kind of ['parede','prateleira']){
    const path=`assets/ambientes/${kind}-${i}.webp`;
    const data=readFileSync(new URL('../'+path,import.meta.url));
    assert.equal(data.toString('ascii',0,4),'RIFF',path);
    assert.equal(data.toString('ascii',8,12),'WEBP',path);
    assert(statSync(new URL('../'+path,import.meta.url)).size<100000,'textura otimizada para o celular');
    assert(styles.includes(path),'textura referenciada: '+path);
    assert(read('sw.js').includes(path),'textura disponível offline: '+path);
  }
}
new Function(script);
console.log('Cinco paredes, cinco prateleiras, cores, salvamento e texturas offline validados.');
