/**
 * @file Exploração dos corredores.
 *
 * Nos corredores o herói anda de bloco em bloco. Ícaro segue pelo fio
 * dourado, um passo atrás. Os perigos são espinhos que sobem em ritmo e
 * bichos que andam pelos corredores.
 */
"use strict";

/** Herói nos corredores. x/y em blocos; pixelX/pixelY é a posição desenhada. */
const player = {
  x: 1, y: 1, fromX: 1, fromY: 1,
  pixelX: 0, pixelY: 0,
  isMoving: false, stepProgress: 0,
  facing: "right", walkTime: 0,
  invulnerableTime: 0,
};

/** Ícaro nos corredores, em pixels. */
const companion = { pixelX: 0, pixelY: 0, facing: "right", walkTime: 0, isMoving: false };

/** Coloca o herói (e Ícaro) num bloco, sem animação. */
function placePlayer(x, y) {
  Object.assign(player, {
    x, y, fromX: x, fromY: y,
    pixelX: x * TILE_SIZE, pixelY: y * TILE_SIZE,
    isMoving: false, invulnerableTime: 0,
  });
  companion.pixelX = player.pixelX;
  companion.pixelY = player.pixelY;
  revealAroundPlayer();
}

/** Marca como explorados os blocos em volta do herói (aparecem no mapa). */
function revealAroundPlayer() {
  const level = game.level;
  const radius = level.definition.escapeSeconds ? EXPLORATION.escapeVisionRadius : EXPLORATION.visionRadius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius + 1) continue;
      const x = player.x + dx;
      const y = player.y + dy;
      if (x >= 0 && y >= 0 && x < level.width && y < level.height) level.explored[tileIndex(level, x, y)] = 1;
    }
  }
}

/** Avança a exploração em um quadro. */
function updateExploration(deltaSeconds) {
  const level = game.level;
  if (player.invulnerableTime > 0) player.invulnerableTime -= deltaSeconds;

  if (level.definition.escapeSeconds && updateEscape(deltaSeconds)) return;

  if (player.isMoving && advanceStep(deltaSeconds)) return;
  if (!player.isMoving && !game.pauseDepth) {
    const direction = currentDirection();
    if (direction) tryStep(direction);
  }

  updateCompanionFollow(deltaSeconds);
  if (game.pauseDepth || game.mode !== Mode.EXPLORE) return;
  checkSpikes();
  updateCorridorEnemies(deltaSeconds);
  if (level.lair?.heads && !level.bossDefeated) placeHydraHeadsAtRest(level.lair);
}

/**
 * Conta o tempo da fuga e anima o teto caindo.
 * @returns {boolean} true se o tempo acabou
 */
function updateEscape(deltaSeconds) {
  const level = game.level;
  const RUMBLE_DURATION = 0.5;
  // O cronômetro para enquanto há fala na tela, para o jogador poder ler.
  if (!Dialogue.isActive) {
    level.timeLeft = Math.max(0, level.timeLeft - deltaSeconds);
    updateEscapeTimer();
    if (level.timeLeft === 0) {
      handleExplorationDefeat("O teto desabou");
      return true;
    }
    level.rumbleTimer -= deltaSeconds;
    if (level.rumbleTimer < -randomBetween(4, 7)) {
      level.rumbleTimer = RUMBLE_DURATION;
      Sound.effect("rumble");
    }
  }
  if (Math.random() < deltaSeconds * 20) level.dust.push({ x: Math.random() * VIEW_WIDTH, y: -4, speed: randomBetween(40, 100) });
  for (const speck of level.dust) speck.y += speck.speed * deltaSeconds;
  level.dust = level.dust.filter((speck) => speck.y < VIEW_HEIGHT);
  return false;
}

/**
 * Anda o passo atual.
 * @returns {boolean} true se chegar ao bloco mudou de tela (luta, próximo anel, fim)
 */
function advanceStep(deltaSeconds) {
  const inWater = tileAt(player.x, player.y) === Tile.WATER;
  const speed = inWater ? EXPLORATION.stepsPerSecondInWater : EXPLORATION.stepsPerSecond;
  player.stepProgress += deltaSeconds * speed;
  player.walkTime += deltaSeconds;
  if (player.stepProgress < 1) {
    player.pixelX = (player.fromX + (player.x - player.fromX) * player.stepProgress) * TILE_SIZE;
    player.pixelY = (player.fromY + (player.y - player.fromY) * player.stepProgress) * TILE_SIZE;
    return false;
  }
  player.pixelX = player.x * TILE_SIZE;
  player.pixelY = player.y * TILE_SIZE;
  onStepFinished();
  return game.mode !== Mode.EXPLORE;
}

