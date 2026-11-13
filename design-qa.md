# Biblioteca Aurora — etapa 1: volumes físicos na estante

Data: 13/11/2026

## Fonte visual

- Referência escolhida pelo usuário: `/workspace/scratch/27706d36a83f/reference_shelves/289195.jpg` (a primeira estante com plantas), captura de celular 709 × 1536 px, incluindo controles externos ao aplicativo.
- Referência secundária de proximidade e lombadas: `/workspace/scratch/27706d36a83f/reference_shelves/289199.jpg`, 709 × 1536 px.
- As duas fontes foram abertas e inspecionadas. A comparação de conteúdo do app consideraria a região da estante, sem as barras externas.

## Implementação

- Arquivos afetados: `aurora-estante.js`, `aurora-importados.js`, `aurora-estante.css`, `aurora-avancado.css`, `index.html`, `meus-livros.html`, `sw.js`, `manifest.webmanifest`.
- Escopo intencional: somente a representação física dos PDFs importados dentro das categorias existentes. A animação de retirada da estante, EPUB e a migração de arquitetura ficam para fases futuras.
- Estado necessário para avaliação: pelo menos um PDF importado no mesmo navegador, na categoria Romances; acionar seu foco/hover para ver a face original.
- Viewport de referência: celular com ~354 CSS px de largura e densidade ~2; não houve captura normalizada da implementação no estado de PDF importado.

## Testes e bloqueio da captura

- `node --check` passou nos scripts alterados, incluindo o importador e o service worker.
- A prévia local iniciou com `sites-preview`, porém `http://terminal.local:4173/` retornou `upstream connect error or disconnect/reset before headers` no navegador em nuvem, mesmo após novo início.
- O Chromium do executor local falhou antes de abrir uma aba (`process_singleton_posix.cc: socket() failed: Operation not permitted`).
- Não havia uma edição PDF importada disponível no navegador em nuvem; a coleção de PDFs existe exclusivamente no navegador do usuário. Não foi possível capturar o novo estado ou interações físicas com a capa real.
- Captura de implementação: indisponível; não foi possível colocar fonte e resultado em uma mesma comparação de imagem, nem verificar erros de console específicos dessa interação.

## Verificações de fidelidade

- **Tipografia:** o texto impresso artificialmente na lombada derivada da capa foi removido; títulos de livros demonstrativos e TXT seguem a tipografia antiga. Sem captura final para avaliar antialiasing e legibilidade na estante.
- **Espaçamento:** os volumes continuam em pé, um ao lado do outro na mesma categoria. Há mais espaço vertical para o destaque 3D; não medido no S24 FE.
- **Cores:** o fundo de madeira e as plantas originais foram preservados; capas usam diretamente os pixels da imagem importada. Sem captura final para avaliar reflexos reais no celular.
- **Imagem:** a face frontal só usa a capa original extraída do PDF. A lombada sem fotografia é uma faixa da própria capa, não uma reprodução exata do material físico. Fotos de lombada cadastradas têm prioridade. A contracapa exata continua dependendo de imagem real da edição.
- **Conteúdo:** menus, categorias, importação, leitor PDF e TXT, marcadores e progresso foram preservados, com alterações somente de apresentação e versionamento de cache.

## Pendências

- [P1] Capturar um livro importado em 360 × 800 CSS px e confirmar que o volume não é recortado no hover/foco dentro da prateleira.
- [P1] Verificar, no S24 FE, a foto da lombada existente, o destaque da capa original e o toque que abre o livro.
- [P2] Comparar com as referências a iluminação, bordas e sombra de contato com a tábua.

O desenho está implementado, mas a verificação visual de fidelidade foi bloqueada pela prévia indisponível e pela falta do PDF importado no navegador de teste. Não classificar como réplica perfeita até conferir a mesma edição no celular.

**final result: blocked**

## Ajuste de folheio ampliado e altura das folhas (13/11/2026)

