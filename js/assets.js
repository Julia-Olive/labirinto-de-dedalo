/**
 * @file Imagens, sprites em pixel art e retratos.
 *
 * As ilustrações vêm de arquivos PNG. Os bonecos que andam pelo labirinto são
 * desenhados a partir de mapas de caracteres: cada letra é uma cor da paleta
 * e o ponto é transparente.
 */
"use strict";

/** Imagens carregadas dos arquivos. */
const images = { sheet: null, map: null, heroPortrait: { m: null, f: null } };

/** Sprites prontos para desenhar. */
const sprites = {};

/**
 * Carrega uma imagem. Se o arquivo falhar, devolve null e o jogo segue sem ela.
 * @param {string} src
 * @returns {Promise<HTMLImageElement|null>}
 */
function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function loadAllImages() {
  const [sheet, map, portraitM, portraitF] = await Promise.all([
    loadImage(IMAGE_PATHS.sheet),
    loadImage(IMAGE_PATHS.map),
    loadImage(IMAGE_PATHS.heroPortrait.m),
    loadImage(IMAGE_PATHS.heroPortrait.f),
  ]);
  images.sheet = sheet;
  images.map = map;
  images.heroPortrait.m = portraitM;
  images.heroPortrait.f = portraitF;
}

/* ------------------------------------------------------------------ */
/* Sprites em pixel art                                                */
/* ------------------------------------------------------------------ */

const HERO_PALETTE = {
  k: "#24160c", h: "#2b1a12", H: "#6e4222", s: "#d4966a", e: "#1a1010", b: "#3a2518",
  a: "#d0913e", A: "#8a5520", w: "#f0e8d2", r: "#a82828", R: "#6a1414", p: "#7a4e28",
  t: "#dfe4e8", l: "#5a3418", g: "#b8732a", G: "#7a4a18", f: "#f6f1e4",
};

const HERO_HEAD_MALE = [
  "...........t....", "..........ttt...", ".....kkkk..ttt..", "....khhhhk..p...", "...khhhhhhk.p...",
  "...khsssshk.p...", "...kseseesk.p...", "...kbsssssbkp...", "....kbbbbbk.p...",
];
const HERO_HEAD_FEMALE = [
  "...........t....", "..........ttt...", ".....kkkk..ttt..", "....kHHHHk..p...", "...kHHHHHHk.p...",
  "...kHssssHk.p...", "...kseseesk.p...", "...HksssssHkp...", "...H.ksssk.Hp...",
];
const HERO_BODY = [
  "..rrkwaaawkrsp..", ".kGGGkaAaawrss..", "kGgggGaAaaarsp..", "kGgfgGaaAaar.p..",
  "kGgffGllllrr.p..", "kGgggGwlwlwrrp..", ".kGGGkwwwwwrrp..", "..kkk.ksk.skrp..",
];
const HERO_LEGS_STANDING = [".....kAk.kAkRp..", ".....kAk.kAk.p..", ".....kll.llk...."];
const HERO_LEGS_STEPPING = ["......kAAk...p..", ".....kAk.kAk.p..", "....kll...llk..."];

const COMPANION_PALETTE = { k: "#24160c", H: "#6e4222", s: "#d4966a", e: "#1a1010", G: "#6f7f34", g: "#9aa84a", l: "#5a3418" };
const COMPANION_UPPER = [
  "....kkkk....", "...kHHHHk...", "..kHHHHHHk..", "..kHssssHk..", "..ksessesk..", "..kssssssk..",
  "...kssssk...", "..kGGggGGk..", ".kGGGggGGGk.", ".ksGGGGGGsk.", ".ksGGlGGGsk.", "..kGGGGGGk..",
];
const COMPANION_LEGS_STANDING = ["..kGGGGGGk..", "...ks..sk...", "...ks..sk...", "...kl..lk...", "..kll..llk.."];
const COMPANION_LEGS_STEPPING = ["..kGGGGGGk..", "..ks....sk..", "...ks..sk...", "..kl....lk..", ".kll....llk."];

const CREATURE_PALETTE = { k: "#1c120a", R: "#7a3a1a", Y: "#b0622a", G: "#5a8a2a", g: "#8ab83a", e: "#ffd040", P: "#4a3a5a", r: "#d03030", B: "#2a6a6a", b: "#4aa0a0" };
const ITEM_PALETTE = { k: "#1c120a", O: "#b8622a", o: "#e08a4a", y: "#1a1008", Y: "#ffd040", F: "#ff7a20", p: "#6b4424", P: "#efdcae", L: "#b8a07a" };

const CREATURE_ROWS = {
  scorp: ["....kk......", "...kRk......", "...kYk......", "..kRRk.k..k.", ".kRYRRkRk.kR", "kRRRRRRRRRRk", ".kRkRkRkRRk.", "k.k.k.k.kk.."],
  snake: ["........kkk.", ".......kGGGk", "......kGeGGk", "..kkk.kGGk.r", ".kGgGkkGGk..", "kGGkGGgGk...", "kGk.kkkk....", ".k.........."],
  swampSnake: ["........kkk.", ".......kBBBk", "......kBeBBk", "..kkk.kBBk.r", ".kBbBkkBBk..", "kBBkBBbBk...", "kBk.kkkk....", ".k.........."],
  bat: ["k....kk....k", "kk..kPPk..kk", "kPk.kePe.kPk", "kPPkPPPPkPPk", ".kPPPPPPPPk.", "..kk.kk.kk.."],
};

