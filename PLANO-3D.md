# Biblioteca Aurora — engenharia reversa funcional e plano de implementação

Referência: https://github.com/MengTo/complete-shelf
Documento baseado no README e no PROMPT.md oficiais. O index.html original tem aproximadamente 2,13 MB e ainda exige inspeção completa do código e testes visuais. Não é uma auditoria linha a linha.

## O que torna a referência superior
1. Sete volumes contínuos com navegação, seleção e transições exatas.
2. Geometria individual de capa dianteira, capa traseira, lombada, dobradiças, miolo, folhas, cabeceados e marcador.
3. Texturas procedurais de tecido, papel, madeira, douração, rugosidade e normais.
4. Folhas segmentadas deformadas durante arrasto; não uma rotação plana de CSS.
5. Iluminação física e sombras de contato.
6. Estados: estante > transição > inspeção fechada > leitura aberta > fechamento > estante.
7. Som ambiente e efeitos de manuseio, com preferências persistentes.
8. Controles por toque, clique, teclado, órbita, zoom e controles acessíveis.

## Comparação com o laboratório atual
O laboratório Aurora usa blocos simples, capas canvas planas, não tem páginas segmentadas, estados determinísticos nem texturas realistas. Não corresponde à referência.

## Arquitetura alvo
- engine/scene.js: renderizador Three.js, câmera, luzes e gerenciamento de recursos.
- engine/book-model.js: capas, lombadas, costura, folhas, miolo e dobradiças com geometria original.
- engine/page-turn.js: malha subdividida e deformação progressiva ao arrastar.
- engine/transitions.js: máquina de estados e animações com tempos definidos.
- engine/materials.js: tecidos, papel, madeira, relevo e capas originais.
- catalog/books.json: título, autor, categoria, imagem, direitos e URL do conteúdo.
- reader/: paginação real de EPUB/TXT e integração de texto às folhas 3D.
- audio/: efeitos de interface e Web Speech com opção futura de TTS externo.
- pwa/: manifest, service worker, cache de arquivos e biblioteca local.

## Etapas e critérios
1. Construir um único volume original de alta fidelidade com lombada, páginas, capa e textura realistas; validar no S24.
2. Implementar abertura, arrasto e curvatura real de folhas; testar avanço/retorno e fechamento.
3. Montar estante contínua com transição suave do livro para inspeção e de volta.
4. Incluir capas originais e 4 categorias: romance, romance sensual adulto, ficção e autores brasileiros.
5. Integrar obras de domínio público e importação EPUB/TXT/PDF; não usar títulos demonstrativos como livros completos.
6. Adicionar áudio e PWA offline; testar desempenho, acessibilidade e cache no Android.

## Restrições
O repositório de referência não apresenta licença de reutilização. Estudar comportamento e reproduzir conceitos com código e recursos próprios; não republicar seu index.html, áudios ou atlas sem autorização. Three.js pode ser usado conforme sua licença.

## Política de publicação
Preservar index.html atual até a nova experiência ser aprovada. Desenvolver em rota isolada e manter backup antes de substituição. Não declarar o produto pronto sem teste em navegador móvel.
