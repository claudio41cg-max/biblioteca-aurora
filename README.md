# Biblioteca Aurora

## Atualização v50 — lombadas com detalhes reais das capas em todas as estantes

- As estantes compartilham o mesmo acabamento premium, independentemente da categoria. Cada volume conserva largura, altura, inclinação e capa próprias.
- Quando a edição tem capa, a lombada ilustrada preserva as cores **e incorpora uma faixa suavizada da arte da capa original**, acrescentando detalhes específicos sem esticar toda a fotografia nem sacrificar a leitura do título.
- Lombadas reais fornecidas pelo exemplar nunca são substituídas. Capas provisórias permanecem identificadas como ilustrativas e não imitam uma edição específica.
- O leitor de EPUB agora reconhece também uma capa incorporada na primeira página XHTML sem sinalização de capa no índice do arquivo. O aplicativo tenta recuperar automaticamente as capas antigas em segundo plano uma vez na versão 50.
- Não são realizadas pesquisas externas pelos títulos da biblioteca. Livros sem imagem de capa no arquivo permanecem com a ilustração individual até receberem uma fotografia verdadeira.
- Visor 3D WebGL, folheio, leitura, progresso e catálogos continuam inalterados.
- Backup de retorno: `backup-aurora-v49-antes-unificacao-visual-20261116`.

## Atualização v49 — cores autênticas nas lombadas e capas recuperadas

- A lombada gerada agora examina **toda a capa original**, dando peso às cores da ilustração, mesmo quando as margens são pretas ou brancas. Não troca mais o matiz por cinza/preto/creme para tentar forçar contraste de texto.
- Quando uma imagem de outro domínio não permite leitura de pixels (CORS), a lombada exibe um fragmento da **própria imagem da capa**, em vez de escolher tecido genérico pelo título.
- EPUBs antigos com capa ilustrativa ou sem capa passam por uma tentativa de recuperar a arte **embutida no arquivo original**, em segundo plano, sem precisar abrir o livro. A tentativa é marcada no aparelho para evitar reprocessamentos em cada visita.
- Se o EPUB não contiver imagem de capa, a ilustração é identificada como provisória e passa a usar uma paleta particular por exemplar, sem fingir ser a capa original. Uma edição só ganha capa original se seus arquivos realmente a contiverem ou se for fornecida a imagem.
- Preservados: capas e lombadas originais, dimensões e ângulos, demais estantes, catálogos, livro 3D, leitores e progresso.
- Backup anterior à alteração: ramo `backup-aurora-v48-antes-cores-lombadas-20261116`.

## Atualização v48 — acabamento realista em todas as estantes

- O acabamento antes exclusivo de **Romances** agora acompanha todas as categorias: madeira iluminada, reflexos sutis, sombras reduzidas e volumes apoiados com perspectivas naturais.
- Cada livro conserva altura, largura, espessura, inclinação e capa próprias, calculadas a partir de seus dados e identificador. Não há uma capa genérica aplicada sobre edições importadas.
- As lombadas reais prevalecem sobre as geradas. As lombadas ilustrativas de alta resolução (v47) continuam funcionando em qualquer prateleira, com título legível.
- Livros on-line e outros formatos que já trazem capa ou lombada também mostram sua face física original na estante, sem alterar o leitor correspondente.
- Categorias, catálogos, organização, toque para retirar o livro, livro WebGL 3D, folheio e progresso permanecem intactos.
- Backup de retorno: ramo `backup-aurora-v47-antes-estantes-unificadas-20261116`.

## Atualização v47 — lombadas mais nítidas na estante

- Livros importados sem fotografia da lombada recebem uma textura própria desenhada em canvas, em alta resolução, baseada nas cores da capa. Acabamentos variam entre filetes, faixas, losangos e estrelas.
- Títulos são impressos na textura para reduzir borrões e serrilhados. A acessibilidade mantém o nome completo no botão do livro.
- Capas e fotos originais de lombada não são substituídas. Se a imagem remota não permitir leitura de pixels, usamos uma cor de tecido determinada pelo título, sem deformar a capa.
- Desenho preparado em pequenos grupos e com cache limitado para preservar o desempenho do celular.
- O modo offline guarda a página principal antes da ativação, tolera falhas de arquivos secundários e permite recuperar a biblioteca do cache após seis segundos sem resposta da rede.
- A versão anterior pode ser restaurada do ramo `backup-aurora-v46-antes-lombadas-20261116`.

