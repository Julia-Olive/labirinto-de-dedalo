/**
 * @file Lutas em tempo real dentro das arenas.
 *
 * Ao entrar na arena, os portões se fecham e o guardião passa a agir.
 * Todo golpe forte do guardião segue o mesmo ciclo:
 *   1. preparação: o golpe é anunciado no chão (círculo ou faixa vermelha);
 *   2. execução: o dano acontece se o herói ainda estiver na área;
 *   3. recuperação: um curto intervalo em que o guardião fica vulnerável.
 *
 * Coordenadas da luta são em pixels. x/y de cada personagem é a posição dos pés.
 */
"use strict";

/* ------------------------------------------------------------------ */
/* Ajustes                                                             */
/* ------------------------------------------------------------------ */

const FIGHT = Object.freeze({
  introSeconds: 1.6,
  victorySeconds: 1.8,
  defeatSeconds: 1.3,
  bossKeepAwayFromWall: { side: 12, top: 16, bottom: 3 },
});

const HERO_COMBAT = Object.freeze({
  walkSpeed: 74,
  shieldWalkSpeed: 30,
  waterSpeedFactor: 0.6,
  bodyHalfWidth: 5,
  bodyHalfHeight: 3,
  attackCooldown: 0.42,
  attackAnimationSeconds: 0.2,
  attackReach: 13,
  attackRadius: 10,
  baseAttackDamage: [8, 11],
  attackDamagePerLevel: 3,
  hitsPerBreath: 3,
  maxBreath: 3,
  specialBreathCost: 2,
  specialRadius: 32,
  specialSeconds: 0.35,
  specialCooldown: 0.5,
  baseSpecialDamage: [28, 36],
  specialDamagePerLevel: 8,
  torchCooldown: 0.4,
  torchSpeed: 150,
  torchDamage: 15,
  shieldDamageFactor: 0.3,
  invulnerableSeconds: 0.7,
  poisonSeconds: 3,
  poisonDamagePerSecond: 3,
  knockbackDecayPerSecond: 0.002,
});

const COMPANION_COMBAT = Object.freeze({
  walkSpeed: 62,
  distanceBehindHero: 22,
  distanceBesideHero: 12,
  throwCooldown: 1.7,
  healCooldown: 2.5,
  healAmount: 30,
  healWhenHeroBelow: 0.35,
  herbsPerFight: 2,
  stoneSpeed: 150,
  baseStoneDamage: [4, 6],
  stoneDamagePerLevel: 1,
});

const SCORPION = Object.freeze({
  speed: 34, stopDistance: 18, wobble: 0.8,
  clawRange: 24, clawDamage: 10, clawCompanionDamage: 8, clawWindup: 0.55, clawTriggerDistance: 26,
  stingWindup: 0.7, stingChance: 0.6, stingSpeed: 110, stingDamage: 6,
  recoverSeconds: 0.5, cooldown: [1, 1.9], separation: 18,
});

const MEDUSA = Object.freeze({
  speed: 32, preferredMinDistance: 38, preferredMaxDistance: 70,
  lashRange: 32, lashDamage: 12, lashCompanionDamage: 8, lashWindup: 0.5, lashTriggerDistance: 32,
  arrowWindup: 0.65, arrowSpeed: 125, arrowDamage: 8, arrowSpread: 0.28,
  gazeInterval: 9, gazeWindup: 1.7, gazeReflectDamage: 40, gazeDamage: 10, petrifySeconds: 2.2, stunSeconds: 2.6,
  cooldown: [1.1, 1.7],
});

const HYDRA = Object.freeze({
  maxHeads: 6, minHeadsAfterBurn: 2, startingHeads: 3, maxHeadsAttackingAtOnce: 2,
  biteWindup: 0.8, biteSeconds: 0.3, retractSeconds: 0.5, biteRadius: 13, biteDamage: 8, biteCompanionDamage: 6,
  cooldown: [1.3, 2.9], regenInterval: 6, regenAmount: 20, burnSeconds: 6, burnDamagePerSecond: 4,
  neckReachX: 22, neckReachY: 12, neckBaseHeight: 16,
});

const MINOTAUR = Object.freeze({
  speed: 44, furySpeed: 56, stopDistance: 20,
  smashRange: 30, smashTriggerDistance: 28, smashDamage: 18, smashCompanionDamage: 12, smashWindup: 0.6, furySmashWindup: 0.45,
  chargeWindup: 1.25, furyChargeWindup: 0.95, chargeAimLockSeconds: 0.35, chargeSpeed: 210, chargeMaxSeconds: 1.6,
  chargeHitDistance: 15, chargeDamage: 35, chargeBlockedDamage: 6, chargeCompanionDamage: 20, chargeKnockback: 260,
  chargeInterval: [7, 9], furyChargeInterval: [5, 7], wallStunSeconds: 2.5, wallSelfDamage: 20,
  recoverSeconds: 0.6,
});

/* ------------------------------------------------------------------ */
/* Início e fim                                                        */
/* ------------------------------------------------------------------ */

/**
 * Começa a luta. Salva antes, com o herói na entrada da arena, para que
 * "Tentar de novo" o devolva ali.
 * @param {{x: number, y: number}} entrance bloco de onde o herói entrou
 */
function startFight(entrance) {
  saveCheckpoint(entrance);
  const level = game.level;
  const bounds = roomPixelBounds(level);
  const bossType = level.boss.type;
  const lair = level.lair;

  game.mode = Mode.FIGHT;
  game.save.stats.fights++;
  releaseAllInput();
  Dialogue.clear();

  const heroX = player.pixelX + TILE_SIZE / 2;
  const heroY = player.pixelY + 14;
  const toCenterX = bounds.centerX - heroX;
  const toCenterY = bounds.centerY - heroY;
  const toCenterLength = Math.hypot(toCenterX, toCenterY) || 1;

  game.fight = {
    type: bossType,
    boss: BOSSES[bossType],
    hp: BOSSES[bossType].maxHp,
    maxHp: BOSSES[bossType].maxHp,
    bounds,
    entrance,
    gates: closeArenaGates(level),
    introTime: FIGHT.introSeconds,
    ending: null,
    breath: 0,
    hitsTowardBreath: 0,
    herbs: COMPANION_COMBAT.herbsPerFight,
    burnTime: 0,
    burnDamageBuffer: 0,
    poisonDamageBuffer: 0,
    regenTimer: HYDRA.regenInterval,
    shakeTime: 0,
    warning: "",
    warningIsDanger: false,
    warningTime: 0,
    projectiles: [],
    particles: [],
    floatingTexts: [],
    beam: null,
    hero: {
      x: heroX, y: heroY,
      facingX: toCenterX / toCenterLength, facingY: toCenterY / toCenterLength,
      cooldown: 0, attackAnimation: 0, specialAnimation: 0, queuedAction: null,
      isShielding: false, invulnerableTime: 0, petrifiedTime: 0, poisonTime: 0,
      knockbackX: 0, knockbackY: 0, walkTime: 0, isMoving: false,
    },
    companion: {
      x: heroX + (toCenterX / toCenterLength) * 8, y: heroY + (toCenterY / toCenterLength) * 8,
      cooldown: 1.4, invulnerableTime: 0, walkTime: 0, isMoving: false, facing: 1,
    },
    scorpions: lair.parts || null,
    body: lair.body || null,
    heads: lair.heads || null,
  };
  resetGuardian(game.fight);

  Sound.effect("gate");
  Sound.effect("roar");
  Sound.playSong("battle");
  setBossWarning(`${BOSSES[bossType].name}!`, false, FIGHT.introSeconds);
  updateHud();
}

