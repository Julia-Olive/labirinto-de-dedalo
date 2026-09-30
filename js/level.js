/**
 * @file Geração dos anéis do labirinto.
 *
 * Cada anel é um labirinto perfeito (gerado por busca em profundidade) com
 * algumas paredes extras removidas. A célula mais distante da entrada vira a
 * arena do guardião (ou a Porta do Sol, no último anel). Depois são espalhados
 * itens, espinhos, bichos e decoração. Tudo usa uma semente, então o mesmo
 * anel pode ser recriado ao carregar um jogo salvo.
 */
"use strict";

/** Meia largura e meia altura da arena em blocos (arena de 9 × 7). */
const ARENA_HALF_SIZE = { x: 4, y: 3 };
/** Meia largura e meia altura da sala da Porta do Sol (3 × 3). */
const EXIT_ROOM_HALF_SIZE = { x: 1, y: 1 };
/** Distância mínima, em passos, entre a entrada e os bichos dos corredores. */
const ENEMY_MIN_DISTANCE_FROM_START = 7;
/** Distância mínima, em passos, entre a entrada e os itens em corredores. */
const ITEM_MIN_DISTANCE_FROM_START = 4;
/** Chance de uma parede com o chão logo abaixo ganhar uma tocha acesa. */
const WALL_TORCH_CHANCE = 0.14;

/**
 * Cria um anel do labirinto.
 * @param {number} index posição em LEVELS
 * @param {number} seed semente do gerador aleatório
 */
function generateLevel(index, seed) {
  const definition = LEVELS[index];
  const random = createSeededRandom(seed);
  const width = definition.mazeCols * 2 + 1;
  const height = definition.mazeRows * 2 + 1;
  const grid = new Uint8Array(width * height).fill(Tile.WALL);
  const start = { x: 1, y: height - 2 };

  const level = {
    index, seed, definition,
    theme: LEVEL_THEMES[index],
    width, height, grid, start,
    room: null, boss: null, exit: null, lair: null,
    bossDefeated: false,
    items: [], spikes: [], enemies: [], wallTorches: [],
    explored: new Uint8Array(width * height),
    trail: [],
    timeLeft: 0,
    rumbleTimer: 0,
    dust: [],
    canvas: null,
  };

  carveMaze(level, random);
  removeExtraWalls(level, random);
  carveGoalRoom(level);

  const distances = distancesFromStart(level);
  const spots = collectFreeSpots(level, distances, random);
  placeItems(level, spots);
  placeStatues(level, spots);
  placeWater(level, spots, random);
  placeSpikes(level, spots, random);
  placeEnemies(level, spots, distances, random);
  placeWallTorches(level, random);

  level.canvas = prerenderLevel(level, createSeededRandom(seed + 99));
  if (level.boss) level.lair = createLair(level);
  return level;
}

/* ------------------------------------------------------------------ */
/* Consultas ao mapa                                                   */
/* ------------------------------------------------------------------ */

function tileIndex(level, x, y) {
  return y * level.width + x;
}

/** Tipo do bloco em (x, y). Fora do mapa conta como parede. */
function tileAt(x, y, level = game.level) {
  if (!level || x < 0 || y < 0 || x >= level.width || y >= level.height) return Tile.WALL;
  return level.grid[tileIndex(level, x, y)];
}

function setTile(level, x, y, tile) {
  level.grid[tileIndex(level, x, y)] = tile;
}

/** true se o herói pode andar sobre o bloco. */
function isWalkable(x, y) {
  const tile = tileAt(x, y);
  return tile === Tile.FLOOR || tile === Tile.WATER;
}

/** true se o bloco está dentro da arena (sem contar a borda). */
function isInsideArena(x, y, level = game.level) {
  const room = level.room;
  return Boolean(level.boss) && x >= room.x0 && x <= room.x1 && y >= room.y0 && y <= room.y1;
}

/** true se o bloco está na arena ou na borda em volta dela. */
function isNearRoom(level, x, y) {
  const room = level.room;
  return x >= room.x0 - 1 && x <= room.x1 + 1 && y >= room.y0 - 1 && y <= room.y1 + 1;
}

/** Limites da sala do objetivo em pixels, com o centro. */
function roomPixelBounds(level) {
  const room = level.room;
  return {
    left: room.x0 * TILE_SIZE,
    top: room.y0 * TILE_SIZE,
    right: (room.x1 + 1) * TILE_SIZE,
    bottom: (room.y1 + 1) * TILE_SIZE,
    centerX: ((room.x0 + room.x1 + 1) * TILE_SIZE) / 2,
    centerY: ((room.y0 + room.y1 + 1) * TILE_SIZE) / 2,
  };
}