## Atualização v46 — acabamento de estúdio no livro 3D

- O visor físico usa mapeamento de tons neutro para reproduzir as cores das capas com mais fidelidade, iluminação suave com reflexos largos e sombra difusa discreta. Aparelhos com pouca memória mantêm a iluminação convencional.
- Contracapas ilustrativas e lombadas geradas recebem texturas em resolução dobrada; fotos originais de frente, verso e lombada continuam tendo prioridade, sem copiar a capa da frente para o verso.
- O livro gira com inércia curta, limitada e independente da taxa de atualização da tela. A animação de abertura é mais suave e respeita a preferência por movimento reduzido.
- Mantidas as fibras verticais do corte das páginas, o visor CSS de compatibilidade, os arquivos importados, leitores de PDF/EPUB/TXT, catálogos e progresso.
- Backup anterior à alteração: ramo `backup-aurora-v45-antes-realismo-3d-20261116` no GitHub. A versão 45 permanece intacta para eventual restauração.

## Atualização v45 — corte natural das folhas e contracapas EPUB

- O livro físico 3D mostra microfiletes **verticais** no corte das páginas, com fibras, pequenos riscos, manchas discretas perto da encadernação e luz nas bordas. As superfícies de cima e de baixo continuam com orientação própria. O mesmo acabamento funciona no WebGL e no visor CSS de compatibilidade.
- Contracapas originais de PDF continuam sendo recuperadas somente quando a própria edição as oferece. Agora EPUBs também procuram imagens expressamente identificadas como `backcover`, `contracapa` ou equivalente, sem confundir uma página do texto com a contracapa.
- Os novos EPUBs guardam a imagem original do verso no mesmo registro do livro. EPUBs antigos procuram essa imagem ao serem abertos pela primeira vez, sem duplicar o arquivo no telefone.
- Quando não há contracapa identificável, permanece a **contracapa ilustrativa**, marcada como tal; não é apresentada como arte original.
- Preservados os livros, capas, catalogação por categoria, rotação 3D, toque para abrir, leitura e progresso.

## Atualização v44 — catálogos por prateleira

- Ao lado do título de **cada** categoria há a ação **Catálogos**, substituindo a linha decorativa e o botão antigo **Ver original** na primeira prateleira.
- O catálogo abre na própria Aurora, exibe as capas em uma galeria de três colunas no celular e oferece **Mais capas** quando há muitos livros.
- As capas mostradas são as **mesmas dos arquivos importados** da prateleira, sem copiar livros nem ocupar espaço adicional com outros arquivos. Para livros sem capa, aparece a capa identificada como ilustrativa, nunca como original.
- O catálogo lê diretamente as lombadas da categoria, incluindo PDFs, EPUBs, TXT, áudios e livros on-line; quando algum livro entra, sai ou muda de prateleira, a galeria acompanha a mudança.
- Tocar numa capa equivale a pegar o mesmo livro na estante: preservados o voo até o visor 3D, a rotação, a descrição, a leitura e o progresso.

## Atualização v43 — acabamento de livro físico e iluminação delicada

- No visor 3D de todos os livros, o corte lateral das páginas ganhou filetes **verticais**, como folhas vistas de pé. O topo e a base usam outra orientação de textura para continuar naturais.
- Quando a edição não contém contracapa, ela passa a ter uma versão ilustrativa com título, autor, texto da edição quando disponível e um **código de barras apenas decorativo**, sem ISBN inventado. Contracapas originais têm prioridade.
- A sala do livro tem fundo creme ligeiramente mais luminoso e sombras mais suaves, inclusive no modo CSS de compatibilidade.
- A primeira prateleira experimental ficou mais iluminada, com sombras menos carregadas e inclinações individuais discretas. O botão para comparar com o visual original continua funcionando.
- Mantidos: capa original, capa real do verso quando houver, livro 3D giratório, abertura, todos os leitores e arquivos importados.

## Atualização v42 — comparação de uma prateleira mais realista

