# Biblioteca Aurora

Biblioteca pessoal PWA, hospedada no GitHub Pages, com estante realista, livros por categoria, PDF e TXT e visualização 3D.

## Uso no celular

1. Toque em **Importar livros** na página principal.
2. Escolha a categoria e o formato **PDF** ou **TXT**.
3. O livro importado aparece na prateleira correspondente, ao lado dos demais.
4. Para um PDF, toque na lombada, gire o livro físico em 3D e toque novamente para abrir o leitor. A página, o marcador e o tempo de leitura são preservados.
5. Para mudar a categoria de um PDF, abra sua visualização 3D e altere **Guardar em**.
6. No volume, abra **Detalhes do exemplar e fotos originais** para informar o título da edição, autor, ISBN, situação de leitura e formato físico. É possível enviar uma fotografia da capa, da lombada e da contracapa.
7. Na página principal, use **Organizar livros** para mover os volumes para a esquerda ou para a direita dentro da categoria. Eles ficam sempre em pé.
8. Use **Meu ambiente** para mudar a iluminação, o tema e as plantas e **Minhas leituras** para ver a contagem, os minutos registrados e sua meta.

### Fidelidade a uma edição real

A primeira página do PDF é usada como imagem inicial da capa. Um PDF não informa necessariamente como são a lombada, a contracapa ou o acabamento da edição à venda. Por isso, a reprodução **exata** dessas partes requer fotografias da **mesma edição física** (idealmente identificada pelo ISBN), recortadas para cada face. As fotos podem ser escolhidas na galeria do celular em **Detalhes do exemplar e fotos originais**. Quando elas não existem, a lombada e a contracapa exibem uma aproximação neutra, sem simular que são originais.

A estante mantém os volumes na vertical. O 3D em WebGL modela capas, miolo, lombada e verso como faces distintas, evitando espelhar a arte da frente quando o livro gira. Em navegadores sem suporte a WebGL, há um modo 3D por CSS com as mesmas imagens.

Os quatro gêneros são Romances, Romances picantes, Ficção e aventuras e Autores brasileiros. Os títulos pré-instalados são apenas demonstrações visuais, não arquivos completos.

## Onde ficam os arquivos

- PDFs, capas, fotografias e metadados das edições: IndexedDB `aurora-pdf-library`, nas stores `books` e `progress`, mantendo a versão 2.
- TXT importados: `localStorage` em `aurora-books`; categorias em `aurora-txt-categories`.
- Páginas do leitor TXT: chave `aurora-page:` seguida do título.
- Anotações: chave `aurora-notes:` por livro; preferências de estante em `aurora-room-v1` e `aurora-shelf-order-v1`.
- Nenhum PDF importado é enviado ao GitHub ou para outro servidor. É necessário abrir **o mesmo endereço no mesmo navegador e aparelho** para acessar os livros locais.

Para ler PDF e renderizar o volume 3D pela primeira vez, é preciso estar conectado à internet para carregar as bibliotecas PDF.js, PageFlip e Three.js. O service worker guarda recursos acessados para uso posterior quando disponíveis.

## Desenvolvimento e segurança

Execute `npm run dev -- --host 0.0.0.0 --port 4173 --strictPort` e abra a prévia local.

Antes desta etapa também foi salva a ramificação `backup-aurora-antes-edicao-real-2026-11-13`. Ela permite recuperar o código anterior sem alterar PDFs e TXT já guardados nos aparelhos.