/* ------------------------------------------------------------------ */
/* Etapas da geração                                                   */
/* ------------------------------------------------------------------ */

/** Labirinto perfeito: busca em profundidade a partir do canto inferior esquerdo. */
function carveMaze(level, random) {
  const { mazeCols, mazeRows } = level.definition;
  const visited = new Uint8Array(mazeCols * mazeRows);
  const stack = [[0, mazeRows - 1]];
  visited[(mazeRows - 1) * mazeCols] = 1;
  setTile(level, level.start.x, level.start.y, Tile.FLOOR);

  while (stack.length) {
    const [cellX, cellY] = stack[stack.length - 1];
    const unvisited = ORTHOGONAL_DIRECTIONS.filter(([dx, dy]) => {
      const nx = cellX + dx;
      const ny = cellY + dy;
      return nx >= 0 && ny >= 0 && nx < mazeCols && ny < mazeRows && !visited[ny * mazeCols + nx];
    });
    if (!unvisited.length) {
      stack.pop();
      continue;
    }
    const [dx, dy] = unvisited[Math.floor(random() * unvisited.length)];
    const nextX = cellX + dx;
    const nextY = cellY + dy;
    visited[nextY * mazeCols + nextX] = 1;
    setTile(level, 2 * cellX + 1 + dx, 2 * cellY + 1 + dy, Tile.FLOOR);
    setTile(level, 2 * nextX + 1, 2 * nextY + 1, Tile.FLOOR);
    stack.push([nextX, nextY]);
  }
}

/** Remove algumas paredes entre células para criar caminhos alternativos. */
function removeExtraWalls(level, random) {
  for (let y = 1; y < level.height - 1; y++) {
    for (let x = 1; x < level.width - 1; x++) {
      if (tileAt(x, y, level) !== Tile.WALL) continue;
      const separatesCells = (x % 2 === 0 && y % 2 === 1) || (x % 2 === 1 && y % 2 === 0);
      if (separatesCells && random() < level.definition.braidChance) setTile(level, x, y, Tile.FLOOR);
    }
  }
}

/** Distância em passos de cada bloco até a entrada (-1 se inalcançável). */
function distancesFromStart(level) {
  const distances = new Int16Array(level.width * level.height).fill(-1);
  const queue = [tileIndex(level, level.start.x, level.start.y)];
  distances[queue[0]] = 0;
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const x = current % level.width;
    const y = Math.floor(current / level.width);
    for (const [dx, dy] of ORTHOGONAL_DIRECTIONS) {
      const next = tileIndex(level, x + dx, y + dy);
      if (level.grid[next] !== Tile.WALL && distances[next] < 0) {
        distances[next] = distances[current] + 1;
        queue.push(next);
      }
    }
  }
  return distances;
}

/**
 * Abre a arena (ou a sala da saída) na célula mais distante da entrada,
 * considerando só células longe da entrada em linha reta também.
 */
function carveGoalRoom(level) {
  const distances = distancesFromStart(level);
  const minStraightDistance = (level.width + level.height) / 2;
  let best = { x: level.width - 2, y: 1, steps: -1 };
  for (let y = 1; y < level.height; y += 2) {
    for (let x = 1; x < level.width; x += 2) {
      const straightDistance = Math.abs(x - level.start.x) + Math.abs(y - level.start.y);
      const steps = distances[tileIndex(level, x, y)];
      if (straightDistance >= minStraightDistance && steps > best.steps) best = { x, y, steps };
    }
  }

  const half = level.definition.boss ? ARENA_HALF_SIZE : EXIT_ROOM_HALF_SIZE;
  const centerX = clamp(best.x, half.x + 1, level.width - 2 - half.x);
  const centerY = clamp(best.y, half.y + 1, level.height - 2 - half.y);
  for (let dy = -half.y; dy <= half.y; dy++) {
    for (let dx = -half.x; dx <= half.x; dx++) setTile(level, centerX + dx, centerY + dy, Tile.FLOOR);
  }

  level.room = { x0: centerX - half.x, y0: centerY - half.y, x1: centerX + half.x, y1: centerY + half.y };
  if (level.definition.boss) level.boss = { x: centerX, y: centerY, type: level.definition.boss };
  else level.exit = { x: centerX, y: centerY };
}