- **Verdade visual:** prints do usuário `/workspace/scratch/27706d36a83f/upload/01-290097.jpg` (texto adaptado na página), `02-290092.jpg` (painel Aa) e `03-290090.jpg` (PDF original), todos 709 × 1536 px. São imagens completas do celular, com controles do Android; a área do leitor corresponde a aproximadamente 354 CSS px de largura com densidade próxima de 2.
- **Estado solicitado:** um PDF importado no aparelho, leitor aberto; mudar o zoom para 110%–200%, tanto no texto adaptado quanto na folha original, e virar as páginas com o dedo. A folha deve aparecer ligeiramente mais acima.
- **Correções de código:** `meus-livros.html` mantém o tamanho físico da folha quando `textMode` está ativo, ampliando somente a tipografia e permitindo quebra e rolagem dentro da página. Ao ampliar o PDF original, o gesto horizontal chama `St.PageFlip.flipNext/flipPrev` com a mesma animação física. `aurora-reader.css` reduz a área vazia acima da página e limita o texto ao conteúdo da folha.
- **Verificação funcional:** `node tests/leitor-zoom-folheio.test.mjs`, `node tests/leitor-controles.test.mjs` e `node tests/estante-unica.test.mjs` passaram; simularam zoom, página adaptada, dois sentidos de folheio, controles e roteamento. O motor de sombras não foi alterado.
- **Captura de implementação:** indisponível. A prévia local iniciou, mas a navegação do navegador de nuvem para `http://terminal.local:4173/` expirou. O navegador de teste não contém o PDF local do usuário e não foi possível medir a tela final nem inspecionar os erros de console nesse estado.
- **Comparação visual:** bloqueada; não há captura final para reunir no mesmo quadro com as três fontes. Tipografia e quebra de linha foram corrigidas por cálculo de CSS, mas ainda sem validação visual no S24. O espaço vertical foi reduzido por `padding-bottom` sem modificar fontes/cores do cabeçalho, imagens originais ou conteúdo de livro.
- **P1 pendente:** confirmar com um PDF real no S24 FE que 110%–200% permite folhear em ambos os modos e que o texto adaptado continua rolável dentro da folha. **P2 pendente:** conferir a nova altura, com o cabeçalho e o rodapé sempre visíveis.

**final result: blocked**

## Correção posterior: capa original do PDF na vitrine (13/11/2026)

- **Evidência do usuário:** `/workspace/scratch/27706d36a83f/upload/04-289382.jpg` mostra uma capa inteiramente marrom no WebGL, apesar de `/workspace/scratch/27706d36a83f/upload/02-289359.jpg` mostrar a capa impressa real de «Orgulho e Preconceito» em uma versão anterior.
- **Causa de código identificada:** `aurora-livro-3d.mjs` habilitava `three-ready` antes de a imagem original terminar de carregar. Quando o carregamento falhava, o canvas WebGL substituía prematuramente o HTML com `<img>` da capa real.
- **Correção:** a classe `three-ready` agora só é ativada depois de a textura original ser criada e renderizada; usa `THREE.Texture` diretamente da imagem do PDF. CSS e WebGL não ficam visíveis ao mesmo tempo. Se o WebGL falhar ou perder contexto, o HTML 3D com a imagem do PDF continua em uso. O HTML também espera a carga da imagem em vez de mostrar a capa provisória e tenta reconstruir capas inválidas a partir do PDF IndexedDB existente.
- **Verificações:** sintaxe de módulo, do script embutido e do service worker passou; as chamadas de recuperação preservam o `ArrayBuffer` integral e o progresso do livro. A aba do navegador de inspeção não possui o PDF original do S24, portanto não é possível validar o carregamento WebGL com a edição real sem teste do usuário.
- **P1 pendente:** inspecionar no S24 FE a capa real após carregamento, girar o volume e abrir o leitor. Se a capa não aparecer, obter o erro específico e verificar se o PDF original está disponível no IndexedDB do navegador do usuário.

**final result: blocked**