- Apenas **Romances**, a primeira prateleira, recebeu um visual experimental com iluminação de madeira, sombreamento mais profundo, volumes com alturas e espessuras distintas, detalhes finos nas lombadas e capas reais preservadas.
- O botão **Ver original / Ver realista** no cabeçalho de Romances permite comparar os dois estilos imediatamente. A preferência fica salva somente no navegador do usuário; o teste começa ativado.
- As outras prateleiras, todos os livros importados, capas originais, interação de pegar e girar em 3D, página de leitura e sistema de organização continuam como estavam. A biblioteca pode voltar ao visual original sem perder dados.

## Atualização v41 — sala creme e sinopse à vista

- As duas apresentações do livro 3D usam o mesmo fundo creme quente, mais próximo da madeira e dos detalhes dourados da biblioteca. Os textos são marrom-escuro para manter a leitura confortável.
- Títulos, autores, comandos e sinopses receberam tipografia de inspiração editorial, em famílias serifadas elegantes. Os comandos continuam sem molduras.
- A descrição abre automaticamente ao pegar qualquer livro no visor 3D, tanto no visor principal quanto no de PDF, e pode ser fechada ao tocar no título da descrição.
- As capas, a movimentação 3D, a navegação de páginas, os ajustes de leitura e os livros já importados foram preservados.

Biblioteca pessoal PWA, hospedada no GitHub Pages, com estante realista, livros por categoria, PDF e TXT e visualização 3D.

## Edição 40: um mesmo padrão para PDF, EPUB e TXT

- O visor 3D da estante principal e o visor 3D interno dos PDFs agora têm fundo **off-white**, letras escuras e detalhes dourados discretos. Os controles Estante, categoria e Descrição ficam sem moldura, inclusive ao voltar da leitura.
- Para evitar as folhas transparentes, o EPUB/TXT passou do renderizador HTML do St.PageFlip para o **renderizador Canvas** (`loadFromImages`): o texto e as ilustrações são primeiro pintados em folhas JPEG sem canal alfa, e o próprio motor faz a dobra, as sombras e o brilho. O PDF preserva seu folheio original que já funcionava.
- Os leitores PDF, EPUB e TXT oferecem botões inferiores com **↶ / ↷**, contagem central, marcador no topo e painel Aa com o mesmo modelo de fonte, tamanho, entrelinha, papel Claro/Sépia/Noturno, som e narração. O EPUB não mostra mais os controles de capítulos; ao terminar uma parte, Próxima avança para a seguinte.
- As preferências visuais passam a ser compartilhadas via `aurora-reading-preferences-v2` no mesmo aparelho. Opções especiais do PDF (zoom, texto adaptado e página direta) ficam recolhidas em "Opções adicionais do PDF". As fontes e entrelinhas alteram PDFs somente quando o arquivo permite **Texto adaptado**; páginas digitalizadas conservam a aparência original e zoom.
- Os livros importados não foram alterados, nem os capítulos, as capas originais, as descrições e as informações de progresso salvas.

## Uso no celular

### EPUB: páginas e capítulos completos

**Correção de capítulos ilustrados (edição 36):** alguns EPUBs apresentavam a frase “Este capítulo não contém texto selecionável” porque o extrator antigo descartava as imagens dos capítulos. `aurora-formatos.js` agora lê textos, legendas e imagens do próprio EPUB na ordem correta; o leitor apresenta ilustrações em folhas físicas separadas, sem carregar endereços externos. Capítulos realmente vazios de navegação ou frontispício são ignorados ao avançar ou voltar, sem interromper o livro em uma página falsa. Também foi corrigido o gesto de deslizar, que antes ficava preso ao elemento de página removido durante a reconstrução do livro. Imagens de capas e EPUBs previamente importados continuam armazenados no aparelho; não é necessário baixar novamente. Arquivos específicos com DRM, estrutura fora do padrão ou desenhos SVG especiais ainda podem exigir análise do próprio EPUB.

**Leitura aprimorada (edição 35, 15/11/2026):** o EPUB mantém o mesmo visor 3D do PDF, mas agora também aproxima o visual do leitor: folhas maiores e centralizadas, papel com sombras, número da página, barra compacta de progresso, tipografia clássica e opções de fonte, tamanho, espaçamento e tema. Corrigido um defeito de reconstrução do componente PageFlip que podia fazer um capítulo EPUB aparecer vazio após a primeira mudança de página ou capítulo. A medição da paginação respeita as quebras de linha reais e reserva espaço para a numeração. Os leitores continuam independentes porque o PDF preserva a diagramação fixa original e o EPUB adapta o texto à tela.

