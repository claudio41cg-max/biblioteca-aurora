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
      title:'Orgulho e Preconceito',author:'Jane Austen',country:'Inglaterra',year:'1813',
      description:'Na Inglaterra do século XIX, a família Bennet tem cinco filhas e uma preocupação constante: encontrar casamentos que lhes garantam segurança. Elizabeth, inteligente e independente, não pretende aceitar um destino apenas por conveniência. Quando conhece Fitzwilliam Darcy, um homem reservado e de posição social elevada, os dois se deixam levar por primeiras impressões pouco favoráveis. Entre bailes, visitas, comentários maldosos e revelações inesperadas, Elizabeth precisa distinguir orgulho de dignidade, enquanto Darcy confronta seus próprios preconceitos. Jane Austen constrói uma história de amor e amadurecimento que também observa, com humor e ironia, a sociedade de sua época.'
    },
    {
      keys:['razoeesensibilidade','razaoesensibilidade'],
      title:'Razão e Sensibilidade',author:'Jane Austen',country:'Inglaterra',year:'1811',
      description:'Após uma mudança brusca na vida da família Dashwood, as irmãs Elinor e Marianne enfrentam de maneiras muito diferentes as expectativas do amor e da sociedade. Uma tenta proteger os sentimentos com prudência; a outra se entrega à paixão. Jane Austen explora o conflito entre razão, sensibilidade, perdas e recomeços.'
    },
    {
      keys:['omorrodosventosuivantes','morrodosventosuivantes'],
      title:'O Morro dos Ventos Uivantes',author:'Emily Brontë',country:'Inglaterra',year:'1847',
      description:'Nas paisagens ventosas de Yorkshire, no norte da Inglaterra, Heathcliff chega ainda menino à propriedade da família Earnshaw. A convivência com Catherine cria uma ligação profunda e turbulenta, mas as diferenças sociais e as escolhas da juventude colocam obstáculos entre eles. O que começa como uma história de afeto e pertencimento se transforma em uma sucessão de mágoas, obsessões e conflitos que alcançam a geração seguinte. Narrado por vozes diferentes, o romance revela aos poucos os segredos de duas casas vizinhas e mostra como o desejo de vingança pode marcar uma família inteira. É uma obra intensa sobre amor, liberdade, orgulho e as consequências das escolhas humanas.'
    },
    {
      keys:['amoreninha','moreninha'],
      title:'A Moreninha',author:'Joaquim Manuel de Macedo',country:'Brasil',year:'1844',
      description:'Durante uma temporada na ilha de uma família amiga, o estudante Augusto conhece Carolina, uma jovem espirituosa que desafia suas ideias sobre o amor. Entre brincadeiras, promessas antigas e descobertas, surge um romance marcado pelo humor e pelos costumes do Rio de Janeiro do século XIX.'
    },
    {
      keys:['senhora'],
      title:'Senhora',author:'José de Alencar',country:'Brasil',year:'1875',
      description:'Aurélia Camargo, uma jovem que enriqueceu inesperadamente, decide confrontar as escolhas do homem que a abandonou por interesse. Em uma sociedade na qual casamento e dinheiro se confundem, ela transforma o próprio matrimônio em um jogo de orgulho, poder, ressentimento e afeto.'
    },
    {
      keys:['domcasmurro'],
      title:'Dom Casmurro',author:'Machado de Assis',country:'Brasil',year:'1899',
      description:'Bentinho revisita sua juventude e o relacionamento com Capitu, tentando reconstruir os acontecimentos que definiram sua vida. Contada por um narrador cheio de dúvidas e ciúmes, a história convida o leitor a questionar a memória, as aparências e aquilo que realmente se pode saber sobre outra pessoa.'
    },
    {
      keys:['memoriaspostumasdebrascubas','memoriaspostumas','brascubas'],
      title:'Memórias Póstumas de Brás Cubas',author:'Machado de Assis',country:'Brasil',year:'1881',
      description:'Brás Cubas decide contar sua história depois de morto. Livre das convenções dos vivos, revisita seus amores, ambições e fracassos com ironia cortante. Um romance inventivo que expõe as contradições da sociedade brasileira e brinca com a própria maneira de narrar.'
    },
    {
      keys:['ocortico','cortico'],
      title:'O Cortiço',author:'Aluísio Azevedo',country:'Brasil',year:'1890',
      description:'Em um cortiço no Rio de Janeiro, a vida dos moradores se cruza com as ambições de João Romão, decidido a enriquecer a qualquer custo. Desejos, disputas e desigualdades compõem um retrato intenso das relações sociais e das condições de vida no Brasil do século XIX.'
    },
    {
      keys:['iracema'],
      title:'Iracema',author:'José de Alencar',country:'Brasil',year:'1865',
      description:'Iracema, uma jovem indígena, vive um amor impossível com Martim, um guerreiro português. Entre a beleza da paisagem, os conflitos entre povos e a saudade da terra, José de Alencar constrói uma narrativa poética sobre encontro, pertencimento e perda.'
    },
    {
      keys:['amaquinadotempo','maquinadotempo'],
      title:'A Máquina do Tempo',author:'H. G. Wells',country:'Inglaterra',year:'1895',
      description:'Um inventor constrói uma máquina capaz de viajar através dos séculos. Ao chegar a um futuro distante, encontra uma humanidade muito diferente da que conhecia. A aventura se transforma em uma reflexão sobre progresso, desigualdade e o destino da civilização.'
    },
    {
      keys:['ailhamisteriosa','ilhamisteriosa'],
      title:'A Ilha Misteriosa',author:'Jules Verne',country:'França',year:'1874–1875',
      description:'Após escapar em um balão durante a Guerra Civil Americana, um grupo de homens chega a uma ilha desconhecida. Usando engenho, ciência e cooperação, eles lutam para sobreviver, enquanto acontecimentos misteriosos sugerem que talvez não estejam sozinhos.'
    },
    {
      keys:['viagemaocentrodaterra','centrodaterra'],
      title:'Viagem ao Centro da Terra',author:'Jules Verne',country:'França',year:'1864',
      description:'O professor Lidenbrock encontra uma pista que pode levar ao interior do planeta. Ao lado do sobrinho Axel e de um guia experiente, parte para uma expedição extraordinária por cavernas e paisagens subterrâneas, onde ciência, imaginação e perigo caminham juntos.'
    },
    {
      keys:['frankenstein'],
      title:'Frankenstein',author:'Mary Shelley',country:'Inglaterra',year:'1818',
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
