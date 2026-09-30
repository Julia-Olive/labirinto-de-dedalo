/**
 * @file Configurações e dados fixos do jogo.
 *
 * Tudo que é número de ajuste (velocidades, danos, tempos) fica aqui ou no
 * topo de combat.js, para que o equilíbrio do jogo possa ser mexido sem
 * procurar valores soltos pelo código.
 */
"use strict";

/** Resolução interna do canvas. O CSS amplia a imagem sem suavizar os pixels. */
const VIEW_WIDTH = 320;
const VIEW_HEIGHT = 180;

/** Tamanho, em pixels, de um bloco do labirinto. */
const TILE_SIZE = 16;

/** Chaves usadas no localStorage. */
const STORAGE_KEYS = Object.freeze({
  save: "labirinto-dedalo-save",
  music: "labirinto-dedalo-musica",
  volume: "labirinto-dedalo-volume",
});

/** Telas e estados principais do jogo. */
const Mode = Object.freeze({
  LOADING: "loading",
  TITLE: "title",
  SELECT: "select",
  STORY: "story",
  EXPLORE: "explore",
  FIGHT: "fight",
});

/** Tipos de bloco do mapa. */
const Tile = Object.freeze({
  FLOOR: 0,
  WALL: 1,
  STATUE: 2,
  WATER: 3,
  GATE: 4,
});

/** Caminhos das imagens. */
const IMAGE_PATHS = Object.freeze({
  sheet: "assets/img/ficha-personagens.png",
  map: "assets/img/labirinto.png",
  heroPortrait: {
    m: "assets/img/guerreiro-retrato.png",
    f: "assets/img/guerreira-retrato.png",
  },
});

/** Recortes (x, y, largura, altura) dos retratos na ficha de personagens. */
const PORTRAIT_CROPS = Object.freeze({
  companion: [70, 194, 74, 74],
  mino: [553, 96, 74, 74],
  hydra: [553, 194, 74, 74],
  medusa: [553, 294, 74, 74],
  scorp: [553, 396, 74, 74],
});

/** Recortes da ilustração do labirinto usados como faixa nas janelas de história. */
const BANNER_CROPS = Object.freeze({
  map: [0, 0, 1024, 559],
  tower: [20, 170, 320, 175],
  gate: [690, 370, 334, 175],
  heart: [360, 140, 320, 175],
});

/** Regras do nome do herói. */
const HERO_NAME = Object.freeze({
  minLength: 2,
  maxLength: 12,
  allowedPattern: /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/,
  defaults: { m: "Nikandros", f: "Kallisto" },
});

/** Multiplicador de dano recebido em cada dificuldade. */
const DAMAGE_TAKEN_BY_DIFFICULTY = Object.freeze({ normal: 1, easy: 0.6 });

/** Progressão do herói e de Ícaro. */
const PROGRESSION = Object.freeze({
  startingHp: 100,
  startingAmbrosia: 2,
  heroHpPerLevel: 15,
  companionHpPerLevel: 10,
  healAfterVictoryFraction: 0.5,
  ambrosiaHeal: 50,
});

/** Ajustes da exploração dos corredores. */
const EXPLORATION = Object.freeze({
  stepsPerSecond: 7,
  stepsPerSecondInWater: 4.2,
  companionStepsPerSecond: 7.5,
  visionRadius: 4,
  escapeVisionRadius: 5,
  hitInvulnerability: 1.2,
  spikeDamage: 12,
  spikeCycleSpeed: 0.8,
  spikeRaisedPhase: 0.7,
  spikeWarningPhase: 1.65,
  enemyContactDamage: 8,
  enemyContactDistance: 11,
  enemyStepsPerSecond: { default: 2.2, bat: 3.2 },
  enemyKeepDirectionChance: 0.6,
  maxTrailLength: 900,
});