const ITEM_ROWS = {
  ambrosia: ["...kkkk...", "....kk....", "..kkOOkk..", ".kOoOOOOk.", "kOoyyyyOOk", "kOoOOOOOOk", "kOOyOyOyOk", ".kOOOOOOk.", "..kOOOOk..", "...kOOk...", "..kkkkkk.."],
  torch: ["..YY..", ".YFFY.", ".YFFY.", "..FF..", ".kppk.", "..pp..", "..pp..", "..pp..", "..pp.."],
  scroll: [".kkkkkkkk.", "kPPPPPPPPk", "kPkkPkkPLk", "kPPPPPPPPk", "kPkkkPkPLk", ".kkkkkkkk."],
};

/**
 * Transforma um mapa de caracteres em sprite.
 * @param {string[]} rows uma string por linha; cada caractere é um pixel
 * @param {Object<string,string>} palette cor de cada caractere
 * @returns {HTMLCanvasElement}
 */
function spriteFromRows(rows, palette) {
  const width = Math.max(...rows.map((row) => row.length));
  const { canvas, ctx } = createCanvas(width, rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      if (!palette[symbol]) return;
      ctx.fillStyle = palette[symbol];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

/** Espelha um sprite na horizontal (virado para a esquerda). */
function mirrorSprite(sprite) {
  const { canvas, ctx } = createCanvas(sprite.width, sprite.height);
  ctx.translate(sprite.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite, 0, 0);
  return canvas;
}

/**
 * Cria o par de quadros de caminhada nas duas direções.
 * @returns {{right: HTMLCanvasElement[], left: HTMLCanvasElement[]}}
 */
function walkingFrames(standingRows, steppingRows, palette) {
  const standing = spriteFromRows(standingRows, palette);
  const stepping = spriteFromRows(steppingRows, palette);
  return { right: [standing, stepping], left: [mirrorSprite(standing), mirrorSprite(stepping)] };
}

function buildSprites() {
  sprites.hero = {
    m: walkingFrames([...HERO_HEAD_MALE, ...HERO_BODY, ...HERO_LEGS_STANDING], [...HERO_HEAD_MALE, ...HERO_BODY, ...HERO_LEGS_STEPPING], HERO_PALETTE),
    f: walkingFrames([...HERO_HEAD_FEMALE, ...HERO_BODY, ...HERO_LEGS_STANDING], [...HERO_HEAD_FEMALE, ...HERO_BODY, ...HERO_LEGS_STEPPING], HERO_PALETTE),
  };
  sprites.companion = walkingFrames(
    [...COMPANION_UPPER, ...COMPANION_LEGS_STANDING],
    [...COMPANION_UPPER, ...COMPANION_LEGS_STEPPING],
    COMPANION_PALETTE,
  );
  for (const [name, rows] of Object.entries(CREATURE_ROWS)) sprites[name] = spriteFromRows(rows, CREATURE_PALETTE);
  for (const [name, rows] of Object.entries(ITEM_ROWS)) sprites[name] = spriteFromRows(rows, ITEM_PALETTE);
}

/* ------------------------------------------------------------------ */
/* Retratos e ilustrações                                              */
/* ------------------------------------------------------------------ */

const PORTRAIT_BACKGROUND = "#c9ad78";

/**
 * Desenha um retrato dentro de um canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {string} key "player", "scroll" ou uma chave de PORTRAIT_CROPS
 */
function drawPortrait(canvas, key) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PORTRAIT_BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  if (key === "scroll") {
    ctx.drawImage(sprites.scroll, width * 0.1, height * 0.27, width * 0.8, height * 0.46);
    return;
  }
  if (key === "player") {
    const portrait = images.heroPortrait[game.save.hero.gender];
    if (portrait) ctx.drawImage(portrait, 0, 0, width, height);
    return;
  }
  if (!images.sheet) return;
  const [x, y, cropWidth, cropHeight] = PORTRAIT_CROPS[key];
  ctx.drawImage(images.sheet, x, y, cropWidth, cropHeight, 0, 0, width, height);
}

/**
 * Cria a faixa ilustrada do topo das janelas de história.
 * @param {string} key chave de BANNER_CROPS
 * @returns {HTMLCanvasElement}
 */
function createBanner(key) {
  const [x, y, width, height] = BANNER_CROPS[key];
  const { canvas, ctx } = createCanvas(width, height);
  if (images.map) ctx.drawImage(images.map, x, y, width, height, 0, 0, width, height);
  canvas.className = "modal-banner pixelated";
  return canvas;
}

/** Desenha o padrão de greca das molduras e o registra na variável CSS --meander. */
function applyMeanderPattern() {
  const pattern = ["XXXXXXX.", "......X.", "XXXXX.X.", "X...X.X.", "X.X.X.X.", "X.XXX.X.", "X.....X.", "XXXXXXX."];
  const pixelSize = 2;
  const { canvas, ctx } = createCanvas(pattern.length * pixelSize, pattern.length * pixelSize);
  ctx.fillStyle = "#3a2412";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#b98b52";
  pattern.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "X") ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    });
  });
  document.documentElement.style.setProperty("--meander", `url(${canvas.toDataURL()})`);
}