function tryStep([dx, dy]) {
  if (dx) player.facing = dx > 0 ? "right" : "left";
  const targetX = player.x + dx;
  const targetY = player.y + dy;
  if (!isWalkable(targetX, targetY)) return;
  player.fromX = player.x;
  player.fromY = player.y;
  player.x = targetX;
  player.y = targetY;
  player.isMoving = true;
  player.stepProgress = 0;
}

/** O herói terminou de chegar a um bloco: fio, itens, arena, escada ou saída. */
function onStepFinished() {
  const level = game.level;
  player.isMoving = false;
  game.save.stats.steps++;
  revealAroundPlayer();
  extendTrail(player.x, player.y);

  for (const item of level.items) {
    if (!item.taken && item.x === player.x && item.y === player.y) pickUpItem(item);
  }

  const enteredArena = level.boss && !level.bossDefeated
    && isInsideArena(player.x, player.y) && !isInsideArena(player.fromX, player.fromY);
  if (enteredArena) {
    startFight({ x: player.fromX, y: player.fromY });
    return;
  }
  const onStairs = level.bossDefeated && player.x === level.boss.x && player.y === level.boss.y;
  if (onStairs) {
    Sound.effect("stairs");
    startLevel(level.index + 1);
    return;
  }
  if (level.exit && player.x === level.exit.x && player.y === level.exit.y) finishGame();
}

function extendTrail(x, y) {
  const trail = game.level.trail;
  const last = trail[trail.length - 1];
  if (last && last[0] === x && last[1] === y) return;
  trail.push([x, y]);
  if (trail.length > EXPLORATION.maxTrailLength) trail.shift();
}

function pickUpItem(item) {
  item.taken = true;
  Sound.effect("pickup");
  if (item.type === "ambrosia") {
    game.save.items.ambrosia++;
    showToast("Ambrosia +1 · aperte Q para curar 50");
  } else if (item.type === "torch") {
    game.save.items.torches++;
    showToast("Tocha +1 · na luta, aperte R para arremessar");
  } else {
    const noteIndex = game.level.index;
    addToJournal(NOTE_ID_PREFIX + noteIndex);
    Dialogue.say(`Anotações de Dédalo · ${noteIndex + 1} de ${DAEDALUS_NOTES.length}`, "scroll", DAEDALUS_NOTES[noteIndex]);
  }
  updateHud();
}

/** Ícaro anda até o bloco anterior do fio, um passo atrás do herói. */
function updateCompanionFollow(deltaSeconds) {
  const trail = game.level.trail;
  const target = trail.length > 1 ? trail[trail.length - 2] : [player.x, player.y];
  const dx = target[0] * TILE_SIZE - companion.pixelX;
  const dy = target[1] * TILE_SIZE - companion.pixelY;
  const gap = Math.hypot(dx, dy);
  companion.isMoving = gap > 0.5;
  if (!companion.isMoving) return;
  const step = Math.min(gap, EXPLORATION.companionStepsPerSecond * TILE_SIZE * deltaSeconds);
  companion.pixelX += (dx / gap) * step;
  companion.pixelY += (dy / gap) * step;
  companion.walkTime += deltaSeconds;
  if (Math.abs(dx) > 0.5) companion.facing = dx > 0 ? "right" : "left";
}

/* ------------------------------------------------------------------ */
/* Perigos                                                             */
/* ------------------------------------------------------------------ */

function spikePhase(spike) {
  return (game.time * EXPLORATION.spikeCycleSpeed + spike.phaseOffset) % 2;
}

function isSpikeRaised(spike) {
  return spikePhase(spike) < EXPLORATION.spikeRaisedPhase;
}

/** Pouco antes de subir, os espinhos aparecem no chão como aviso. */
function isSpikeAboutToRise(spike) {
  return spikePhase(spike) > EXPLORATION.spikeWarningPhase;
}

function checkSpikes() {
  const tileX = Math.round(player.pixelX / TILE_SIZE);
  const tileY = Math.round(player.pixelY / TILE_SIZE);
  const spike = game.level.spikes.find((s) => s.x === tileX && s.y === tileY && isSpikeRaised(s));
  if (!spike) return;
  Sound.effect("spike");
  damagePlayer(EXPLORATION.spikeDamage, "Espinhos");
}