/** Cores de cada anel do labirinto. */
const LEVEL_THEMES = Object.freeze([
  { floor: "#c9a66b", floorDark: "#b8925a", floorLight: "#dcbf86", wallTop: "#e2cfa3", wallLine: "#bfa577", wallFace: "#8f7249", shadow: "#2a1c0e" },
  { floor: "#a79e8c", floorDark: "#948a78", floorLight: "#bdb4a0", wallTop: "#d4ccb8", wallLine: "#aca38e", wallFace: "#766d5c", shadow: "#1d1a16" },
  { floor: "#7f8a5a", floorDark: "#6c774b", floorLight: "#98a36e", wallTop: "#b9b89a", wallLine: "#94937a", wallFace: "#5e6048", shadow: "#151a10", water: "#3e7a7a", waterLight: "#6ab0aa" },
  { floor: "#6e4e38", floorDark: "#5c3f2c", floorLight: "#86624a", wallTop: "#a88a6a", wallLine: "#86694c", wallFace: "#553c28", shadow: "#140c06" },
  { floor: "#d6b778", floorDark: "#c4a264", floorLight: "#ead08e", wallTop: "#efdcae", wallLine: "#cdb483", wallFace: "#9a7a4a", shadow: "#2a1c0e" },
]);

/**
 * Os cinco anéis do labirinto.
 * mazeCols/mazeRows: tamanho do labirinto em células (cada célula vira 2 blocos).
 * braidChance: chance de abrir paredes extras, criando caminhos alternativos.
 */
const LEVELS = Object.freeze([
  { name: "Anel Externo", mazeCols: 8, mazeRows: 6, braidChance: 0.08, boss: "scorp", spikeCount: 6, enemyCount: 2, enemyType: "scorp", ambrosiaCount: 1, torchCount: 0 },
  { name: "Anel das Estátuas", mazeCols: 10, mazeRows: 7, braidChance: 0.1, boss: "medusa", spikeCount: 8, enemyCount: 3, enemyType: "snake", ambrosiaCount: 2, torchCount: 0, statueCount: 6 },
  { name: "Anel Alagado", mazeCols: 11, mazeRows: 7, braidChance: 0.12, boss: "hydra", spikeCount: 6, enemyCount: 3, enemyType: "swampSnake", ambrosiaCount: 2, torchCount: 3, waterChance: 0.3, startingTorchGift: 1 },
  { name: "O Coração do Labirinto", mazeCols: 12, mazeRows: 8, braidChance: 0.12, boss: "mino", spikeCount: 10, enemyCount: 4, enemyType: "bat", ambrosiaCount: 2, torchCount: 1, hasWallTorches: true },
  { name: "A Fuga", mazeCols: 12, mazeRows: 8, braidChance: 0.18, boss: null, spikeCount: 12, enemyCount: 4, enemyType: "bat", ambrosiaCount: 1, torchCount: 0, escapeSeconds: { normal: 150, easy: 220 } },
]);

/** Nome exibido quando um bicho dos corredores causa dano. */
const ENEMY_NAMES = Object.freeze({
  scorp: "Escorpião",
  snake: "Serpente",
  swampSnake: "Serpente do pântano",
  bat: "Morcego",
});

/** Os quatro guardiões dos selos. */
const BOSSES = Object.freeze({
  scorp: {
    name: "Escorpiões Gigantes",
    article: "os",
    maxHp: 210,
    tip: "Fique fora do círculo vermelho quando eles erguerem as pinças e ataque logo depois. Segurar o escudo (Shift) bloqueia o veneno cuspido.",
  },
  medusa: {
    name: "Medusa",
    article: "a",
    maxHp: 260,
    tip: "Quando a tela ficar verde e os olhos dela brilharem, segure o escudo (Shift). O olhar volta para ela, que fica tonta.",
  },
  hydra: {
    name: "Hidra de Lerna",
    article: "a",
    maxHp: 350,
    tip: "Jogue uma tocha (R) logo no início: sem fogo ela se cura e ganha cabeças. Saia dos círculos vermelhos e ataque as cabeças esticadas.",
  },
  mino: {
    name: "Minotauro",
    article: "o",
    maxHp: 500,
    tip: "Quando surgir a linha vermelha, saia dela ou segure o escudo. Se ele bater na parede, fica tonto: é a hora de atacar.",
  },
});
