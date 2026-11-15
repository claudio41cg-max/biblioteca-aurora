/* Catálogo particular: o endereço nunca é incluído nos arquivos públicos do GitHub. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const KEY='aurora-private-notion-link-v1';
  const status=message=>{$('notionStatus').textContent=message;};
  const validate=value=>{
    const url=new URL(String(value||'').trim());
    const host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||!
       (host==='notion.so'||host==='notion.com'||host.endsWith('.notion.so')||host.endsWith('.notion.com')||host.endsWith('.notion.site'))){
      throw Error('Informe um endereço HTTPS do Notion.');
    }
    return url.href;
  };
  const show=value=>{
    const url=validate(value);
    $('notionOutside').href=url;
    $('privateNotionReader').hidden=false;
    $('notionConfiguration').open=false;
    $('notionUrl').value='';
    status('Sua biblioteca particular está salva neste aparelho. Toque em abrir para pesquisar.');
  };
  const connect=value=>{
    const url=validate(value);
    localStorage.setItem(KEY,url);
    show(url);
  };
  $('notionConnectForm').addEventListener('submit',event=>{
    event.preventDefault();
    try{connect($('notionUrl').value);}
    catch(error){status(error.message||'Não foi possível salvar o endereço.');}
  });
  $('notionDisconnect').addEventListener('click',()=>{
    localStorage.removeItem(KEY);
    $('privateNotionReader').hidden=true;
    $('notionConfiguration').open=true;
    status('Acesso removido deste aparelho. Sua biblioteca no Notion não foi alterada.');
  });
  // Um link particular enviado ao próprio leitor pode conectar o catálogo uma vez,
  // sem registrar o endereço da biblioteca no código-fonte público da Aurora.
  const incoming=new URLSearchParams(location.hash.slice(1)).get('conectar');
  if(incoming){
    history.replaceState(null,'',location.pathname+location.search);
    try{connect(incoming);}catch(error){status(error.message||'Não foi possível conectar o catálogo.');}
  }else{
    try{const saved=localStorage.getItem(KEY);if(saved)show(saved);}
    catch{status('Conecte sua biblioteca particular para começar.');}
  }
})();