/**
 * Separa os blocos livres em becos sem saída e corredores, fora da sala do
 * objetivo e longe da entrada. Os blocos já usados são marcados em "used".
 */
function collectFreeSpots(level, distances, random) {
  const deadEnds = [];
  const corridors = [];
  const isNearStart = (x, y) => Math.abs(x - level.start.x) + Math.abs(y - level.start.y) < 3;
  const wallCount = (x, y) => ORTHOGONAL_DIRECTIONS.filter(([dx, dy]) => tileAt(x + dx, y + dy, level) === Tile.WALL).length;

  for (let y = 1; y < level.height - 1; y++) {
    for (let x = 1; x < level.width - 1; x++) {
      if (tileAt(x, y, level) !== Tile.FLOOR || isNearRoom(level, x, y) || isNearStart(x, y)) continue;
      if (wallCount(x, y) === 3) deadEnds.push([x, y]);
      else if (distances[tileIndex(level, x, y)] >= ITEM_MIN_DISTANCE_FROM_START) corridors.push([x, y]);
    }
  }
  shuffleInPlace(deadEnds, random);
  shuffleInPlace(corridors, random);

  const used = new Set([tileIndex(level, level.start.x, level.start.y)]);
  /** Tira o próximo bloco livre, dando preferência a becos ou a corredores. */
  const take = (preferDeadEnds) => {
    const sources = preferDeadEnds ? [deadEnds, corridors] : [corridors, deadEnds];
    for (const source of sources) {
      while (source.length) {
        const spot = source.pop();
        const key = tileIndex(level, spot[0], spot[1]);
        if (!used.has(key)) {
          used.add(key);
          return spot;
        }
      }
    }
    return null;
  };
  return { deadEnds, corridors, used, take };
}

function placeItems(level, spots) {
  const { ambrosiaCount, torchCount } = level.definition;
  const types = ["scroll", ...Array(ambrosiaCount).fill("ambrosia"), ...Array(torchCount).fill("torch")];
  types.forEach((type, id) => {
    const spot = spots.take(true);
    if (spot) level.items.push({ id, type, x: spot[0], y: spot[1], taken: false });
  });
}

/** Estátuas de jovens petrificados, sempre no fundo de becos para não bloquear caminhos. */
function placeStatues(level, spots) {
  const count = level.definition.statueCount || 0;
  for (let placed = 0; placed < count && spots.deadEnds.length; placed++) {
    const [x, y] = spots.deadEnds.pop();
    const key = tileIndex(level, x, y);
    if (spots.used.has(key)) continue;
    spots.used.add(key);
    setTile(level, x, y, Tile.STATUE);
  }
}

/** Poças d'água que deixam o herói mais lento. */
function placeWater(level, spots, random) {
  const chance = level.definition.waterChance;
  if (!chance) return;
  const canFlood = (x, y) => tileAt(x, y, level) === Tile.FLOOR && !isNearRoom(level, x, y)
    && Math.abs(x - level.start.x) + Math.abs(y - level.start.y) >= 3;
  for (const [x, y] of spots.corridors) {
    if (random() >= chance) continue;
    setTile(level, x, y, Tile.WATER);
    for (const [dx, dy] of ORTHOGONAL_DIRECTIONS) {
      if (canFlood(x + dx, y + dy) && random() < 0.5) setTile(level, x + dx, y + dy, Tile.WATER);
    }
  }
}

/** Placas de espinhos. Cada uma começa num ponto diferente do ciclo. */
function placeSpikes(level, spots, random) {
  for (let i = 0; i < level.definition.spikeCount; i++) {
    const spot = spots.take(false);
    if (spot && tileAt(spot[0], spot[1], level) !== Tile.STATUE) {
      level.spikes.push({ x: spot[0], y: spot[1], phaseOffset: random() * 2 });
    }
  }
}

function placeEnemies(level, spots, distances, random) {
  for (let i = 0; i < level.definition.enemyCount; i++) {
    const spot = spots.take(false);
    if (!spot || distances[tileIndex(level, spot[0], spot[1])] < ENEMY_MIN_DISTANCE_FROM_START) continue;
    const [x, y] = spot;
    level.enemies.push({
      type: level.definition.enemyType,
      x, y, fromX: x, fromY: y,
      pixelX: x * TILE_SIZE, pixelY: y * TILE_SIZE,
      progress: random(),
      direction: [1, 0],
    });
  }
}

