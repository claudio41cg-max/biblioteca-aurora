# Biblioteca Aurora

Biblioteca pessoal PWA, hospedada no GitHub Pages, com estante realista, livros por categoria, PDF e TXT e visualização 3D.

## Uso no celular

1. Toque em **Importar livros** na página principal.
2. Escolha a categoria e o formato **PDF** ou **TXT**.
3. O livro importado aparece na prateleira correspondente, ao lado dos demais.
4. Para um PDF, toque na lombada e veja o exemplar 3D com a capa da própria edição, título e autor. Arraste horizontalmente para girar ou toque no livro para abrir o leitor. A página, o marcador e o tempo de leitura são preservados. Rolar a página não muda a escala do modelo.
5. Para mudar a categoria do PDF, use o seletor **Romances** ao lado do botão **Estante**, no alto da vitrine.
6. **Descrição do livro** começa fechada, abaixo do exemplar. Toque para mostrar autor, origem, data de primeira publicação e uma apresentação da história. Clássicos reconhecidos recebem dados editoriais, e outros PDFs mostram apenas os metadados presentes no arquivo, sem inventar fatos.
7. Na página principal, use **Organizar livros** para mover os volumes dentro da categoria. Eles ficam sempre em pé.
8. Use **Meu ambiente** para mudar a iluminação, o tema e as plantas e **Minhas leituras** para acompanhar os livros e sua meta.

### Fidelidade a uma edição real

A primeira página do PDF é usada como imagem inicial da capa. Nas importações antigas sem capa salva, a vitrine tenta recuperá-la diretamente do PDF já guardado, sem perder o arquivo nem o progresso de leitura. Enquanto a imagem carrega, não aparece uma falsa capa com título inventado. Um PDF não informa necessariamente como são a lombada, a contracapa ou o acabamento da edição à venda. Por isso, a reprodução **exata** dessas partes requer fotografias da **mesma edição física**. Fotos de livros já cadastradas na versão anterior são preservadas; o painel para adicionar novas fotos foi retirado da vitrine conforme solicitado. Quando não existem fotos, a lombada e a contracapa exibem uma aproximação neutra, sem simular que são originais.

A estante mantém os volumes na vertical. O 3D em WebGL modela capas, miolo, lombada e verso como faces distintas, evitando espelhar a arte da frente quando o livro gira. Em navegadores sem suporte a WebGL, há um modo 3D por CSS com as mesmas imagens.

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

Antes desta correção foi salva a ramificação `backup-aurora-antes-capa-real-2026-11-13`. Ela permite recuperar o código anterior sem alterar PDFs e TXT já guardados nos aparelhos.