/** Deixa o guardião pronto para lutar (também após uma fuga). */
function resetGuardian(fight) {
  if (fight.scorpions) {
    for (const scorpion of fight.scorpions) {
      Object.assign(scorpion, { state: "move", hp: fight.maxHp / fight.scorpions.length, alive: true, cooldown: randomBetween(...SCORPION.cooldown) });
    }
  }
  if (fight.body) {
    Object.assign(fight.body, { state: "move", cooldown: 1.2, gazeTimer: 7, chargeTimer: 5 });
  }
  if (fight.heads) {
    fight.heads.length = HYDRA.startingHeads;
    fight.heads.forEach((head, i) => Object.assign(head, { state: "idle", cooldown: 1 + i * 0.7 }));
  }
}

/** Fecha com grades de bronze todas as passagens da arena. */
function closeArenaGates(level) {
  const gates = [];
  const room = level.room;
  for (let y = room.y0 - 1; y <= room.y1 + 1; y++) {
    for (let x = room.x0 - 1; x <= room.x1 + 1; x++) {
      if (isInsideArena(x, y)) continue;
      const tile = tileAt(x, y);
      if (tile !== Tile.FLOOR && tile !== Tile.WATER) continue;
      gates.push({ x, y, originalTile: tile });
      setTile(level, x, y, Tile.GATE);
    }
  }
  for (let y = room.y0 - 1; y <= room.y1 + 1; y++) {
    for (let x = room.x0 - 1; x <= room.x1 + 1; x++) level.explored[tileIndex(level, x, y)] = 1;
  }
  return gates;
}

function openArenaGates() {
  for (const gate of game.fight.gates) setTile(game.level, gate.x, gate.y, gate.originalTile);
  Sound.effect("gate");
}

function winFight() {
  const fight = game.fight;
  fight.ending = { result: "victory", timeLeft: FIGHT.victorySeconds };
  fight.shakeTime = 0.4;
  Sound.effect("victory");
  Sound.playSong(null);
  setBossWarning(`${fight.boss.name}: derrotado!`, false, 3);
}

function loseFight() {
  const fight = game.fight;
  if (fight.ending) return;
  fight.ending = { result: "defeat", timeLeft: FIGHT.defeatSeconds };
  Sound.effect("defeat");
  Sound.playSong(null);
}

/** Chamado quando a animação de vitória ou derrota termina. */
function finishFight() {
  const fight = game.fight;
  if (fight.ending.result === "defeat") {
    handleFightDefeat(fight);
    return;
  }
  openArenaGates();
  rewardVictory();

  const level = game.level;
  level.bossDefeated = true;
  const exitTile = safeTileAfterFight(fight.hero);
  game.fight = null;
  placePlayer(exitTile.x, exitTile.y);
  extendTrail(exitTile.x, exitTile.y);
  enterExploration();

  if (fight.type === "mino") {
    startLevel(level.index + 1);
    return;
  }
  Dialogue.playStory(`victory_${fight.type}`);
  showToast(`Nível ${game.save.hero.level}: mais vida e mais força`);
  updateHud();
  saveCheckpoint();
}

/** Selo, subida de nível e cura parcial. */
function rewardVictory() {
  const { hero, companion: companionStats } = game.save;
  game.save.seals++;
  hero.level++;
  hero.maxHp += PROGRESSION.heroHpPerLevel;
  hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * PROGRESSION.healAfterVictoryFraction));
  companionStats.maxHp += PROGRESSION.companionHpPerLevel;
  companionStats.hp = companionStats.maxHp;
}

/** Bloco onde o herói fica depois da luta (fora da escada, que desceria na hora). */
function safeTileAfterFight(hero) {
  const boss = game.level.boss;
  const x = Math.floor(hero.x / TILE_SIZE);
  const y = Math.floor((hero.y - 3) / TILE_SIZE);
  const isStairs = x === boss.x && y === boss.y;
  return isWalkable(x, y) && !isStairs ? { x, y } : { x: boss.x + 1, y: boss.y + 1 };
}

/** Sai da arena pelo menu de pausa. O guardião volta ao começo. */
function fleeFight() {
  const fight = game.fight;
  if (!fight) return;
  openArenaGates();
  if (fight.body) fight.body.state = "idle";
  if (fight.scorpions) fight.scorpions.forEach((scorpion) => Object.assign(scorpion, { state: "idle", alive: true }));
  game.fight = null;
  placePlayer(fight.entrance.x, fight.entrance.y);
  enterExploration();
  showToast("Você recuou. O guardião recupera as forças.");
}

/* ------------------------------------------------------------------ */
/* Laço da luta                                                        */
/* ------------------------------------------------------------------ */

function updateFight(deltaSeconds) {
  const fight = game.fight;
  updateWarningTimer(fight, deltaSeconds);
  if (fight.shakeTime > 0) fight.shakeTime -= deltaSeconds;
  updateVisualEffects(fight, deltaSeconds);

  if (fight.ending) {
    updateEnding(fight, deltaSeconds);
    return;
  }

  updateHeroMovement(fight, deltaSeconds);
  updateHeroTimers(fight, deltaSeconds);
  if (fight.introTime > 0) fight.introTime -= deltaSeconds;
  else BOSS_BEHAVIOURS[fight.type](fight, deltaSeconds);
  updateCompanionInFight(fight, deltaSeconds);
  updateProjectiles(fight, deltaSeconds);

  if (fight.scorpions) fight.hp = Math.max(0, Math.round(fight.scorpions.reduce((sum, s) => sum + (s.alive ? Math.max(0, s.hp) : 0), 0)));
  if (fight.hp <= 0 && !fight.ending) winFight();
  updateBossPanel();
}