**Som de folhas:** `aurora-som-folhas.js` sintetiza dois ruídos muito suaves de papel no próprio aparelho, sem rede e sem arquivos de som. O áudio é iniciado mediante gesto do usuário, durante o folheio de PDF ou EPUB e nas trocas de páginas TXT. Em PDF, EPUB e TXT no leitor unificado, pode ser desativado em **Aa → Som suave de folhas ao virar**; a preferência é compartilhada. Os botões **Estante** e **Romances** do visor 3D usam letra clássica inclinada sem caixa nem contorno (edição 39). PDFs existentes, seu folheio físico e os livros já importados não são convertidos nem apagados.

**Entrada 3D unificada (edição 34, refinada na 39):** toda lombada adicionada à estante deve passar pelo mesmo volume físico e animação antes de abrir seu leitor. Isso inclui PDF e EPUB locais, TXT importado e referências de livros online. Ao abrir a capa de um TXT, a Aurora usa o mesmo leitor de papel opaco do EPUB; ao abrir a capa de uma obra online, segue para `ler-online.html`, mantendo os arquivos na fonte original. Audiolivros com capa também seguem o visor. Livros demonstrativos sem conteúdo integral apresentam uma capa explicitamente identificada como **DEMONSTRAÇÃO**, sem afirmar que a obra completa foi instalada.

O visor gera capas ilustrativas para edições sem imagens e, se uma capa remota não carregar, preserva a entrada 3D usando uma capa local. A seleção de categoria de livros TXT ou online atualiza respectivamente `aurora-txt-categories` e `aurora-online-books-v1`; PDFs e EPUBs continuam utilizando IndexedDB. Os leitores de PDF, EPUB, TXT e online permanecem com suas características individuais; apenas a retirada, rotação e abertura do livro foram padronizadas.

**EPUB também passa pela estante 3D:** ao tocar em um EPUB importado, a Aurora usa o mesmo voo até o centro da tela, a rotação e a abertura do livro que já existiam para PDF. Quando o EPUB traz uma capa embutida, ela é usada no volume 3D. Para versões que não declaram a capa corretamente, o importador procura também imagens identificadas como `cover`/`capa` e referências `guide` de EPUB 2. Se realmente não houver capa, cria uma arte tipográfica identificada **CAPA ILUSTRATIVA • EPUB**; ela não finge ser a capa original de uma edição física.

EPUBs importados antes dessa atualização **não precisam ser baixados novamente**: ao tocar em um deles sem imagem, a Aurora tenta recuperar a capa do arquivo que já está no IndexedDB, salva a correção e abre o mesmo visor físico. Isso não modifica os PDFs existentes nem o conteúdo do EPUB. O leitor de capítulos `ler-epub.html` continua separado, iniciado ao abrir a capa 3D.

O leitor `ler-epub.html` tem controles **‹ Anterior / Próxima ›** que passam pelas páginas e avançam automaticamente ao próximo capítulo quando o atual termina. As setas do teclado e o gesto lateral também funcionam; se a biblioteca de animação externa estiver indisponível, os controles continuam funcionando no modo de leitura simples. O efeito de folhear é mantido quando o PageFlip carrega.

Os EPUBs são percorridos na ordem `spine` do pacote, com leitura de parágrafos e blocos XHTML. Para arquivos grandes, apenas 24 folhas opacas são montadas no visualizador de cada vez, evitando sobrecarregar o celular. Arquivos continuam locais no IndexedDB e o progresso salvo segue sendo recuperado. O service worker também permite reabrir a URL do leitor com `?livro=...` offline, depois de os recursos terem sido instalados em cache.

EPUBs compostos somente por fotografias das páginas, com DRM ou estrutura corrompida podem precisar de um tratamento próprio e de um arquivo de teste do usuário. Não alteramos o leitor PDF, o exemplar 3D nem as páginas físicas existentes.

### Minha biblioteca particular (Notion)