function placeWallTorches(level, random) {
  if (!level.definition.hasWallTorches) return;
  for (let y = 1; y < level.height - 1; y++) {
    for (let x = 1; x < level.width - 1; x++) {
      const hasFloorBelow = tileAt(x, y + 1, level) !== Tile.WALL;
      if (tileAt(x, y, level) === Tile.WALL && hasFloorBelow && random() < WALL_TORCH_CHANCE) {
        level.wallTorches.push({ x, y });
      }
    }
  }
}

/**
 * Posição inicial do guardião dentro da arena. Antes da luta ele fica ali,
 * visível; quando a luta começa, estes mesmos objetos passam a se mover.
 */
function createLair(level) {
  const bounds = roomPixelBounds(level);
  const type = level.boss.type;
  if (type === "scorp") {
    const offsets = [[-30, 4], [30, 4], [0, -18]];
    return {
      parts: offsets.map(([dx, dy], i) => ({
        x: bounds.centerX + dx, y: bounds.centerY + dy,
        hp: BOSSES.scorp.maxHp / offsets.length,
        state: "idle", timer: 0, cooldown: 1 + i * 0.5, wobblePhase: i * 2.1,
        alive: true, flash: 0, facing: -1, attackKind: null,
      })),
    };
  }
  const body = {
    x: bounds.centerX, y: bounds.centerY + (type === "hydra" ? -6 : -4),
    state: "idle", timer: 0, cooldown: 1.5, flash: 0, facing: -1,
    gazeTimer: 7, chargeTimer: 5, chargeDirection: [1, 0], chargeHit: false,
  };
  const heads = type === "hydra" ? [0, 1, 2].map((i) => createHydraHead(body, i * 0.7)) : null;
  return { body, heads };
}

function createHydraHead(body, initialCooldown) {
  return { state: "idle", timer: 0, cooldown: 1 + initialCooldown, x: body.x, y: body.y - 16, targetX: 0, targetY: 0 };
}

/* ------------------------------------------------------------------ */
/* Desenho fixo do mapa (feito uma vez por anel)                      */
/* ------------------------------------------------------------------ */

function prerenderLevel(level, random) {
  const { canvas, ctx } = createCanvas(level.width * TILE_SIZE, level.height * TILE_SIZE);
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (tileAt(x, y, level) === Tile.WALL) drawWallTile(ctx, level, x, y);
      else drawFloorTile(ctx, level, x, y, random);
    }
  }
  if (level.boss) drawArenaBorder(ctx, level);
  drawEntranceSlab(ctx, level);
  return canvas;
}

function drawFloorTile(ctx, level, x, y, random) {
  const theme = level.theme;
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const tile = tileAt(x, y, level);
  const inArena = isInsideArena(x, y, level);

  ctx.fillStyle = theme.floor;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  if (inArena) {
    // Mosaico quadriculado no chão da arena.
    ctx.fillStyle = (x + y) % 2 ? theme.floorDark : theme.floorLight;
    ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    ctx.fillStyle = theme.floor;
    ctx.fillRect(px + 5, py + 5, 6, 6);
  }

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = random() < 0.5 ? theme.floorDark : theme.floorLight;
    ctx.fillRect(px + Math.floor(random() * 15), py + Math.floor(random() * 15), random() < 0.3 ? 2 : 1, 1);
  }
  if (!inArena && random() < 0.12) drawPebble(ctx, theme, px, py);
  if (level.index === 3 && random() < 0.08) drawBone(ctx, px, py);
  if (tile === Tile.WATER) drawWater(ctx, theme, px, py, random);
  if (tileAt(x, y - 1, level) === Tile.WALL) drawWallShadow(ctx, px, py);
  if (tile === Tile.STATUE) drawStatue(ctx, px, py);
}

function drawPebble(ctx, theme, px, py) {
  ctx.fillStyle = theme.floorDark;
  ctx.fillRect(px + 4, py + 10, 3, 2);
  ctx.fillStyle = theme.floorLight;
  ctx.fillRect(px + 4, py + 10, 2, 1);
}

function drawBone(ctx, px, py) {
  ctx.fillStyle = "#d8cbb0";
  ctx.fillRect(px + 3, py + 8, 7, 1);
  ctx.fillRect(px + 2, py + 7, 2, 3);
  ctx.fillRect(px + 9, py + 7, 2, 3);
}