function updateWarningTimer(fight, deltaSeconds) {
  if (fight.warningTime <= 0) return;
  fight.warningTime -= deltaSeconds;
  if (fight.warningTime <= 0) fight.warning = "";
}

function updateEnding(fight, deltaSeconds) {
  fight.ending.timeLeft -= deltaSeconds;
  const isVictory = fight.ending.result === "victory";
  if (isVictory && Math.random() < deltaSeconds * 30) {
    const target = fightTargets(fight)[0];
    if (target) spawnParticles(target.x + randomBetween(-10, 10), target.y + randomBetween(-8, 8), "#ffe08a", 3);
  }
  if (fight.ending.timeLeft <= 0) finishFight();
}

function updateHeroMovement(fight, deltaSeconds) {
  const hero = fight.hero;
  let [dx, dy] = combinedDirection();
  if (hero.petrifiedTime > 0) {
    hero.petrifiedTime -= deltaSeconds;
    dx = 0;
    dy = 0;
  }
  hero.isShielding = isActionHeld("shield") && hero.petrifiedTime <= 0;

  const length = Math.hypot(dx, dy);
  if (length) {
    dx /= length;
    dy /= length;
    hero.facingX = dx;
    hero.facingY = dy;
  }
  const inWater = tileAt(Math.floor(hero.x / TILE_SIZE), Math.floor((hero.y - 2) / TILE_SIZE)) === Tile.WATER;
  let speed = hero.isShielding ? HERO_COMBAT.shieldWalkSpeed : HERO_COMBAT.walkSpeed;
  if (inWater) speed *= HERO_COMBAT.waterSpeedFactor;

  moveWithCollision(hero, (dx * speed + hero.knockbackX) * deltaSeconds, (dy * speed + hero.knockbackY) * deltaSeconds,
    HERO_COMBAT.bodyHalfWidth, HERO_COMBAT.bodyHalfHeight);
  const decay = Math.pow(HERO_COMBAT.knockbackDecayPerSecond, deltaSeconds);
  hero.knockbackX *= decay;
  hero.knockbackY *= decay;
  hero.isMoving = length > 0;
  if (hero.isMoving) hero.walkTime += deltaSeconds;
}