Na estante e em **Explorar livros**, o botão **Minha biblioteca particular** abre `minha-biblioteca-privada.html`. O proprietário pode informar o endereço HTTPS do seu Notion Site e salvá-lo **somente no armazenamento local do navegador** (`aurora-private-notion-link-v1`), ou abrir um link pessoal de conexão usando o fragmento `#conectar=<URL codificada>`. Esse fragmento é removido imediatamente da barra de endereço depois de ser lido. **Não inclua o endereço de uma biblioteca paga no código público nem no service worker.** Outros leitores não recebem a configuração.

A página salva um atalho particular para abrir o Notion Site e usar a própria busca do catálogo, sem tentar ler a tabela via API, contornar login ou copiar PDFs e EPUBs. O catálogo testado recusou a incorporação em iframe, portanto não se deve exibir um quadro vazio ou erro de conexão; o botão abre diretamente o Notion em uma aba. Consulta integrada pela mesma caixa de pesquisa da Aurora só será possível com acesso autorizado da integração à base do Notion e hospedagem segura dos tokens, ou código oficial de incorporação fornecido por quem administra o site. Quem compartilha apenas um link de visualização de um workspace externo não concede acesso à API do banco de dados.

### Explorar livros online (sem baixar automaticamente)

Na página principal, **⌕ Buscar livros** abre `explorar-livros.html`. A pesquisa consulta, em paralelo, até quatro acervos de livros (Wikisource, Open Library, Wikilivros e obras do Project Gutenberg catalogadas pelo Internet Archive). Para audiolivros, consulta o LibriVox e, caso falhe, o catálogo de gravações do Internet Archive. Resultados aparecem dentro da Aurora, sem links externos visíveis na busca. As APIs externas podem estar indisponíveis ou sujeitas a bloqueios de CORS no navegador. É possível escolher português ou todos os idiomas.

A pesquisa começa em **Português** e só muda para outros idiomas se o leitor escolher. Edições que não declaram português nos metadados não são exibidas no filtro português. As miniaturas das edições digitalizadas vêm do catálogo oficial da origem, quando existem; obras textuais sem imagem usam uma capa tipográfica que **não é apresentada como capa original**. O leitor de texto oferece tamanho de letra, papel claro, sépia e modo noite, com preferências salvas no navegador e gesto horizontal para mudar de página.

**Baixe Livros (`www.baixelivros.com.br`)**: o site oferece edições em português, mas não disponibiliza uma API pública de integração confirmada nem autorização genérica para embutir seus PDFs em aplicativos de terceiros. Em especial, a tradução de *Persuasão* de Vitória Gomes Menezes (Baixe Livros, 2026) tem direitos próprios e distribuição autorizada na plataforma de origem. Até existir autorização expressa, **não copiar, incorporar, baixar em massa nem redirecionar de modo disfarçado** esses exemplares pela Aurora. A inclusão do acervo como uma fonte integrada precisa ser negociada com os titulares; o pedido do proprietário da Aurora é manter o usuário dentro do aplicativo.

Ao tocar em **Ler na Aurora** ou **Ouvir na Aurora**, abre-se `ler-online.html`: textos livres do Wikisource/Wikilivros são apresentados em folhas navegáveis; digitalizações públicas do Internet Archive/Open Library usam o leitor incorporado disponibilizado pelo próprio acervo; audiolivros usam o player incorporado ou as faixas do LibriVox. O usuário continua no endereço da Aurora. A incorporação de livros digitalizados ainda pode mostrar marcas do leitor original e algumas edições podem exigir acesso específico. O botão **Adicionar à estante** guarda **apenas metadados e identificação do acervo** no `localStorage` (`aurora-online-books-v1`), sem baixar automaticamente PDF, EPUB, MP3 ou imagens. O livro aparece com a etiqueta **ONLINE**, e a lombada abre o leitor da Aurora. **Organizar livros → Excluir** remove a referência.

O livro 3D existente e seu folheio permanecem para PDFs e EPUBs importados. As referências online não substituem o livro 3D nem ficam offline automaticamente. O projeto não incorpora páginas do site Project Gutenberg; usa apenas digitalizações permitidas pelo Internet Archive. As fontes exigem atribuição, condições de reprodução ou verificação de domínio público conforme o caso. Há uma área **Fonte e direitos desta edição** dentro do leitor. No Wikisource, o botão **Baixar somente este capítulo (TXT)** permite um download manual opcional; o livro completo não é baixado sozinho.