/** Bichos andam de bloco em bloco, preferindo seguir em frente. */
function updateCorridorEnemies(deltaSeconds) {
  const level = game.level;
  for (const enemy of level.enemies) {
    const speed = EXPLORATION.enemyStepsPerSecond[enemy.type] || EXPLORATION.enemyStepsPerSecond.default;
    enemy.progress += deltaSeconds * speed;
    if (enemy.progress >= 1) chooseNextEnemyStep(enemy);
    enemy.pixelX = (enemy.fromX + (enemy.x - enemy.fromX) * enemy.progress) * TILE_SIZE;
    enemy.pixelY = (enemy.fromY + (enemy.y - enemy.fromY) * enemy.progress) * TILE_SIZE;

    const touching = Math.abs(enemy.pixelX - player.pixelX) < EXPLORATION.enemyContactDistance
      && Math.abs(enemy.pixelY - player.pixelY) < EXPLORATION.enemyContactDistance;
    if (touching) {
      damagePlayer(EXPLORATION.enemyContactDamage, ENEMY_NAMES[enemy.type]);
      if (game.mode !== Mode.EXPLORE || game.pauseDepth) return;
    }
  }
}

function chooseNextEnemyStep(enemy) {
  const level = game.level;
  enemy.progress = 0;
  enemy.fromX = enemy.x;
  enemy.fromY = enemy.y;
  const options = ORTHOGONAL_DIRECTIONS.filter(([dx, dy]) => {
    const x = enemy.x + dx;
    const y = enemy.y + dy;
    const isEntrance = x === level.start.x && y === level.start.y;
    return isWalkable(x, y) && !isNearRoom(level, x, y) && !isEntrance;
  });
  if (!options.length) return;
  const isReverse = ([dx, dy]) => dx === -enemy.direction[0] && dy === -enemy.direction[1];
  const forwardOptions = options.filter((option) => !isReverse(option));
  const candidates = forwardOptions.length ? forwardOptions : options;
  const straight = candidates.find(([dx, dy]) => dx === enemy.direction[0] && dy === enemy.direction[1]);
  const keepStraight = straight && Math.random() < EXPLORATION.enemyKeepDirectionChance;
  enemy.direction = keepStraight ? straight : candidates[Math.floor(Math.random() * candidates.length)];
  enemy.x += enemy.direction[0];
  enemy.y += enemy.direction[1];
}

/**
 * Dano sofrido nos corredores. Depois de um golpe, o herói fica um instante invulnerável.
 * @param {number} amount dano antes da dificuldade
 * @param {string} cause nome exibido no aviso e na tela de derrota
 */
function damagePlayer(amount, cause) {
  if (player.invulnerableTime > 0) return;
  const damage = scaleIncomingDamage(amount);
  const hero = game.save.hero;
  hero.hp = Math.max(0, hero.hp - damage);
  player.invulnerableTime = EXPLORATION.hitInvulnerability;
  Sound.effect("hurt");
  flashDamage();
  showToast(`${cause}: −${damage} de vida`, true);
  updateHud();
  if (hero.hp <= 0) handleExplorationDefeat(cause);
}

/** Bebe ambrosia (tecla Q). Não é gasta se ninguém precisa de cura. */
function useAmbrosia() {
  const { hero, companion: companionStats, items } = game.save;
  if (items.ambrosia <= 0) {
    showToast("Sem ambrosia. Procure ânforas pelos corredores.", true);
    return;
  }
  const companionCanHeal = companionStats.hp > 0 || !game.fight;
  const someoneHurt = hero.hp < hero.maxHp || (companionCanHeal && companionStats.hp < companionStats.maxHp);
  if (!someoneHurt) {
    showToast("Vida cheia: a ambrosia foi guardada.");
    return;
  }
  items.ambrosia--;
  hero.hp = Math.min(hero.maxHp, hero.hp + PROGRESSION.ambrosiaHeal);
  if (companionCanHeal) companionStats.hp = Math.min(companionStats.maxHp, companionStats.hp + PROGRESSION.ambrosiaHeal);
  Sound.effect("heal");
  showToast(`Ambrosia: +${PROGRESSION.ambrosiaHeal} de vida`);
  if (game.fight) addFloatingText(game.fight.hero.x, game.fight.hero.y - 22, `+${PROGRESSION.ambrosiaHeal}`, "#b8ffb0");
  updateHud();
}
