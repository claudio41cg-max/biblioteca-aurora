/* Apresentações editoriais originais para obras clássicas reconhecidas pelo título.
   Para outros PDFs, usamos a descrição existente no arquivo, quando houver.
   Não inventamos uma sinopse para uma obra que não conseguimos identificar. */
(() => {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const works = [
    {
      keys:['orgulhoepreconceito','orgulhopreconceito'],
      title:'Orgulho e Preconceito',author:'Jane Austen',
      description:'Na Inglaterra do século XIX, Elizabeth Bennet conhece o reservado Fitzwilliam Darcy, e a primeira impressão entre os dois está longe de ser boa. Entre encontros inesperados, pressões familiares e diferenças sociais, ambos precisarão rever suas certezas. Um romance sobre amor, orgulho, julgamentos precipitados e a coragem de mudar.'
    },
    {
      keys:['razoeesensibilidade','razaoesensibilidade'],
      title:'Razão e Sensibilidade',author:'Jane Austen',
      description:'Após uma mudança brusca na vida da família Dashwood, as irmãs Elinor e Marianne enfrentam de maneiras muito diferentes as expectativas do amor e da sociedade. Uma tenta proteger os sentimentos com prudência; a outra se entrega à paixão. Jane Austen explora o conflito entre razão, sensibilidade, perdas e recomeços.'
    },
    {
      keys:['omorrodosventosuivantes','morrodosventosuivantes'],
      title:'O Morro dos Ventos Uivantes',author:'Emily Brontë',
      description:'Uma paixão intensa desafia o tempo e se transforma em vingança. Nos campos selvagens de Yorkshire, a ligação entre Heathcliff e Catherine Earnshaw marca o destino de duas famílias por gerações. Amor, ressentimento e obsessão se entrelaçam neste romance de atmosfera sombria e personagens inesquecíveis.'
    },
    {
      keys:['amoreninha','moreninha'],
      title:'A Moreninha',author:'Joaquim Manuel de Macedo',
      description:'Durante uma temporada na ilha de uma família amiga, o estudante Augusto conhece Carolina, uma jovem espirituosa que desafia suas ideias sobre o amor. Entre brincadeiras, promessas antigas e descobertas, surge um romance marcado pelo humor e pelos costumes do Rio de Janeiro do século XIX.'
    },
    {
      keys:['senhora'],
      title:'Senhora',author:'José de Alencar',
      description:'Aurélia Camargo, uma jovem que enriqueceu inesperadamente, decide confrontar as escolhas do homem que a abandonou por interesse. Em uma sociedade na qual casamento e dinheiro se confundem, ela transforma o próprio matrimônio em um jogo de orgulho, poder, ressentimento e afeto.'
    },
    {
      keys:['domcasmurro'],
      title:'Dom Casmurro',author:'Machado de Assis',
      description:'Bentinho revisita sua juventude e o relacionamento com Capitu, tentando reconstruir os acontecimentos que definiram sua vida. Contada por um narrador cheio de dúvidas e ciúmes, a história convida o leitor a questionar a memória, as aparências e aquilo que realmente se pode saber sobre outra pessoa.'
    },
    {
      keys:['memoriaspostumasdebrascubas','memoriaspostumas','brascubas'],
      title:'Memórias Póstumas de Brás Cubas',author:'Machado de Assis',
      description:'Brás Cubas decide contar sua história depois de morto. Livre das convenções dos vivos, revisita seus amores, ambições e fracassos com ironia cortante. Um romance inventivo que expõe as contradições da sociedade brasileira e brinca com a própria maneira de narrar.'
    },
    {
      keys:['ocortico','cortico'],
      title:'O Cortiço',author:'Aluísio Azevedo',
      description:'Em um cortiço no Rio de Janeiro, a vida dos moradores se cruza com as ambições de João Romão, decidido a enriquecer a qualquer custo. Desejos, disputas e desigualdades compõem um retrato intenso das relações sociais e das condições de vida no Brasil do século XIX.'
    },
    {
      keys:['iracema'],
      title:'Iracema',author:'José de Alencar',
      description:'Iracema, uma jovem indígena, vive um amor impossível com Martim, um guerreiro português. Entre a beleza da paisagem, os conflitos entre povos e a saudade da terra, José de Alencar constrói uma narrativa poética sobre encontro, pertencimento e perda.'
    },
    {
      keys:['amaquinadotempo','maquinadotempo'],
      title:'A Máquina do Tempo',author:'H. G. Wells',
      description:'Um inventor constrói uma máquina capaz de viajar através dos séculos. Ao chegar a um futuro distante, encontra uma humanidade muito diferente da que conhecia. A aventura se transforma em uma reflexão sobre progresso, desigualdade e o destino da civilização.'
    },
    {
      keys:['ailhamisteriosa','ilhamisteriosa'],
      title:'A Ilha Misteriosa',author:'Jules Verne',
      description:'Após escapar em um balão durante a Guerra Civil Americana, um grupo de homens chega a uma ilha desconhecida. Usando engenho, ciência e cooperação, eles lutam para sobreviver, enquanto acontecimentos misteriosos sugerem que talvez não estejam sozinhos.'
    },
    {
      keys:['viagemaocentrodaterra','centrodaterra'],
      title:'Viagem ao Centro da Terra',author:'Jules Verne',
      description:'O professor Lidenbrock encontra uma pista que pode levar ao interior do planeta. Ao lado do sobrinho Axel e de um guia experiente, parte para uma expedição extraordinária por cavernas e paisagens subterrâneas, onde ciência, imaginação e perigo caminham juntos.'
    },
    {
      keys:['frankenstein'],
      title:'Frankenstein',author:'Mary Shelley',
      description:'Victor Frankenstein ultrapassa os limites da ciência ao dar vida a uma criatura. Assustado com o resultado, ele abandona sua criação e desencadeia consequências trágicas. Uma história marcante sobre responsabilidade, solidão, preconceito e os limites da ambição humana.'
    }
  ];
  window.AuroraBookInfo = {
    find(title){
      const value=normalize(title);
      if(!value)return null;
      return works.find(work=>work.keys.some(key=>value.includes(key)))||null;
    }
  };
})();
