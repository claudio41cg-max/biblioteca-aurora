import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source=read('aurora-epub-reader.js');
const helpers=source.slice(source.indexOf('  const paperPalette='),source.indexOf('  function paginateContent('));
const pages=[];
const sheetContext=()=>{
  const operations=[];
  const context={operations,fillStyle:'',font:'',textAlign:'',textBaseline:'',
    setTransform(...args){operations.push(['scale',...args]);},
    fillRect(...args){operations.push(['fillRect',...args]);},
    fillText(...args){operations.push(['fillText',...args]);},
    drawImage(...args){operations.push(['drawImage',...args]);},
    measureText(text){return {width:text.length*9};},
    createLinearGradient(){return {addColorStop(){}};}
  };
  return context;
};
const document={createElement(tag){
  assert.equal(tag,'canvas');
  const context=sheetContext();
  const canvas={style:{},context,isConnected:true,setAttribute(){},getContext(_type,options){
    if(options)assert.equal(options.alpha,false,'A dobra não pode usar pixels transparentes');
    return context;
  }};
  pages.push(canvas);return canvas;
}};
const settings={theme:'light',size:18,line:1.55,font:'Georgia'};
const engine=new Function('document','settings','window','innerWidth',helpers+'return {paginate,paintSheet,textLines};')
  (document,settings,{devicePixelRatio:2},390);
const text=Array.from({length:50},(_,i)=>`O parágrafo ${i} precisa ser lido por completo e não pode sumir no meio da dobra.`).join('\n\n');
const chunks=engine.paginate(text,270,420);
assert.ok(chunks.length>3,'Textos longos precisam de várias folhas');
assert.equal(chunks.join(' ').replace(/\s+/g,''),text.replace(/\s+/g,''),'Nenhuma palavra pode desaparecer durante a paginação');
for(let index=0;index<chunks.length;index++){
  const canvas=engine.paintSheet(chunks[index],270,420,index+1);
  assert.equal(canvas.width,540);
  assert.equal(canvas.height,840);
  assert.ok(canvas.context.operations.some(op=>op[0]==='fillRect'&&op[1]===0&&op[2]===0&&op[3]===270&&op[4]===420),
    'A folha inteira deve ser preenchida com papel opaco');
  const textOperations=canvas.context.operations.filter(op=>op[0]==='fillText');
  assert.ok(textOperations.length>1);
  assert.ok(textOperations.every(op=>op[0]!=='fillText'||op[2]>=0&&op[2]<=270));
  assert.ok(textOperations.every(op=>op[3]<=420),'As linhas e o número não podem ultrapassar o papel');
}
settings.theme='night';
assert.ok(engine.paintSheet('Folha noturna',270,420,1).context.operations.some(op=>op[0]==='fillRect'));
assert.match(source,/txtTitle\?'txt:'\+txtTitle/,'TXT também passa pelo mesmo leitor de folhas');
assert.match(read('aurora-estante.js'),/openSharedTxt/,'TXT importado deve abrir o leitor unificado');
assert.match(read('aurora-sala-3d.js'),/addEventListener\('pageshow'/,'O retorno do Android deve atualizar o título 3D');

const catalog={};
vm.runInNewContext(read('aurora-sinopses.js'),{window:catalog});
const love=catalog.AuroraBookInfo.find('A Hipotese Do Amor Sucesso Do TikTok Portuguese Edition');
assert.equal(love.title,'A hipótese do amor');
assert.equal(love.year,'2021');
assert.equal(love.referencePages,384);
assert.match(love.description,/Olive Smith/);
assert.match(read('index.html'),/id="auroraDescriptionPages"/);
assert.match(read('index.html'),/id="auroraDescriptionFormat"/);
assert.match(read('aurora-sala-3d.js'),/Trecho inicial do arquivo \(não é sinopse\)/);
assert.match(read('aurora-sala-3d.css'),/\.aurora-show-description\{[\s\S]*?border:0/);

console.log('Versão 39: folhas opacas, texto completo, EPUB/TXT, descrições e retorno Android verificados.');
