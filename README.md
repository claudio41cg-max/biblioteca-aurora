# Biblioteca Aurora

Biblioteca pessoal PWA, hospedada no GitHub Pages, com estante realista, livros por categoria, PDF e TXT e visualização 3D.

## Uso no celular

### Explorar livros online (sem baixar automaticamente)

Na página principal, **⌕ Buscar livros** abre `explorar-livros.html`. A pesquisa consulta, em paralelo, até quatro acervos de livros (Wikisource, Open Library, Wikilivros e obras do Project Gutenberg catalogadas pelo Internet Archive). Para audiolivros, consulta o LibriVox e, caso falhe, o catálogo de gravações do Internet Archive. Resultados aparecem dentro da Aurora, sem links externos visíveis na busca. As APIs externas podem estar indisponíveis ou sujeitas a bloqueios de CORS no navegador. É possível escolher português ou todos os idiomas.

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
- Páginas do leitor TXT: chave `aurora-page:` seguida do título.
- Anotações antigas (preservadas, mas sem painel na vitrine): chave `aurora-notes:` por livro; preferências em `aurora-room-v1` e `aurora-shelf-order-v1`.
- Nenhum PDF importado é enviado ao GitHub ou para outro servidor. É necessário abrir **o mesmo endereço no mesmo navegador e aparelho** para acessar os livros locais.

Para ler PDF e renderizar o volume 3D pela primeira vez, é preciso estar conectado à internet para carregar as bibliotecas PDF.js, PageFlip e Three.js. O service worker guarda recursos acessados para uso posterior quando disponíveis.

## Desenvolvimento e segurança

Execute `npm run dev -- --host 0.0.0.0 --port 4173 --strictPort` e abra a prévia local.

Antes da etapa de livros físicos foi salva a ramificação `backup-antes-livros-fisicos-2026-11-13`. Ela permite recuperar o código anterior sem alterar PDFs e TXT já guardados nos aparelhos.

Para a correção específica da capa original no 3D, foi salva também `backup-antes-correcao-capas-pdf-2026-11-13`.

Para a unificação da entrada na estante, importação de PDF diretamente da página principal, recuperação de contracapas e botões de volta, foi salva `backup-antes-unificar-estante-2026-11-13`.