1. O aplicativo abre diretamente na **estante principal**. Toque em **Importar livros** nela, sem passar por outra estante.
2. Escolha a categoria e o formato **PDF** ou **TXT**.
3. O livro importado aparece na prateleira correspondente, ao lado dos demais.
4. Para um PDF, toque na lombada e veja o exemplar 3D com a capa da própria edição, título e autor. Arraste horizontalmente para girar ou toque no livro para abrir o leitor. A página, o marcador e o tempo de leitura são preservados. Rolar a página não muda a escala do modelo.
5. Para mudar a categoria do PDF, use o seletor **Romances** ao lado do botão **Estante**, no alto da vitrine.
6. **Descrição do livro** começa fechada, abaixo do exemplar. Toque para mostrar autor, origem, data de primeira publicação e uma apresentação da história. Clássicos reconhecidos recebem dados editoriais, e outros PDFs mostram apenas os metadados presentes no arquivo, sem inventar fatos.
7. Na página principal, use **Organizar livros** para mover os volumes dentro da categoria. Eles ficam sempre em pé.
8. Use **Meu ambiente** para mudar a iluminação, o tema e as plantas e **Minhas leituras** para acompanhar os livros e sua meta. Esses painéis e a organização têm um botão pequeno **← Estante** para voltar ao acervo.

### Fidelidade a uma edição real

A primeira página do PDF é usada como imagem inicial da capa. Nas importações antigas sem capa salva, a vitrine tenta recuperá-la diretamente do PDF já guardado, sem perder o arquivo nem o progresso de leitura. A imagem original do PDF fica visível no livro CSS até a textura WebGL estar realmente carregada e renderizada. Se a textura WebGL falhar, o livro compatível mantém a imagem; se a capa salva estiver inválida, o app tenta reconstruí-la a partir do PDF. Nenhuma capa marrom genérica substitui a capa original durante o carregamento. Para a **contracapa**, o importador verifica se a última página do PDF parece conter a imagem da edição, e o visor faz a mesma verificação nos PDFs já salvos. Ele ignora finais de romance em texto ou PDFs digitalizados em que não há como reconhecer a contracapa com segurança. Um PDF não informa necessariamente como são a lombada, a contracapa ou o acabamento da edição à venda. Por isso, a reprodução **exata** dessas partes requer fotografias da **mesma edição física**. Fotos de livros já cadastradas na versão anterior são preservadas; o painel para adicionar novas fotos foi retirado da vitrine conforme solicitado. Quando não existem fotos, a lombada e a contracapa exibem uma aproximação neutra, sem simular que são originais.

A estante mantém os volumes na vertical. O 3D em WebGL modela capas, miolo, lombada e verso como faces distintas, evitando espelhar a arte da frente quando o livro gira. Em navegadores sem suporte a WebGL, há um modo 3D por CSS com as mesmas imagens.

### Etapa 1: livros individuais na estante

Os PDFs importados agora têm volumes próprios na estante principal, com altura e largura calculadas por exemplar, espessura aproximada pelo total de páginas, sombras de contato com a madeira, topo do miolo e uma face de capa que usa a imagem **original do arquivo**. Em computadores, passar o ponteiro ou focar o livro o destaca e revela sua capa física; no celular, tocar abre o exemplar como antes. A foto da lombada, quando já cadastrada, continua tendo prioridade. Na ausência dessa foto, exibimos somente uma faixa derivada da borda da capa original, sem afirmar que ela seja a lombada comercial da mesma edição.

Esta é a primeira etapa da evolução visual. As próximas são a transição animada da prateleira para a vitrine 3D e os refinamentos físicos do leitor, em incrementos independentes.

Os quatro gêneros são Romances, Romances picantes, Ficção e aventuras e Autores brasileiros. Os títulos pré-instalados são apenas demonstrações visuais, não arquivos completos.

## Onde ficam os arquivos

- PDFs, capas, fotografias e metadados das edições: IndexedDB `aurora-pdf-library`, nas stores `books` e `progress`, mantendo a versão 2.
- TXT importados: `localStorage` em `aurora-books`; categorias em `aurora-txt-categories`.
- Páginas do leitor TXT: chave `aurora-page-v2:` seguida do título; o progresso salvo na antiga chave `aurora-page:` é migrado ao abrir o livro.
- Anotações antigas (preservadas, mas sem painel na vitrine): chave `aurora-notes:` por livro; preferências em `aurora-room-v1` e `aurora-shelf-order-v1`.
- Nenhum PDF importado é enviado ao GitHub ou para outro servidor. É necessário abrir **o mesmo endereço no mesmo navegador e aparelho** para acessar os livros locais.

