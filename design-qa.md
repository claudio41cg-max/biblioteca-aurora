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
