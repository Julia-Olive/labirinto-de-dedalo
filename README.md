# O Labirinto de Dédalo

Jogo 2D em pixel art, em português, baseado no mito do Minotauro e do labirinto de Dédalo. Roda direto no navegador, sem instalação e sem servidor.

## Como jogar

- **Windows:** dê dois cliques em `Jogar.bat`.
- **Qualquer sistema:** abra o `index.html` no navegador (Chrome, Edge, Firefox ou Safari).

Na primeira abertura é preciso internet só para as fontes; sem conexão, o jogo usa fontes do sistema.

1. Escolha o Guerreiro ou a Guerreira, dê um nome e escolha a dificuldade.
2. Atravesse os quatro anéis do labirinto e derrote os guardiões: Escorpiões Gigantes, Medusa, Hidra de Lerna e Minotauro.
3. Com os quatro Selos de bronze, fuja pela Porta do Sol antes que o labirinto desabe.

### Controles

| Tecla | Ação |
| --- | --- |
| WASD / Setas | Andar |
| Espaço | Atacar com a lança (na luta) |
| Shift ou K | Segurar o escudo (na luta) |
| E | Golpe heroico: gasta 2 de fôlego |
| R | Arremessar tocha |
| Q | Ambrosia: cura 50 de vida |
| Enter | Avançar a fala |
| Esc | Pausa |
| J / H / M | Diário / Ajuda / Som |

Em telas sensíveis ao toque aparecem botões na tela.

## História

Atenas paga a Creta um tributo de catorze jovens a cada nove anos. Minos jurou diante de Zeus que a dívida acaba se o Minotauro cair, e o herói se oferece para cumprir esse juramento. Dédalo, preso numa torre com o filho Ícaro, revela que o labirinto tem uma saída, a Porta do Sol, trancada com quatro selos guardados por criaturas.

## Usabilidade

O jogo aplica as 10 heurísticas de usabilidade de Jakob Nielsen. A explicação de cada uma está dentro do jogo, em **Ajuda (H) → Usabilidade**.

## Estrutura do código

```
index.html          estrutura das telas e ordem de carregamento dos scripts
css/style.css       visual da interface
assets/img/         ilustrações e retratos
js/
  config.js         constantes, anéis do labirinto, guardiões e ajustes de equilíbrio
  story.js          textos da história e anotações de Dédalo
  utils.js          funções utilitárias (aleatoriedade com semente, armazenamento)
  state.js          estado compartilhado da partida
  assets.js         carregamento de imagens, sprites em pixel art e retratos
  audio.js          música e efeitos gerados com a Web Audio API
  level.js          geração dos labirintos e desenho fixo do mapa
  dialogue.js       caixa de fala que não pausa o jogo
  hud.js            barras de vida, itens, objetivo e avisos
  modals.js         janelas de história, ajuda, diário e pausa
  save.js           pontos de salvamento
  exploration.js    movimento nos corredores, itens e perigos
  combat.js         lutas em tempo real e comportamento dos guardiões
  render.js         desenho de cada quadro, névoa e minimapa
  input.js          teclado e controles de toque
  main.js           fluxo entre telas, laço principal e inicialização
```

Os scripts são carregados em ordem pelo `index.html`, sem módulos ES, para que o jogo funcione ao abrir o arquivo direto do disco.

Para ajustar a dificuldade, altere os valores em `js/config.js` (exploração, progressão e guardiões) e no topo de `js/combat.js` (velocidades, danos e tempos de cada golpe).
