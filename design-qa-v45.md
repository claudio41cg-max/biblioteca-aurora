# Design QA — Biblioteca Aurora v45 (corte de folhas e contracapas)

**Referências visuais:** imagens enviadas pelo proprietário (`291575.jpg`, corte vertical das páginas; `291579.jpg`, lateral/lombada do exemplar).

## Verificações concluídas

- O corte lateral ganhou textura compartilhada com microfiletes verticais, fibras e pequenas marcas envelhecidas. Topo e base possuem orientação independente.
- As texturas PNG geradas no navegador foram observadas aplicadas às faces `.volume-edge`, `.volume-top` e `.volume-bottom` no visor de compatibilidade publicado.
- O app publicado carrega `aurora-edition-surfaces.js?v=3` e `aurora-livro-3d.mjs?v=6`.
- O livro demonstrativo *Orgulho e Preconceito* abriu em 3D e retornou à estante.
- EPUBs novos podem guardar uma imagem expressamente identificada como contracapa; EPUBs antigos fazem essa verificação na primeira abertura. PDFs mantêm o mecanismo anterior.
- **20/20 testes automatizados passaram**.

## Limitações da revisão visual

- A prévia local `http://terminal.local:4173/` não abriu no navegador de verificação, embora o servidor tenha iniciado.
- A sessão publicada deste navegador utilizou o visor CSS de compatibilidade (`aurora-force-css`); não foi possível comparar com segurança o corte de folhas em WebGL no telefone do proprietário nem uma contracapa original extraída de um arquivo real que só existe no celular dele.
- A prova visual final de perto, no mesmo ângulo da referência, depende de um print do aplicativo no Samsung do proprietário.

**final result: blocked** — inspeção visual em WebGL no aparelho e comparação de uma contracapa EPUB real pendentes; não é falha dos testes automatizados.