Para ler PDF e renderizar o volume 3D pela primeira vez, é preciso estar conectado à internet para carregar as bibliotecas PDF.js, PageFlip e Three.js. O service worker guarda recursos acessados para uso posterior quando disponíveis.

### Edição 37: folhas maiores em todos os leitores

O percurso estante → exemplar 3D → leitura é mantido para PDF, EPUB e TXT importados, e para os títulos online adicionados à estante. O PDF conserva suas páginas físicas e o leitor existente. No EPUB, o painel **Aa** reúne capítulos, voz, fonte e tema; a folha usa a altura livre e mantém o folheio com som. No TXT, o celular exibe **uma folha larga por vez** (duas no computador), com fonte, tema e voz no botão **Aa**, além do som de páginas. Para textos Wikisource/Wikilivros, a folha ocupa mais da tela, as opções ficam recolhidas e a passagem de página também emite som.

Audiolivros continuam com seus controles de reprodução. Digitalizações de fontes externas incorporadas por iframe mantêm o visual próprio do serviço de origem, que a Aurora não consegue modificar. Nenhuma importação antiga precisa ser repetida para receber os novos controles.

### Edição 38: acabamento do EPUB e títulos legíveis

Os três temas do EPUB (Claro, Sépia e Noturno) agora apresentam **exatamente um botão selecionado** e são aplicados às folhas sem remover classes que o motor de folheio usa. A sombra da folha foi reduzida para evitar aspecto acinzentado e excessivamente translúcido durante o giro. O ruído de virar página ganhou ataque e encerramento mais suaves, com dois movimentos de fricção filtrados, sem arquivo ou serviço externo; a mudança também alcança o leitor PDF e TXT.

As lombadas e os títulos apresentados no 3D e no leitor deixam de mostrar caudas de propaganda, editora, ISBN e códigos, como no nome longo de **A Hipótese do Amor**. Os dados originais ficam preservados no armazenamento do usuário. Capas originais não são alteradas; apenas capas **ilustrativas geradas pela Aurora** podem ser recriadas com o título limpo.

## Desenvolvimento e segurança

Execute `npm run dev -- --host 0.0.0.0 --port 4173 --strictPort` e abra a prévia local.

Antes da etapa de livros físicos foi salva a ramificação `backup-antes-livros-fisicos-2026-11-13`. Ela permite recuperar o código anterior sem alterar PDFs e TXT já guardados nos aparelhos.

Para a correção específica da capa original no 3D, foi salva também `backup-antes-correcao-capas-pdf-2026-11-13`.

Para a unificação da entrada na estante, importação de PDF diretamente da página principal, recuperação de contracapas e botões de volta, foi salva `backup-antes-unificar-estante-2026-11-13`.
# Edição 39: folhas opacas e descrição dos livros

- EPUB e TXT importados usam o mesmo leitor com folhas desenhadas em canvas opaco que o PDF. Isso evita que o texto ou outra folha apareçam através da dobra, mantendo o efeito de curvatura e sombra do St.PageFlip.
- Paginação e pintura compartilham as mesmas métricas de fonte e espaçamento. As ilustrações do EPUB também aparecem sobre papel opaco. A leitura é repartida em grupos de até 24 páginas para controlar a memória do celular.
- A sala 3D continua mostrando os livros antes da leitura. Os controles Estante, categoria e Descrição do livro agora têm escrita serifada sem contornos ou caixas.
- A identificação do título é refeita quando o navegador Android restaura a tela usando Voltar; os nomes extensos de arquivo deixam de reaparecer acima da capa.
- Descrições de obras reconhecidas incluem autor, país, ano, sinopse e referência de páginas quando verificada. Outros arquivos informam formato e paginação disponível; quando faltam dados, o EPUB/TXT apresenta um trecho inicial claramente identificado, sem inventar sinopses.
- A versão 39 renova os arquivos em cache preservando os livros já importados e o progresso de leitura.