function updateHeroTimers(fight, deltaSeconds) {
  const hero = fight.hero;
  hero.cooldown -= deltaSeconds;
  hero.attackAnimation -= deltaSeconds;
  hero.specialAnimation -= deltaSeconds;
  hero.invulnerableTime -= deltaSeconds;

  // Ações apertadas durante a recarga são executadas assim que ela termina.
  if (hero.queuedAction && hero.cooldown <= 0 && hero.petrifiedTime <= 0) {
    const action = hero.queuedAction;
    hero.queuedAction = null;
    HERO_ACTIONS[action]();
  }

  if (hero.poisonTime > 0) {
    hero.poisonTime -= deltaSeconds;
    fight.poisonDamageBuffer += deltaSeconds * HERO_COMBAT.poisonDamagePerSecond;
    if (fight.poisonDamageBuffer >= 1) {
      fight.poisonDamageBuffer -= 1;
      damageHero(1, { ignoreShield: true, silent: true });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Ações do herói                                                      */
/* ------------------------------------------------------------------ */

const HERO_ACTIONS = {
  attack: heroAttack,
  special: heroSpecial,
  torch: heroThrowTorch,
};

function damageRange(base, perLevel) {
  const bonus = perLevel * (game.save.hero.level - 1);
  return [base[0] + bonus, base[1] + bonus];
}

/**
 * Verifica se o herói pode agir agora. Durante a recarga, guarda a ação
 * para executar depois; petrificado, explica por que nada acontece.
 */
function heroCannotActNow(hero, action) {
  if (hero.petrifiedTime > 0) {
    setBossWarning("Você está petrificado e não consegue se mexer!", false, 1);
    return true;
  }
  if (hero.cooldown > 0) {
    hero.queuedAction = action;
    return true;
  }
  return false;
}

function heroAttack() {
  const fight = game.fight;
  if (!fight || fight.ending) return;
  const hero = fight.hero;
  if (hero.isShielding) {
    setBossWarning("Solte o escudo (Shift/K) para atacar.", false, 1.5);
    return;
  }
  if (heroCannotActNow(hero, "attack")) return;

  hero.cooldown = HERO_COMBAT.attackCooldown;
  hero.attackAnimation = HERO_COMBAT.attackAnimationSeconds;
  Sound.effect("swing");
  const tipX = hero.x + hero.facingX * HERO_COMBAT.attackReach;
  const tipY = hero.y - 8 + hero.facingY * 11;
  const target = nearestTargetWithin(fight, tipX, tipY, HERO_COMBAT.attackRadius);
  if (!target) return;

  damageBoss(fight, target, randomInt(...damageRange(HERO_COMBAT.baseAttackDamage, HERO_COMBAT.attackDamagePerLevel)));
  fight.hitsTowardBreath++;
  if (fight.hitsTowardBreath >= HERO_COMBAT.hitsPerBreath) {
    fight.hitsTowardBreath = 0;
    fight.breath = Math.min(HERO_COMBAT.maxBreath, fight.breath + 1);
    updateHud();
  }
}

function heroSpecial() {
  const fight = game.fight;
  if (!fight || fight.ending) return;
  const hero = fight.hero;
  if (heroCannotActNow(hero, "special")) return;
  if (fight.breath < HERO_COMBAT.specialBreathCost) {
    setBossWarning(`Golpe heroico precisa de ${HERO_COMBAT.specialBreathCost} de fôlego (você tem ${fight.breath}). Acerte ${HERO_COMBAT.hitsPerBreath} golpes para ganhar 1.`, false, 2.5);
    return;
  }

  fight.breath -= HERO_COMBAT.specialBreathCost;
  hero.specialAnimation = HERO_COMBAT.specialSeconds;
  hero.cooldown = HERO_COMBAT.specialCooldown;
  Sound.effect("swing");
  Sound.effect("hit");
  const range = damageRange(HERO_COMBAT.baseSpecialDamage, HERO_COMBAT.specialDamagePerLevel);
  const targetsHit = fightTargets(fight).filter((t) => distance(t.x, t.y, hero.x, hero.y - 8) < HERO_COMBAT.specialRadius + t.radius);
  for (const target of targetsHit) damageBoss(fight, target, randomInt(...range));
  if (!targetsHit.length) setBossWarning("O golpe heroico atinge quem estiver perto. Chegue mais!", false, 2);
  updateHud();
}

function heroThrowTorch() {
  const fight = game.fight;
  if (!fight || fight.ending) return;
  const hero = fight.hero;
  if (heroCannotActNow(hero, "torch")) return;
  if (game.save.items.torches <= 0) {
    setBossWarning("Você não tem tochas. Elas aparecem pelos corredores.", false, 2.5);
    return;
  }
  const target = fightTargets(fight)[0];
  if (!target) return;

  game.save.items.torches--;
  hero.cooldown = HERO_COMBAT.torchCooldown;
  Sound.effect("fire");
  const angle = Math.atan2(target.y - (hero.y - 10), target.x - hero.x);
  shootProjectile(fight, "hero", hero.x, hero.y - 10, angle, HERO_COMBAT.torchSpeed, "fire", HERO_COMBAT.torchDamage);
  updateHud();
}

/* ------------------------------------------------------------------ */
/* Dano, alvos e projéteis                                             */
/* ------------------------------------------------------------------ */

/**
 * Partes do guardião que podem ser atingidas.
 * @returns {{x: number, y: number, radius: number, scorpion?: object}[]}
 */
function fightTargets(fight) {
  if (fight.scorpions) {
    return fight.scorpions.filter((s) => s.alive).map((s) => ({ x: s.x, y: s.y - 5, radius: 9, scorpion: s }));
  }
  if (fight.type === "hydra") {
    const exposedHeads = fight.heads.filter((head) => head.state === "strike" || head.state === "retract");
    return [{ x: fight.body.x, y: fight.body.y - 8, radius: 13 }, ...exposedHeads.map((head) => ({ x: head.x, y: head.y, radius: 7 }))];
  }
  return [{ x: fight.body.x, y: fight.body.y - 10, radius: fight.type === "mino" ? 11 : 9 }];
}

function nearestTargetWithin(fight, x, y, radius) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const target of fightTargets(fight)) {
    const d = distance(target.x, target.y, x, y);
    if (d <= radius + target.radius && d < nearestDistance) {
      nearest = target;
      nearestDistance = d;
    }
  }
  return nearest;
}

function damageBoss(fight, target, amount) {
  if (fight.ending) return;
  if (target.scorpion) {
    const scorpion = target.scorpion;
    scorpion.hp -= amount;
    scorpion.flash = 0.15;
    if (scorpion.hp <= 0) {
      scorpion.alive = false;
      spawnParticles(target.x, target.y, "#a0522a", 16);
      setBossWarning("Um escorpião a menos!", false, 1.5);
    }
  } else {
    fight.hp = Math.max(0, fight.hp - amount);
    fight.body.flash = 0.15;
  }
  addFloatingText(target.x + randomBetween(-3, 3), target.y - target.radius - 2, String(amount), "#fff");
  Sound.effect("hit");
  spawnParticles(target.x, target.y, "#fff4c0", 4);
}

/** Dano direto ao guardião, fora do alvo atingido (reflexo, parede, fogo). */
function damageGuardianDirectly(fight, amount, labelX, labelY) {
  fight.hp = Math.max(0, fight.hp - amount);
  if (fight.body) fight.body.flash = 0.3;
  addFloatingText(labelX, labelY, String(amount), "#fff");
}

/**
 * Dano ao herói na luta.
 * @param {number} amount dano antes da dificuldade e do escudo
 * @param {{ignoreShield?: boolean, silent?: boolean}} [options]
 *   ignoreShield: o escudo não reduz (o efeito já foi calculado);
 *   silent: dano contínuo, sem tremor nem invulnerabilidade
 * @returns {number} dano efetivo
 */
function damageHero(amount, { ignoreShield = false, silent = false } = {}) {
  const fight = game.fight;
  const hero = fight.hero;
  const stats = game.save.hero;
  if (fight.ending || stats.hp <= 0) return 0;
  if (!silent && hero.invulnerableTime > 0) return 0;

  let damage = scaleIncomingDamage(amount);
  if (hero.isShielding && !ignoreShield) {
    damage = Math.ceil(damage * HERO_COMBAT.shieldDamageFactor);
    Sound.effect("shield");
  }
  if (damage <= 0) return 0;

  stats.hp = Math.max(0, stats.hp - damage);
  if (!silent) {
    hero.invulnerableTime = HERO_COMBAT.invulnerableSeconds;
    Sound.effect("hurt");
    flashDamage();
    fight.shakeTime = 0.2;
  }
  addFloatingText(hero.x, hero.y - 22, `−${damage}`, "#ffb0a0");
  updateHud();
  if (stats.hp <= 0) loseFight();
  return damage;
}

function damageCompanion(amount) {
  const fight = game.fight;
  const stats = game.save.companion;
  const ally = fight.companion;
  if (fight.ending || stats.hp <= 0 || ally.invulnerableTime > 0) return;
  const damage = scaleIncomingDamage(amount);
  stats.hp = Math.max(0, stats.hp - damage);
  ally.invulnerableTime = HERO_COMBAT.invulnerableSeconds;
  addFloatingText(ally.x, ally.y - 18, `−${damage}`, "#ffb0a0");
  if (stats.hp <= 0) setBossWarning("Ícaro caiu! Ele se levanta depois da luta.", false, 2.5);
  updateHud();
}

function isHeroWithin(fight, x, y, radius) {
  return distance(fight.hero.x, fight.hero.y, x, y) < radius;
}

function isCompanionWithin(fight, x, y, radius) {
  return game.save.companion.hp > 0 && distance(fight.companion.x, fight.companion.y, x, y) < radius;
}

/** Acerta herói e Ícaro que estiverem dentro do raio de um golpe em área. */
function strikeArea(fight, x, y, radius, heroDamage, companionDamage) {
  if (isHeroWithin(fight, x, y, radius)) damageHero(heroDamage);
  if (isCompanionWithin(fight, x, y, radius)) damageCompanion(companionDamage);
}

/**
 * @param {"hero"|"companion"|"boss"} owner quem atirou
 * @param {"stone"|"fire"|"arrow"|"poison"} kind
 */
function shootProjectile(fight, owner, x, y, angle, speed, kind, damage) {
  const LIFETIME_SECONDS = 2.5;
  fight.projectiles.push({ owner, x, y, velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed, kind, damage, life: LIFETIME_SECONDS });
}

function updateProjectiles(fight, deltaSeconds) {
  const hero = fight.hero;
  for (const shot of fight.projectiles) {
    shot.life -= deltaSeconds;
    shot.x += shot.velocityX * deltaSeconds;
    shot.y += shot.velocityY * deltaSeconds;

    if (isSolidAtPixel(shot.x, shot.y + 6)) {
      shot.life = 0;
      spawnParticles(shot.x, shot.y, "#c8b08a", 3);
      continue;
    }
    if (shot.owner === "boss") hitAlliesWithProjectile(fight, hero, shot);
    else hitGuardianWithProjectile(fight, shot);
  }
  fight.projectiles = fight.projectiles.filter((shot) => shot.life > 0);
}

function hitAlliesWithProjectile(fight, hero, shot) {
  const HIT_RADIUS = 8;
  if (distance(shot.x, shot.y, hero.x, hero.y - 8) < HIT_RADIUS) {
    shot.life = 0;
    if (hero.isShielding) {
      Sound.effect("shield");
      spawnParticles(shot.x, shot.y, "#ffe08a", 5);
      addFloatingText(hero.x, hero.y - 22, "Bloqueado", "#ffe08a");
      return;
    }
    damageHero(shot.damage);
    if (shot.kind === "poison") hero.poisonTime = HERO_COMBAT.poisonSeconds;
    return;
  }
  if (isCompanionWithin(fight, shot.x, shot.y + 8, 7)) {
    shot.life = 0;
    damageCompanion(shot.damage);
  }
}

function hitGuardianWithProjectile(fight, shot) {
  const target = nearestTargetWithin(fight, shot.x, shot.y, 3);
  if (!target) return;
  shot.life = 0;
  damageBoss(fight, target, shot.damage);
  if (shot.kind !== "fire") return;
  spawnParticles(shot.x, shot.y, "#ff7a20", 12);
  if (fight.type === "hydra") {
    fight.burnTime = HYDRA.burnSeconds;
    if (fight.heads.length > HYDRA.minHeadsAfterBurn) fight.heads.pop();
    setBossWarning(`Os cortes estão queimando: nada renasce por ${HYDRA.burnSeconds} segundos!`, false, 3);
  }
}

/* ------------------------------------------------------------------ */
/* Movimento                                                           */
/* ------------------------------------------------------------------ */

function isSolidAtPixel(x, y) {
  const tile = tileAt(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
  return tile === Tile.WALL || tile === Tile.STATUE || tile === Tile.GATE;
}

/** Move um corpo retangular, deslizando pelas paredes. */
function moveWithCollision(body, dx, dy, halfWidth, halfHeight) {
  const fitsAt = (x, y) => !isSolidAtPixel(x - halfWidth, y - halfHeight) && !isSolidAtPixel(x + halfWidth, y - halfHeight)
    && !isSolidAtPixel(x - halfWidth, y) && !isSolidAtPixel(x + halfWidth, y);
  if (dx && fitsAt(body.x + dx, body.y)) body.x += dx;
  if (dy && fitsAt(body.x, body.y + dy)) body.y += dy;
}

/** Move o guardião sem deixar que saia da arena. */
function moveGuardian(fight, body, dx, dy) {
  const margin = FIGHT.bossKeepAwayFromWall;
  body.x = clamp(body.x + dx, fight.bounds.left + margin.side, fight.bounds.right - margin.side);
  body.y = clamp(body.y + dy, fight.bounds.top + margin.top, fight.bounds.bottom - margin.bottom);
}

/** Vetor do ponto (fromX, fromY) até o herói, com a distância. */
function vectorToHero(fight, fromX, fromY) {
  const dx = fight.hero.x - fromX;
  const dy = fight.hero.y - fromY;
  const length = Math.hypot(dx, dy) || 1;
  return { dx, dy, length, unitX: dx / length, unitY: dy / length };
}

/* ------------------------------------------------------------------ */
/* Ícaro                                                               */
/* ------------------------------------------------------------------ */

function updateCompanionInFight(fight, deltaSeconds) {
  const ally = fight.companion;
  const hero = fight.hero;
  ally.invulnerableTime -= deltaSeconds;
  if (game.save.companion.hp <= 0) {
    ally.isMoving = false;
    return;
  }

  // Fica atrás do herói, do lado oposto ao guardião, um pouco de lado.
  const target = fightTargets(fight)[0];
  let goalX = hero.x;
  let goalY = hero.y;
  if (target) {
    const away = { x: hero.x - target.x, y: hero.y - target.y };
    const length = Math.hypot(away.x, away.y) || 1;
    goalX = hero.x + (away.x / length) * COMPANION_COMBAT.distanceBehindHero - (away.y / length) * COMPANION_COMBAT.distanceBesideHero;
    goalY = hero.y + (away.y / length) * COMPANION_COMBAT.distanceBehindHero + (away.x / length) * COMPANION_COMBAT.distanceBesideHero;
    ally.facing = target.x < ally.x ? -1 : 1;
  }
  const gap = distance(ally.x, ally.y, goalX, goalY);
  ally.isMoving = gap > 4;
  if (ally.isMoving) {
    const step = Math.min(gap, COMPANION_COMBAT.walkSpeed * deltaSeconds);
    moveWithCollision(ally, ((goalX - ally.x) / gap) * step, ((goalY - ally.y) / gap) * step, 4, 3);
    ally.walkTime += deltaSeconds;
  }

  ally.cooldown -= deltaSeconds;
  if (ally.cooldown > 0 || fight.introTime > 0) return;
  const heroStats = game.save.hero;
  if (fight.herbs > 0 && heroStats.hp < heroStats.maxHp * COMPANION_COMBAT.healWhenHeroBelow) {
    companionHealsHero(fight);
  } else if (target) {
    const angle = Math.atan2(target.y - (ally.y - 10), target.x - ally.x);
    const damage = randomInt(...damageRange(COMPANION_COMBAT.baseStoneDamage, COMPANION_COMBAT.stoneDamagePerLevel));
    shootProjectile(fight, "companion", ally.x, ally.y - 10, angle, COMPANION_COMBAT.stoneSpeed, "stone", damage);
    ally.cooldown = COMPANION_COMBAT.throwCooldown;
  }
}

function companionHealsHero(fight) {
  const heroStats = game.save.hero;
  fight.herbs--;
  const healed = Math.min(COMPANION_COMBAT.healAmount, heroStats.maxHp - heroStats.hp);
  heroStats.hp += healed;
  addFloatingText(fight.hero.x, fight.hero.y - 22, `+${healed}`, "#b8ffb0");
  Sound.effect("heal");
  setBossWarning(`Ícaro usou ervas de cura (+${healed}). Restam ${fight.herbs}.`, false, 2);
  fight.companion.cooldown = COMPANION_COMBAT.healCooldown;
  updateHud();
}

/* ------------------------------------------------------------------ */
/* Guardiões                                                           */
/* ------------------------------------------------------------------ */

/** Os três escorpiões cercam o herói, beliscam de perto e cospem veneno de longe. */
function updateScorpions(fight, deltaSeconds) {
  for (const scorpion of fight.scorpions) {
    if (!scorpion.alive) continue;
    scorpion.flash -= deltaSeconds;
    scorpion.timer -= deltaSeconds;
    const toHero = vectorToHero(fight, scorpion.x, scorpion.y);
    scorpion.facing = toHero.dx < 0 ? -1 : 1;

    if (scorpion.state === "move") {
      // Avança em zigue-zague, o que torna o movimento menos previsível.
      const wobble = Math.sin(game.time * 3 + scorpion.wobblePhase) * SCORPION.wobble;
      const speed = toHero.length > SCORPION.stopDistance ? SCORPION.speed : 0;
      moveGuardian(fight, scorpion,
        (toHero.unitX - toHero.unitY * wobble) * speed * deltaSeconds,
        (toHero.unitY + toHero.unitX * wobble) * speed * deltaSeconds);
      scorpion.cooldown -= deltaSeconds;
      if (scorpion.cooldown > 0) continue;
      if (toHero.length < SCORPION.clawTriggerDistance) prepare(scorpion, "claw", SCORPION.clawWindup);
      else if (Math.random() < SCORPION.stingChance) prepare(scorpion, "sting", SCORPION.stingWindup);
      else scorpion.cooldown = 0.5;
    } else if (scorpion.state === "windup" && scorpion.timer <= 0) {
      if (scorpion.attackKind === "claw") {
        strikeArea(fight, scorpion.x, scorpion.y, SCORPION.clawRange, SCORPION.clawDamage, SCORPION.clawCompanionDamage);
        Sound.effect("hit");
        fight.shakeTime = 0.1;
      } else {
        const angle = Math.atan2(fight.hero.y - 8 - (scorpion.y - 12), toHero.dx);
        shootProjectile(fight, "boss", scorpion.x + scorpion.facing * 4, scorpion.y - 12, angle, SCORPION.stingSpeed, "poison", SCORPION.stingDamage);
        Sound.effect("arrow");
      }
      recover(scorpion, SCORPION.recoverSeconds);
    } else if (scorpion.state === "recover" && scorpion.timer <= 0) {
      scorpion.state = "move";
      scorpion.cooldown = randomBetween(...SCORPION.cooldown);
    }
  }
  keepScorpionsApart(fight.scorpions);
}

function keepScorpionsApart(scorpions) {
  const PUSH = 0.6;
  for (const a of scorpions) {
    for (const b of scorpions) {
      if (a === b || !a.alive || !b.alive) continue;
      const gap = distance(a.x, a.y, b.x, b.y);
      if (gap > 0 && gap < SCORPION.separation) {
        a.x -= ((b.x - a.x) / gap) * PUSH;
        a.y -= ((b.y - a.y) / gap) * PUSH;
      }
    }
  }
}

/** A Medusa mantém distância, atira flechas e, de tempos em tempos, lança o olhar. */
function updateMedusa(fight, deltaSeconds) {
  const medusa = fight.body;
  medusa.flash -= deltaSeconds;
  medusa.timer -= deltaSeconds;
  const toHero = vectorToHero(fight, medusa.x, medusa.y);
  medusa.facing = toHero.dx < 0 ? -1 : 1;

  switch (medusa.state) {
    case "move": {
      let moveX = 0;
      let moveY = 0;
      if (toHero.length > MEDUSA.preferredMaxDistance) { moveX = toHero.unitX; moveY = toHero.unitY; }
      else if (toHero.length < MEDUSA.preferredMinDistance) { moveX = -toHero.unitX; moveY = -toHero.unitY; }
      const strafe = Math.sin(game.time * 0.8) * 0.6;
      moveX += -toHero.unitY * strafe;
      moveY += toHero.unitX * strafe;
      moveGuardian(fight, medusa, moveX * MEDUSA.speed * deltaSeconds, moveY * MEDUSA.speed * deltaSeconds);

      medusa.cooldown -= deltaSeconds;
      medusa.gazeTimer -= deltaSeconds;
      if (medusa.gazeTimer <= 0) {
        medusa.gazeTimer = MEDUSA.gazeInterval;
        prepare(medusa, "gaze", MEDUSA.gazeWindup);
        setBossWarning("OLHAR PETRIFICANTE! Segure o escudo (Shift)", true);
        Sound.effect("petrify");
      } else if (medusa.cooldown <= 0) {
        if (toHero.length < MEDUSA.lashTriggerDistance) prepare(medusa, "lash", MEDUSA.lashWindup);
        else prepare(medusa, "arrows", MEDUSA.arrowWindup);
      }
      break;
    }
    case "windup":
      if (medusa.timer > 0) break;
      if (medusa.attackKind === "lash") {
        strikeArea(fight, medusa.x, medusa.y, MEDUSA.lashRange, MEDUSA.lashDamage, MEDUSA.lashCompanionDamage);
        Sound.effect("hit");
        recover(medusa, 0.5);
      } else if (medusa.attackKind === "arrows") {
        const angle = Math.atan2(fight.hero.y - 8 - (medusa.y - 14), toHero.dx);
        for (const offset of [-MEDUSA.arrowSpread, 0, MEDUSA.arrowSpread]) {
          shootProjectile(fight, "boss", medusa.x, medusa.y - 14, angle + offset, MEDUSA.arrowSpeed, "arrow", MEDUSA.arrowDamage);
        }
        Sound.effect("arrow");
        recover(medusa, 0.6);
      } else {
        resolveGaze(fight, medusa);
      }
      break;
    case "recover":
    case "stunned":
      if (medusa.timer > 0) break;
      medusa.state = "move";
      medusa.cooldown = randomBetween(...MEDUSA.cooldown);
      if (fight.warningIsDanger) fight.warning = "";
      break;
  }
}

/** O olhar petrifica quem estiver sem escudo; com escudo, volta para a Medusa. */
function resolveGaze(fight, medusa) {
  const hero = fight.hero;
  const eyesY = medusa.y - 22;
  if (hero.isShielding) {
    damageGuardianDirectly(fight, MEDUSA.gazeReflectDamage, medusa.x, medusa.y - 32);
    fight.beam = { fromX: hero.x, fromY: hero.y - 10, toX: medusa.x, toY: eyesY, timeLeft: 0.45, color: "#b0ffb0" };
    medusa.state = "stunned";
    medusa.timer = MEDUSA.stunSeconds;
    setBossWarning("O escudo refletiu o olhar! Ela está tonta: ataque!", false, MEDUSA.stunSeconds);
    Sound.effect("shield");
    return;
  }
  fight.beam = { fromX: medusa.x, fromY: eyesY, toX: hero.x, toY: hero.y - 10, timeLeft: 0.45, color: "#90ff90" };
  hero.petrifiedTime = MEDUSA.petrifySeconds;
  damageHero(MEDUSA.gazeDamage, { ignoreShield: true });
  recover(medusa, 0.8);
  setBossWarning("Você foi petrificado! Na próxima, segure o escudo.", false, 2.4);
}

/** Posição de descanso de cada cabeça da Hidra, em leque acima do corpo. */
function hydraHeadRestPosition(body, index, headCount) {
  const angle = -Math.PI / 2 + (index - (headCount - 1) / 2) * 0.55;
  return [
    body.x + Math.cos(angle) * HYDRA.neckReachX,
    body.y - HYDRA.neckBaseHeight + Math.sin(angle) * HYDRA.neckReachY + Math.sin(game.time * 2 + index) * 2,
  ];
}

/** Antes da luta, as cabeças apenas balançam no lugar. */
function placeHydraHeadsAtRest(lair) {
  lair.heads.forEach((head, i) => {
    [head.x, head.y] = hydraHeadRestPosition(lair.body, i, lair.heads.length);
  });
}

/** A Hidra fica no lugar. Cada cabeça mira onde o herói está e morde ali. */
function updateHydra(fight, deltaSeconds) {
  const body = fight.body;
  const hero = fight.hero;
  body.flash -= deltaSeconds;
  let attackingHeads = fight.heads.filter((head) => head.state === "windup" || head.state === "strike").length;

  fight.heads.forEach((head, index) => {
    const [restX, restY] = hydraHeadRestPosition(body, index, fight.heads.length);
    head.timer -= deltaSeconds;
    switch (head.state) {
      case "idle":
        head.x = restX;
        head.y = restY;
        head.cooldown -= deltaSeconds;
        if (head.cooldown <= 0 && attackingHeads < HYDRA.maxHeadsAttackingAtOnce) {
          head.state = "windup";
          head.timer = HYDRA.biteWindup;
          head.targetX = hero.x + randomBetween(-4, 4);
          head.targetY = hero.y - 4 + randomBetween(-3, 3);
          attackingHeads++;
        }
        break;
      case "windup":
        // A cabeça recua antes de dar o bote.
        head.x = restX - (head.targetX - restX) * 0.08;
        head.y = restY - 4;
        if (head.timer <= 0) {
          head.state = "strike";
          head.timer = HYDRA.biteSeconds;
          if (distance(hero.x, hero.y - 4, head.targetX, head.targetY) < HYDRA.biteRadius) damageHero(HYDRA.biteDamage);
          if (isCompanionWithin(fight, head.targetX, head.targetY + 4, HYDRA.biteRadius)) damageCompanion(HYDRA.biteCompanionDamage);
          Sound.effect("hit");
        }
        break;
      case "strike":
        head.x = head.targetX;
        head.y = head.targetY;
        if (head.timer <= 0) {
          head.state = "retract";
          head.timer = HYDRA.retractSeconds;
        }
        break;
      case "retract": {
        const remaining = clamp(head.timer / HYDRA.retractSeconds, 0, 1);
        head.x = restX + (head.targetX - restX) * remaining;
        head.y = restY + (head.targetY - restY) * remaining;
        if (head.timer <= 0) {
          head.state = "idle";
          head.cooldown = randomBetween(...HYDRA.cooldown);
        }
        break;
      }
    }
  });

  updateHydraBurnAndRegrowth(fight, deltaSeconds);
}

function updateHydraBurnAndRegrowth(fight, deltaSeconds) {
  const body = fight.body;
  if (fight.burnTime > 0) {
    fight.burnTime -= deltaSeconds;
    fight.burnDamageBuffer += deltaSeconds * HYDRA.burnDamagePerSecond;
    if (fight.burnDamageBuffer >= 1) {
      fight.burnDamageBuffer -= 1;
      fight.hp = Math.max(0, fight.hp - 1);
    }
    if (Math.random() < deltaSeconds * 25) {
      fight.particles.push({ x: body.x + randomBetween(-12, 12), y: body.y - 14 - Math.random() * 8, velocityX: 0, velocityY: -20, life: 0.4, color: Math.random() < 0.5 ? "#ff7a20" : "#ffd040" });
    }
  }

  fight.regenTimer -= deltaSeconds;
  if (fight.regenTimer > 0) return;
  fight.regenTimer = HYDRA.regenInterval;
  if (fight.burnTime > 0 || fight.hp >= fight.maxHp) return;
  const healed = Math.min(HYDRA.regenAmount, fight.maxHp - fight.hp);
  fight.hp += healed;
  addFloatingText(body.x, body.y - 34, `+${healed}`, "#b0ffb0");
  if (fight.heads.length < HYDRA.maxHeads) fight.heads.push(createHydraHead(body, 0.5));
  setBossWarning(`Cabeças renasceram (${fight.heads.length})! Arremesse uma tocha (R).`, true, 3);
}

/** O Minotauro persegue, golpeia com a clava e, de tempos em tempos, investe em linha reta. */
function updateMinotaur(fight, deltaSeconds) {
  const minotaur = fight.body;
  const hero = fight.hero;
  minotaur.flash -= deltaSeconds;
  minotaur.timer -= deltaSeconds;
  const inFury = fight.hp < fight.maxHp / 2;
  const toHero = vectorToHero(fight, minotaur.x, minotaur.y);
  if (minotaur.state !== "charge") minotaur.facing = toHero.dx < 0 ? -1 : 1;

  switch (minotaur.state) {
    case "move": {
      const speed = inFury ? MINOTAUR.furySpeed : MINOTAUR.speed;
      if (toHero.length > MINOTAUR.stopDistance) moveGuardian(fight, minotaur, toHero.unitX * speed * deltaSeconds, toHero.unitY * speed * deltaSeconds);
      minotaur.cooldown -= deltaSeconds;
      minotaur.chargeTimer -= deltaSeconds;
      if (minotaur.chargeTimer <= 0) {
        prepare(minotaur, "charge", inFury ? MINOTAUR.furyChargeWindup : MINOTAUR.chargeWindup);
        minotaur.chargeDirection = [toHero.unitX, toHero.unitY];
        setBossWarning("INVESTIDA! Saia da linha vermelha ou segure o escudo", true);
        Sound.effect("roar");
      } else if (toHero.length < MINOTAUR.smashTriggerDistance && minotaur.cooldown <= 0) {
        prepare(minotaur, "smash", inFury ? MINOTAUR.furySmashWindup : MINOTAUR.smashWindup);
      }
      break;
    }
    case "windup":
      if (minotaur.attackKind === "smash") {
        if (minotaur.timer > 0) break;
        strikeArea(fight, minotaur.x, minotaur.y, MINOTAUR.smashRange, MINOTAUR.smashDamage, MINOTAUR.smashCompanionDamage);
        fight.shakeTime = 0.25;
        Sound.effect("hit");
        recover(minotaur, MINOTAUR.recoverSeconds);
        break;
      }
      // Mira acompanha o herói até pouco antes da investida; depois fica travada.
      if (minotaur.timer > MINOTAUR.chargeAimLockSeconds) minotaur.chargeDirection = [toHero.unitX, toHero.unitY];
      if (Math.random() < deltaSeconds * 30) {
        fight.particles.push({ x: minotaur.x + randomBetween(-5, 5), y: minotaur.y, velocityX: -minotaur.chargeDirection[0] * 30, velocityY: -10, life: 0.35, color: "#b89a70" });
      }
      if (minotaur.timer <= 0) {
        minotaur.state = "charge";
        minotaur.timer = MINOTAUR.chargeMaxSeconds;
        minotaur.chargeHit = false;
      }
      break;
    case "charge":
      updateMinotaurCharge(fight, minotaur, hero, deltaSeconds);
      break;
    case "recover":
    case "stunned":
      if (minotaur.timer > 0) break;
      minotaur.state = "move";
      minotaur.cooldown = 0.8;
      minotaur.chargeTimer = randomBetween(...(inFury ? MINOTAUR.furyChargeInterval : MINOTAUR.chargeInterval));
      if (fight.warningIsDanger) fight.warning = "";
      break;
  }
}

function updateMinotaurCharge(fight, minotaur, hero, deltaSeconds) {
  const step = MINOTAUR.chargeSpeed * deltaSeconds;
  const nextX = minotaur.x + minotaur.chargeDirection[0] * step;
  const nextY = minotaur.y + minotaur.chargeDirection[1] * step;
  const margin = FIGHT.bossKeepAwayFromWall;
  const bounds = fight.bounds;
  const hitsWall = nextX < bounds.left + margin.side || nextX > bounds.right - margin.side
    || nextY < bounds.top + margin.top || nextY > bounds.bottom - margin.bottom;

  if (!minotaur.chargeHit && isHeroWithin(fight, minotaur.x, minotaur.y, MINOTAUR.chargeHitDistance) && hero.invulnerableTime <= 0) {
    minotaur.chargeHit = true;
    if (hero.isShielding) {
      damageHero(MINOTAUR.chargeBlockedDamage, { ignoreShield: true });
      stunMinotaur(fight, "Ele se chocou contra o seu escudo! Ataque agora!");
    } else {
      damageHero(MINOTAUR.chargeDamage);
      hero.knockbackX = minotaur.chargeDirection[0] * MINOTAUR.chargeKnockback;
      hero.knockbackY = minotaur.chargeDirection[1] * MINOTAUR.chargeKnockback;
      recover(minotaur, 0.8);
      fight.warning = "";
    }
    return;
  }
  if (isCompanionWithin(fight, minotaur.x, minotaur.y, 13)) damageCompanion(MINOTAUR.chargeCompanionDamage);
  if (Math.random() < deltaSeconds * 40) {
    fight.particles.push({ x: minotaur.x, y: minotaur.y, velocityX: -minotaur.chargeDirection[0] * 40, velocityY: -8, life: 0.3, color: "#b89a70" });
  }

  if (hitsWall) stunMinotaur(fight, "Ele bateu na parede e está tonto! Ataque agora!");
  else if (minotaur.timer <= 0) {
    recover(minotaur, MINOTAUR.recoverSeconds);
    fight.warning = "";
  } else {
    minotaur.x = nextX;
    minotaur.y = nextY;
  }
}

function stunMinotaur(fight, message) {
  const minotaur = fight.body;
  minotaur.state = "stunned";
  minotaur.timer = MINOTAUR.wallStunSeconds;
  damageGuardianDirectly(fight, MINOTAUR.wallSelfDamage, minotaur.x, minotaur.y - 34);
  fight.shakeTime = 0.4;
  Sound.effect("rumble");
  setBossWarning(message, false, MINOTAUR.wallStunSeconds);
}

const BOSS_BEHAVIOURS = {
  scorp: updateScorpions,
  medusa: updateMedusa,
  hydra: updateHydra,
  mino: updateMinotaur,
};

/** Começa a preparação de um golpe. */
function prepare(creature, attackKind, windupSeconds) {
  creature.state = "windup";
  creature.attackKind = attackKind;
  creature.timer = windupSeconds;
}

function recover(creature, seconds) {
  creature.state = "recover";
  creature.timer = seconds;
}

/* ------------------------------------------------------------------ */
/* Avisos e efeitos visuais                                            */
/* ------------------------------------------------------------------ */

/**
 * Mostra um aviso abaixo da barra do guardião.
 * @param {string} text
 * @param {boolean} isDanger destaca em vermelho piscante (golpe forte a caminho)
 * @param {number} [seconds] some sozinho depois desse tempo; 0 = até ser trocado
 */
function setBossWarning(text, isDanger, seconds = 0) {
  const fight = game.fight;
  fight.warning = text;
  fight.warningIsDanger = isDanger;
  fight.warningTime = seconds;
}

function addFloatingText(x, y, text, color) {
  if (game.fight) game.fight.floatingTexts.push({ x, y, text, color, life: 0.9 });
}

function spawnParticles(x, y, color, count) {
  if (!game.fight) return;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(20, 70);
    game.fight.particles.push({ x, y, velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed - 20, life: randomBetween(0.4, 0.7), color });
  }
}

function updateVisualEffects(fight, deltaSeconds) {
  const GRAVITY = 90;
  const TEXT_RISE_SPEED = 18;
  for (const particle of fight.particles) {
    particle.life -= deltaSeconds;
    particle.x += particle.velocityX * deltaSeconds;
    particle.y += particle.velocityY * deltaSeconds;
    particle.velocityY += GRAVITY * deltaSeconds;
  }
  fight.particles = fight.particles.filter((particle) => particle.life > 0);
  for (const label of fight.floatingTexts) {
    label.life -= deltaSeconds;
    label.y -= TEXT_RISE_SPEED * deltaSeconds;
  }
  fight.floatingTexts = fight.floatingTexts.filter((label) => label.life > 0);
  if (fight.beam) {
    fight.beam.timeLeft -= deltaSeconds;
    if (fight.beam.timeLeft <= 0) fight.beam = null;
  }
}