function drawWater(ctx, theme, px, py, random) {
  ctx.fillStyle = theme.water;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = theme.waterLight;
  for (let i = 0; i < 3; i++) ctx.fillRect(px + Math.floor(random() * 12), py + Math.floor(random() * 14), 4, 1);
}

function drawWallShadow(ctx, px, py) {
  ctx.fillStyle = "#0000002a";
  ctx.fillRect(px, py, TILE_SIZE, 4);
  ctx.fillStyle = "#0000001a";
  ctx.fillRect(px, py + 4, TILE_SIZE, 2);
}

function drawStatue(ctx, px, py) {
  ctx.fillStyle = "#0003";
  ctx.fillRect(px + 3, py + 13, 10, 2);
  ctx.fillStyle = "#8e8878";
  ctx.fillRect(px + 3, py + 11, 10, 3);
  ctx.fillStyle = "#b4ae9e";
  ctx.fillRect(px + 6, py + 1, 4, 4);
  ctx.fillRect(px + 5, py + 5, 6, 6);
  ctx.fillRect(px + 4, py + 6, 1, 3);
  ctx.fillRect(px + 11, py + 5, 1, 3);
  ctx.fillStyle = "#6e6a5e";
  ctx.fillRect(px + 7, py + 2, 1, 1);
  ctx.fillRect(px + 9, py + 2, 1, 1);
  ctx.fillRect(px + 5, py + 10, 6, 1);
  ctx.fillStyle = "#d2cdbd";
  ctx.fillRect(px + 6, py + 1, 1, 3);
}

/** Parede vista de cima: topo de pedra e, se houver chão abaixo, a face frontal. */
function drawWallTile(ctx, level, x, y) {
  const theme = level.theme;
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const isOpen = (dx, dy) => tileAt(x + dx, y + dy, level) !== Tile.WALL;

  ctx.fillStyle = theme.wallTop;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  ctx.fillStyle = theme.wallLine;
  ctx.fillRect(px, py + 5, TILE_SIZE, 1);
  ctx.fillRect(px, py + 10, TILE_SIZE, 1);
  const brickOffset = (y % 2) * 4;
  ctx.fillRect(px + ((brickOffset + 3) % 16), py, 1, 5);
  ctx.fillRect(px + ((brickOffset + 11) % 16), py + 5, 1, 5);
  ctx.fillRect(px + ((brickOffset + 6) % 16), py + 10, 1, 6);

  ctx.fillStyle = theme.shadow;
  if (isOpen(-1, 0)) ctx.fillRect(px, py, 1, TILE_SIZE);
  if (isOpen(1, 0)) ctx.fillRect(px + TILE_SIZE - 1, py, 1, TILE_SIZE);
  if (isOpen(0, -1)) {
    ctx.fillRect(px, py, TILE_SIZE, 1);
    ctx.fillStyle = "#fff3";
    ctx.fillRect(px, py + 1, TILE_SIZE, 1);
  }
  if (isOpen(0, 1)) {
    ctx.fillStyle = theme.wallFace;
    ctx.fillRect(px, py + 9, TILE_SIZE, 7);
    ctx.fillStyle = theme.shadow;
    ctx.fillRect(px, py + 9, TILE_SIZE, 1);
    ctx.fillRect(px, py + 15, TILE_SIZE, 1);
    ctx.fillStyle = "#0002";
    ctx.fillRect(px + ((x * 7) % 13), py + 10, 1, 5);
    ctx.fillRect(px + ((x * 7 + 8) % 13), py + 10, 1, 5);
    ctx.fillRect(px, py + 12, TILE_SIZE, 1);
  }
}

/** Linha tracejada vermelha em volta da arena: avisa que ali começa a luta. */
function drawArenaBorder(ctx, level) {
  const bounds = roomPixelBounds(level);
  ctx.strokeStyle = "#8e2414";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 2]);
  ctx.strokeRect(bounds.left + 0.5, bounds.top + 0.5, bounds.right - bounds.left - 1, bounds.bottom - bounds.top - 1);
  ctx.setLineDash([]);
}

function drawEntranceSlab(ctx, level) {
  const px = level.start.x * TILE_SIZE;
  const py = level.start.y * TILE_SIZE;
  ctx.fillStyle = level.theme.wallFace;
  ctx.fillRect(px + 2, py + 2, 12, 12);
  ctx.fillStyle = level.theme.floorLight;
  ctx.fillRect(px + 3, py + 3, 10, 10);
  ctx.fillStyle = level.theme.wallFace;
  ctx.fillRect(px + 5, py + 5, 6, 6);
}
