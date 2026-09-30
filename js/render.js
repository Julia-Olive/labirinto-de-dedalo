/**
 * @file Desenho de cada quadro: mapa, personagens, guardiões, efeitos,
 * névoa e minimapa.
 *
 * A ordem é: mapa pré-desenhado → objetos do chão → avisos no chão →
 * personagens (ordenados pela altura dos pés, para que quem está mais abaixo
 * fique na frente) → projéteis e efeitos → névoa → textos por cima.
 */
"use strict";

const canvas = $("#game-canvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const minimapCanvas = $("#minimap");
const minimapCtx = minimapCanvas.getContext("2d");
const MINIMAP_PIXELS_PER_TILE = 3;

/** Câmera em pixels do mundo; segue o herói (ou a arena) suavemente. */
const camera = { x: 0, y: 0 };
const CAMERA_FOLLOW_SPEED = 6;
const CAMERA_SNAP_DISTANCE = 200;
const CAMERA_MARGIN = { side: 10, top: 34, bottom: 26 };

/** Pede que a câmera pule direto para o alvo no próximo quadro. */
function snapCamera() {
  camera.x = Number.POSITIVE_INFINITY;
}

/* ------------------------------------------------------------------ */
/* Primitivas                                                          */
/* ------------------------------------------------------------------ */

function fillPixelRect(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), width, height);
}

function drawSprite(sprite, x, y) {
  ctx.drawImage(sprite, Math.round(x), Math.round(y));
}

/** Texto com contorno escuro, legível sobre qualquer fundo. */
function drawOutlinedText(text, x, y, color, size = 8) {
  ctx.font = `700 ${size}px "Pixelify Sans", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1a0e06";
  ctx.strokeText(text, Math.round(x), Math.round(y));
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

function drawShadow(x, y, width) {
  ctx.fillStyle = "#0004";
  ctx.fillRect(Math.round(x - width / 2), Math.round(y - 1), width, 2);
}

/** Espelha o desenho em volta do eixo vertical que passa por x. Fechar com ctx.restore(). */
function beginMirror(x) {
  ctx.save();
  ctx.translate(Math.round(x) * 2, 0);
  ctx.scale(-1, 1);
}

/** Pisca em branco quando a criatura acabou de ser atingida. */
function flashColor(creature) {
  return (color) => (creature.flash > 0 ? "#fff" : color);
}

/* ------------------------------------------------------------------ */
/* Quadro principal                                                    */
/* ------------------------------------------------------------------ */

function renderFrame(deltaSeconds) {
  const level = game.level;
  const isShowingWorld = level && (game.mode === Mode.EXPLORE || game.mode === Mode.FIGHT || game.mode === Mode.STORY);
  if (!isShowingWorld) return;

  ctx.fillStyle = level.theme.shadow;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const view = updateCamera(level, deltaSeconds);

  ctx.save();
  ctx.translate(-view.x, -view.y);
  ctx.drawImage(level.canvas, 0, 0);
  drawSpikes(level);
  drawWallTorches(level);
  if (game.fight) drawGates(game.fight);
  else drawTrail(level);
  drawItems(level);
  drawStairsAndExit(level);
  if (game.fight) drawAttackWarnings(game.fight);
  drawCharacters(level);
  if (game.fight) drawFightEffects(game.fight);
  else drawArenaLabel(level);
  ctx.restore();

  drawFog(level, view);
  drawDust(level);
  if (game.fight) drawFightOverlays(game.fight);
  drawMinimap(level);
}

function updateCamera(level, deltaSeconds) {
  const worldWidth = level.width * TILE_SIZE;
  const worldHeight = level.height * TILE_SIZE;
  let targetX;
  let targetY;
  if (game.fight) {
    targetX = game.fight.bounds.centerX - VIEW_WIDTH / 2;
    targetY = game.fight.bounds.centerY - VIEW_HEIGHT / 2 + 4;
  } else {
    // A margem extra deixa espaço para o HUD não cobrir o herói nas bordas do mapa.
    targetX = worldWidth <= VIEW_WIDTH
      ? (worldWidth - VIEW_WIDTH) / 2
      : clamp(player.pixelX + TILE_SIZE / 2 - VIEW_WIDTH / 2, -CAMERA_MARGIN.side, worldWidth - VIEW_WIDTH + CAMERA_MARGIN.side);
    targetY = worldHeight <= VIEW_HEIGHT
      ? (worldHeight - VIEW_HEIGHT) / 2
      : clamp(player.pixelY + TILE_SIZE / 2 - VIEW_HEIGHT / 2, -CAMERA_MARGIN.top, worldHeight - VIEW_HEIGHT + CAMERA_MARGIN.bottom);
  }

  const follow = Math.min(1, deltaSeconds * CAMERA_FOLLOW_SPEED);
  camera.x += (targetX - camera.x) * follow;
  camera.y += (targetY - camera.y) * follow;
  const isFar = !Number.isFinite(camera.x) || Math.abs(targetX - camera.x) > CAMERA_SNAP_DISTANCE || Math.abs(targetY - camera.y) > CAMERA_SNAP_DISTANCE;
  if (isFar) {
    camera.x = targetX;
    camera.y = targetY;
  }

  let x = camera.x;
  let y = camera.y;
  const isShaking = (game.fight && game.fight.shakeTime > 0) || level.rumbleTimer > 0;
  if (isShaking && !prefersReducedMotion) {
    x += randomBetween(-2, 2);
    y += randomBetween(-2, 2);
  }
  return { x: Math.round(x), y: Math.round(y) };
}

/* ------------------------------------------------------------------ */
/* Objetos do mapa                                                     */
/* ------------------------------------------------------------------ */

function drawSpikes(level) {
  for (const spike of level.spikes) {
    const x = spike.x * TILE_SIZE;
    const y = spike.y * TILE_SIZE;
    fillPixelRect(x + 2, y + 2, 12, 12, "#3a3430");
    fillPixelRect(x + 3, y + 3, 10, 10, "#6a625a");
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        const holeX = x + 4 + col * 3;
        const holeY = y + 4 + row * 3;
        if (isSpikeRaised(spike)) {
          fillPixelRect(holeX, holeY, 2, 2, "#e8ecef");
          fillPixelRect(holeX, holeY - 2, 1, 2, "#e8ecef");
        } else if (isSpikeAboutToRise(spike)) {
          fillPixelRect(holeX, holeY + 1, 2, 1, "#c8ccd0");
        } else {
          fillPixelRect(holeX, holeY, 2, 2, "#2a2420");
        }
      }
    }
    if (isSpikeRaised(spike)) fillPixelRect(x + 2, y + 2, 12, 1, "#b02020");
  }
}

function drawWallTorches(level) {
  for (const torch of level.wallTorches) {
    const x = torch.x * TILE_SIZE + 6;
    const y = torch.y * TILE_SIZE + 8;
    const flicker = (game.time * 8 + torch.x) % 2 < 1 ? 0 : 1;
    fillPixelRect(x + 1, y + 3, 2, 4, "#6b4424");
    fillPixelRect(x, y + flicker, 4, 3, "#ff7a20");
    fillPixelRect(x + 1, y + 1 + flicker, 2, 2, "#ffd040");
  }
}

function drawGates(fight) {
  for (const gate of fight.gates) {
    const x = gate.x * TILE_SIZE;
    const y = gate.y * TILE_SIZE;
    fillPixelRect(x, y + 2, TILE_SIZE, 2, "#3a2412");
    fillPixelRect(x, y + 12, TILE_SIZE, 2, "#3a2412");
    for (let bar = 1; bar < TILE_SIZE; bar += 4) {
      fillPixelRect(x + bar, y, 2, TILE_SIZE, "#c8893a");
      fillPixelRect(x + bar, y, 1, TILE_SIZE, "#f0c47e");
    }
  }
}

/** Fio dourado: liga os blocos por onde o herói passou até a posição atual. */
function drawTrail(level) {
  if (!level.trail.length) return;
  const drawLine = (color, offsetY) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    level.trail.forEach(([x, y], i) => {
      const px = x * TILE_SIZE + 8.5;
      const py = y * TILE_SIZE + offsetY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.lineTo(player.pixelX + 8.5, player.pixelY + offsetY);
    ctx.stroke();
  };
  drawLine("#7a4a1088", 12.5);
  drawLine("#ffcf4a", 11.5);
}

function drawItems(level) {
  const bob = Math.round(Math.sin(game.time * 3));
  for (const item of level.items) {
    if (item.taken) continue;
    const sprite = sprites[item.type];
    fillPixelRect(item.x * TILE_SIZE + 4, item.y * TILE_SIZE + 13, 8, 2, "#0003");
    drawSprite(sprite, item.x * TILE_SIZE + 8 - sprite.width / 2, item.y * TILE_SIZE + 12 - sprite.height + bob);
  }
}

function drawStairsAndExit(level) {
  if (level.boss && level.bossDefeated) {
    const x = level.boss.x * TILE_SIZE;
    const y = level.boss.y * TILE_SIZE;
    for (let step = 0; step < 4; step++) fillPixelRect(x + 1 + step, y + 2 + step * 3, 14 - step * 2, 3, step % 2 ? "#3a2a18" : "#6a5236");
    fillPixelRect(x, y, TILE_SIZE, 1, "#ffd04088");
  }
  if (level.exit) {
    const x = level.exit.x * TILE_SIZE;
    const y = level.exit.y * TILE_SIZE;
    const glow = 0.5 + 0.5 * Math.sin(game.time * 4);
    fillPixelRect(x - 6, y - 8, 28, 26, `rgba(255,208,64,${0.25 + glow * 0.25})`);
    fillPixelRect(x - 1, y - 6, 18, 22, "#7a4a18");
    fillPixelRect(x + 1, y - 4, 14, 20, "#e0a83a");
    fillPixelRect(x + 5, y, 6, 6, "#ffe08a");
    fillPixelRect(x + 7, y + 2, 2, 2, "#fff6c8");
  }
}

/** Nome da arena escrito acima dela quando o herói se aproxima. */
function drawArenaLabel(level) {
  if (!level.lair || level.bossDefeated) return;
  const LABEL_VISIBLE_DISTANCE = 130;
  const bounds = roomPixelBounds(level);
  const closeEnough = distance(player.pixelX + 8, player.pixelY + 8, bounds.centerX, bounds.centerY) < LABEL_VISIBLE_DISTANCE;
  if (!closeEnough) return;
  const boss = BOSSES[level.boss.type];
  drawOutlinedText(`Arena d${boss.article} ${boss.name}`, bounds.centerX, bounds.top - 6, "#ffd0b0");
}

/* ------------------------------------------------------------------ */
/* Personagens                                                         */
/* ------------------------------------------------------------------ */

/** Desenha todos os personagens na ordem certa de profundidade. */
function drawCharacters(level) {
  const drawables = game.fight ? fightDrawables(game.fight) : explorationDrawables(level);
  drawables.sort((a, b) => a.feetY - b.feetY).forEach((item) => item.draw());
}

function explorationDrawables(level) {
  const list = [];
  if (level.lair && !level.bossDefeated) {
    const type = level.boss.type;
    if (type === "scorp") level.lair.parts.forEach((scorpion) => list.push({ feetY: scorpion.y, draw: () => drawScorpion(scorpion) }));
    else list.push({ feetY: level.lair.body.y, draw: () => drawGuardian(type, level.lair.body, level.lair.heads) });
  }
  for (const enemy of level.enemies) list.push({ feetY: enemy.pixelY + 14, draw: () => drawCorridorEnemy(enemy) });
  list.push({
    feetY: companion.pixelY + 13.9,
    draw: () => drawCompanion(companion.pixelX + 8, companion.pixelY + 14, companion.facing, companion.isMoving, companion.walkTime, game.save.companion.hp <= 0),
  });
  list.push({
    feetY: player.pixelY + 14,
    draw: () => {
      const blinking = player.invulnerableTime > 0 && Math.floor(player.invulnerableTime * 12) % 2 === 0;
      if (!blinking) drawHero(player.pixelX + 8, player.pixelY + 14, player.facing, player.isMoving, player.walkTime);
    },
  });
  return list;
}

function fightDrawables(fight) {
  const ally = fight.companion;
  const list = [
    { feetY: fight.hero.y, draw: () => drawHeroInFight(fight) },
    {
      feetY: ally.y,
      draw: () => {
        const blinking = ally.invulnerableTime > 0 && Math.floor(ally.invulnerableTime * 12) % 2 === 0;
        if (!blinking) drawCompanion(ally.x, ally.y, ally.facing < 0 ? "left" : "right", ally.isMoving, ally.walkTime, game.save.companion.hp <= 0);
      },
    },
  ];
  if (fight.scorpions) {
    fight.scorpions.forEach((scorpion) => list.push({ feetY: scorpion.y, draw: () => drawScorpion(scorpion) }));
  } else {
    list.push({ feetY: fight.body.y, draw: () => drawGuardianInFight(fight) });
  }
  return list;
}

function drawHero(x, y, facing, isMoving, walkTime, opacity = 1) {
  const frames = sprites.hero[game.save.hero.gender][facing];
  const frame = isMoving && Math.floor(walkTime * 8) % 2 ? 1 : 0;
  drawShadow(x, y, 10);
  ctx.globalAlpha = opacity;
  drawSprite(frames[frame], x - 8, y - 20 - frame);
  ctx.globalAlpha = 1;
}

function drawCompanion(x, y, facing, isMoving, walkTime, isDown) {
  const frames = sprites.companion[facing];
  drawShadow(x, y, 8);
  if (isDown) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y - 3));
    ctx.rotate(Math.PI / 2);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(frames[0], -6, -8);
    ctx.restore();
    return;
  }
  const frame = isMoving && Math.floor(walkTime * 8) % 2 ? 1 : 0;
  drawSprite(frames[frame], x - 6, y - 17 - frame);
}

function drawCorridorEnemy(enemy) {
  const sprite = sprites[enemy.type];
  const flap = Math.sin(game.time * 10 + enemy.x) > 0 ? -1 : 1;
  fillPixelRect(enemy.pixelX + 3, enemy.pixelY + 13, 10, 2, "#0004");
  const y = enemy.type === "bat" ? enemy.pixelY + 2 + flap : enemy.pixelY + 14 - sprite.height;
  drawSprite(sprite, enemy.pixelX + 8 - sprite.width / 2, y);
}

/** Herói na luta: sprite, lança, golpe giratório, escudo e veneno. */
function drawHeroInFight(fight) {
  const hero = fight.hero;
  const blinking = hero.invulnerableTime > 0 && Math.floor(hero.invulnerableTime * 12) % 2 === 0;
  if (blinking && !fight.ending) return;

  if (hero.petrifiedTime > 0) ctx.filter = "grayscale(1) brightness(1.15)";
  const fading = fight.ending && fight.ending.result === "defeat";
  drawHero(hero.x, hero.y, hero.facingX < 0 ? "left" : "right", hero.isMoving, hero.walkTime, fading ? 0.5 : 1);
  ctx.filter = "none";

  const handX = hero.x;
  const handY = hero.y - 9;
  if (hero.attackAnimation > 0) {
    const progress = 1 - hero.attackAnimation / HERO_COMBAT.attackAnimationSeconds;
    const reach = 6 + 14 * Math.sin(progress * Math.PI);
    ctx.strokeStyle = "#6b4424";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(handX + hero.facingX * reach, handY + hero.facingY * reach);
    ctx.stroke();
    fillPixelRect(handX + hero.facingX * reach - 1.5, handY + hero.facingY * reach - 1.5, 3, 3, "#eef2f5");
  }
  if (hero.specialAnimation > 0) {
    const remaining = hero.specialAnimation / HERO_COMBAT.specialSeconds;
    ctx.strokeStyle = `rgba(255,230,140,${remaining})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handX, handY, 14 + (1 - remaining) * 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (hero.isShielding) {
    const shieldX = handX + hero.facingX * 7;
    const shieldY = handY + hero.facingY * 5 + 2;
    ctx.fillStyle = "#7a4a18";
    ctx.beginPath();
    ctx.arc(shieldX, shieldY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c8893a";
    ctx.beginPath();
    ctx.arc(shieldX, shieldY, 5, 0, Math.PI * 2);
    ctx.fill();
    fillPixelRect(shieldX - 1, shieldY - 1, 3, 2, "#f6f1e4");
  }
  if (hero.poisonTime > 0 && Math.random() < 0.2) {
    fight.particles.push({ x: hero.x + randomBetween(-4, 4), y: hero.y - 14, velocityX: 0, velocityY: -15, life: 0.4, color: "#8ad040" });
  }
}

/** Guardião na luta, sumindo aos poucos quando derrotado. */
function drawGuardianInFight(fight) {
  const defeated = fight.ending && fight.ending.result === "victory";
  if (defeated) {
    ctx.globalAlpha = clamp(fight.ending.timeLeft / FIGHT.victorySeconds, 0, 1);
    if (Math.floor(fight.ending.timeLeft * 14) % 2) fight.body.flash = 0.05;
  }
  drawGuardian(fight.type, fight.body, fight.heads);
  ctx.globalAlpha = 1;
}

function drawGuardian(type, body, heads) {
  if (type === "hydra") drawHydra(body, heads);
  else if (type === "mino") drawMinotaur(body);
  else drawMedusa(body);
}

function drawDizzyStars(x, y, radius) {
  for (let i = 0; i < 3; i++) {
    const angle = game.time * 5 + i * 2.1;
    fillPixelRect(x + Math.cos(angle) * radius - 1, y + Math.sin(angle) * 3, 2, 2, "#ffe060");
  }
}

function drawMinotaur(minotaur) {
  const color = flashColor(minotaur);
  const x = Math.round(minotaur.x) - 12;
  const y = Math.round(minotaur.y) - 30;
  const isCharging = minotaur.attackKind === "charge" && (minotaur.state === "windup" || minotaur.state === "charge");
  const headDrop = isCharging ? 3 : 0;
  const isStunned = minotaur.state === "stunned";
  const isRaisingClub = minotaur.state === "windup" && minotaur.attackKind === "smash";

  fillPixelRect(x + 2, y + 29, 20, 3, "#0005");
  if (minotaur.facing > 0) beginMirror(minotaur.x);
  fillPixelRect(x + 6, y + 22, 5, 8, color("#5a3018"));
  fillPixelRect(x + 13, y + 22, 5, 8, color("#5a3018"));
  fillPixelRect(x + 5, y + 28, 6, 2, color("#1c120a"));
  fillPixelRect(x + 13, y + 28, 6, 2, color("#1c120a"));
  fillPixelRect(x + 5, y + 19, 14, 5, color("#7a1a14"));
  fillPixelRect(x + 5, y + 19, 14, 1, color("#c8893a"));
  fillPixelRect(x + 3, y + 9 + headDrop, 18, 11 - headDrop, color("#7a4222"));
  fillPixelRect(x + 6, y + 11 + headDrop, 12, 5, color("#8e5230"));
  fillPixelRect(x, y + 10 + headDrop, 4, 9, color("#6a3a1c"));
  fillPixelRect(x + 20, y + 10 + headDrop, 4, 9, color("#6a3a1c"));

  const headY = y + 2 + headDrop * 2;
  fillPixelRect(x + 7, headY, 10, 9, color("#5e3218"));
  fillPixelRect(x + 8, headY + 6, 8, 4, color("#b07a52"));
  fillPixelRect(x + 9, headY + 8, 1, 1, "#1c120a");
  fillPixelRect(x + 14, headY + 8, 1, 1, "#1c120a");
  const eyeColor = isStunned ? "#9a9a9a" : minotaur.state === "move" || minotaur.state === "idle" ? "#ffd040" : "#ff3a20";
  fillPixelRect(x + 8, headY + 3, 2, 1, eyeColor);
  fillPixelRect(x + 14, headY + 3, 2, 1, eyeColor);
  fillPixelRect(x + 3, headY, 4, 2, color("#efe6cf"));
  fillPixelRect(x + 2, headY - 3, 2, 3, color("#efe6cf"));
  fillPixelRect(x + 17, headY, 4, 2, color("#efe6cf"));
  fillPixelRect(x + 20, headY - 3, 2, 3, color("#efe6cf"));
  if (isRaisingClub) {
    fillPixelRect(x - 2, y - 6, 3, 16, color("#6b4424"));
    fillPixelRect(x - 4, y - 10, 7, 6, color("#4a2e14"));
  } else {
    fillPixelRect(x - 1, y + 14, 3, 12, color("#6b4424"));
    fillPixelRect(x - 2, y + 24, 5, 6, color("#4a2e14"));
  }
  if (minotaur.facing > 0) ctx.restore();
  if (isStunned) drawDizzyStars(minotaur.x, y - 5, 9);
}

function drawMedusa(medusa) {
  const color = flashColor(medusa);
  const x = Math.round(medusa.x) - 10;
  const y = Math.round(medusa.y) - 28;
  const isGazing = medusa.state === "windup" && medusa.attackKind === "gaze";
  const isAiming = medusa.state === "windup" && medusa.attackKind === "arrows";

  fillPixelRect(x + 1, y + 27, 22, 3, "#0005");
  if (isGazing) {
    ctx.fillStyle = `rgba(150,255,150,${0.3 + 0.2 * Math.sin(game.time * 20)})`;
    ctx.beginPath();
    ctx.arc(medusa.x, y + 7, 11 + Math.sin(game.time * 10) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (medusa.facing > 0) beginMirror(medusa.x);
  // Cauda de serpente
  fillPixelRect(x + 2, y + 21, 16, 5, color("#3e6a2a"));
  fillPixelRect(x + 5, y + 25, 14, 3, color("#4e8a34"));
  fillPixelRect(x + 17, y + 23, 6, 3, color("#3e6a2a"));
  fillPixelRect(x + 22, y + 24 + Math.round(Math.sin(game.time * 4)), 3, 2, color("#3e6a2a"));
  for (const scaleX of [6, 10, 14]) fillPixelRect(x + scaleX, y + 22 + (scaleX === 10 ? 1 : 0), 1, 1, "#7ab85a");
  // Tronco e braços
  fillPixelRect(x + 6, y + 11, 8, 11, color("#86b46a"));
  fillPixelRect(x + 6, y + 13, 8, 3, color("#c8893a"));
  fillPixelRect(x + 6, y + 19, 8, 2, color("#6a1414"));
  fillPixelRect(x + 3, y + 12, 3, 7, color("#86b46a"));
  fillPixelRect(x + 14, y + 12, 3, 7, color("#86b46a"));
  if (isAiming) {
    fillPixelRect(x - 1, y + 5, 1, 16, "#6b4424");
    fillPixelRect(x, y + 5, 1, 16, "#e8e0c8");
  }
  // Rosto
  fillPixelRect(x + 6, y + 3, 8, 8, color("#9ac87a"));
  const eyeColor = isGazing ? "#ffffff" : medusa.state === "stunned" ? "#8a8a8a" : "#ffd040";
  fillPixelRect(x + 7, y + 6, 2, 1, eyeColor);
  fillPixelRect(x + 11, y + 6, 2, 1, eyeColor);
  fillPixelRect(x + 9, y + 9, 2, 1, "#3a5a2a");
  // Cabelo de serpentes
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI + (i / 6) * Math.PI;
    const wiggle = Math.sin(game.time * 6 + i) * 1.5;
    const snakeX = x + 10 + Math.cos(angle) * 6;
    const snakeY = y + 6 + Math.sin(angle) * 6;
    fillPixelRect(snakeX - 1, snakeY - 2 + wiggle, 2, 3, color("#3e6a2a"));
    fillPixelRect(snakeX - 1 + Math.cos(angle) * 2, snakeY - 3 + wiggle + Math.sin(angle) * 2, 2, 2, color("#5a9a3a"));
  }
  if (medusa.facing > 0) ctx.restore();
  if (medusa.state === "stunned") drawDizzyStars(medusa.x, y - 3, 8);
}

function drawScorpion(scorpion) {
  if (!scorpion.alive) return;
  const color = flashColor(scorpion);
  const x = Math.round(scorpion.x) - 11;
  const y = Math.round(scorpion.y) - 12;
  const isPreparing = scorpion.state === "windup";
  const clawLift = isPreparing ? -2 : 0;

  fillPixelRect(x + 3, y + 12, 18, 2, "#0005");
  if (scorpion.facing > 0) beginMirror(scorpion.x);
  for (let leg = 0; leg < 3; leg++) {
    const step = scorpion.state === "move" && Math.sin(game.time * 16 + leg) > 0 ? 1 : 0;
    fillPixelRect(x + 7 + leg * 3, y + 11 + step, 1, 3, color("#4a200e"));
  }
  fillPixelRect(x + 6, y + 5, 11, 7, color("#7a3a1a"));
  fillPixelRect(x + 8, y + 5, 7, 2, color("#a0522a"));
  fillPixelRect(x + 6, y + 11, 11, 1, color("#4a200e"));
  fillPixelRect(x + 16, y + 4, 3, 4, color("#7a3a1a"));
  fillPixelRect(x + 17, y, 3, 5, color("#7a3a1a"));
  fillPixelRect(x + 14, y - 2, 5, 3, color("#7a3a1a"));
  const stingerLift = isPreparing && scorpion.attackKind === "sting" ? 2 : 0;
  fillPixelRect(x + 13, y - 1 - stingerLift, 2, 3, "#e0c040");
  fillPixelRect(x + 1, y + 5 + clawLift, 6, 3, color("#8a4220"));
  fillPixelRect(x + 1, y + 9 + clawLift, 6, 3, color("#8a4220"));
  fillPixelRect(x - 1, y + 4 + clawLift, 3, 2, color("#a0522a"));
  fillPixelRect(x - 1, y + 10 + clawLift, 3, 2, color("#a0522a"));
  fillPixelRect(x + 6, y + 6, 1, 1, isPreparing ? "#ff3a20" : "#ffd040");
  if (scorpion.facing > 0) ctx.restore();
}

function drawHydra(body, heads) {
  const color = flashColor(body);
  const x = Math.round(body.x);
  const y = Math.round(body.y);
  const headCount = heads.length;

  fillPixelRect(x - 24, y - 3, 48, 7, "#2e5a5a99");
  fillPixelRect(x - 14, y - 14, 28, 13, color("#2e6a5a"));
  fillPixelRect(x - 12, y - 16, 24, 3, color("#2e6a5a"));
  fillPixelRect(x - 10, y - 9, 20, 6, color("#6aa88a"));
  fillPixelRect(x - 14, y - 2, 6, 3, color("#24544a"));
  fillPixelRect(x + 8, y - 2, 6, 3, color("#24544a"));

  // Pescoços em arco, do corpo até cada cabeça.
  const NECK_SEGMENTS = 10;
  heads.forEach((head, i) => {
    const baseX = x + (i - (headCount - 1) / 2) * 5;
    const baseY = y - 15;
    for (let s = 0; s <= NECK_SEGMENTS; s++) {
      const t = s / NECK_SEGMENTS;
      const px = baseX + (head.x - baseX) * t;
      const py = baseY + (head.y - baseY) * t - Math.sin(t * Math.PI) * 6;
      fillPixelRect(px - 2, py - 2, 4, 4, color(s % 2 ? "#2e6a5a" : "#347a66"));
    }
  });
  for (const head of heads) {
    fillPixelRect(head.x - 4, head.y - 3, 8, 6, color("#3e8a6a"));
    fillPixelRect(head.x - 5, head.y - 1, 2, 3, color("#3e8a6a"));
    fillPixelRect(head.x - 2, head.y - 2, 2, 1, head.state === "windup" ? "#ff3a20" : "#ffd040");
    if (head.state === "strike") {
      fillPixelRect(head.x - 3, head.y + 2, 6, 2, "#8a1a1a");
      fillPixelRect(head.x - 3, head.y + 2, 1, 1, "#fff");
    }
  }
}

/* ------------------------------------------------------------------ */
/* Avisos no chão e efeitos da luta                                    */
/* ------------------------------------------------------------------ */

/** Círculos e faixas vermelhas que mostram onde o próximo golpe vai cair. */
function drawAttackWarnings(fight) {
  const pulse = 0.35 + 0.25 * Math.sin(game.time * 18);
  const warningCircle = (x, y, radius) => {
    ctx.fillStyle = `rgba(230,40,20,${pulse * 0.55})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,90,50,${pulse + 0.3})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  const isPreparing = (creature, kind) => creature.state === "windup" && creature.attackKind === kind;

  if (fight.scorpions) {
    for (const scorpion of fight.scorpions) {
      if (scorpion.alive && isPreparing(scorpion, "claw")) warningCircle(scorpion.x, scorpion.y, SCORPION.clawRange);
    }
    return;
  }
  if (fight.type === "medusa" && isPreparing(fight.body, "lash")) warningCircle(fight.body.x, fight.body.y, MEDUSA.lashRange);
  if (fight.type === "hydra") {
    for (const head of fight.heads) if (head.state === "windup") warningCircle(head.targetX, head.targetY + 4, HYDRA.biteRadius);
  }
  if (fight.type === "mino") {
    const minotaur = fight.body;
    if (isPreparing(minotaur, "smash")) warningCircle(minotaur.x, minotaur.y, MINOTAUR.smashRange);
    if (isPreparing(minotaur, "charge")) {
      const LANE_LENGTH = 300;
      const LANE_HALF_WIDTH = 8;
      ctx.save();
      ctx.translate(minotaur.x, minotaur.y - 4);
      ctx.rotate(Math.atan2(minotaur.chargeDirection[1], minotaur.chargeDirection[0]));
      ctx.fillStyle = `rgba(230,40,20,${pulse * 0.5})`;
      ctx.fillRect(0, -LANE_HALF_WIDTH, LANE_LENGTH, LANE_HALF_WIDTH * 2);
      ctx.strokeStyle = `rgba(255,90,50,${pulse + 0.3})`;
      ctx.strokeRect(0, -LANE_HALF_WIDTH, LANE_LENGTH, LANE_HALF_WIDTH * 2);
      ctx.restore();
    }
  }
}

function drawFightEffects(fight) {
  for (const shot of fight.projectiles) drawProjectile(shot);
  for (const particle of fight.particles) fillPixelRect(particle.x, particle.y, 2, 2, particle.color);
  if (fight.beam) {
    ctx.strokeStyle = fight.beam.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = clamp(fight.beam.timeLeft / 0.45, 0, 1);
    ctx.beginPath();
    ctx.moveTo(fight.beam.fromX, fight.beam.fromY);
    ctx.lineTo(fight.beam.toX, fight.beam.toY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const label of fight.floatingTexts) {
    ctx.globalAlpha = clamp(label.life / 0.4, 0, 1);
    drawOutlinedText(label.text, label.x, label.y, label.color);
    ctx.globalAlpha = 1;
  }
}

function drawProjectile(shot) {
  switch (shot.kind) {
    case "stone":
      fillPixelRect(shot.x - 1, shot.y - 1, 2, 2, "#d8d0c0");
      break;
    case "poison":
      fillPixelRect(shot.x - 2, shot.y - 2, 4, 4, "#6ad040");
      fillPixelRect(shot.x - 1, shot.y - 1, 2, 2, "#c8ff80");
      break;
    case "fire":
      fillPixelRect(shot.x - 2, shot.y - 2, 4, 4, "#ff7a20");
      fillPixelRect(shot.x - 1, shot.y - 1, 2, 2, "#ffe060");
      break;
    default: {
      const TAIL = 0.04;
      ctx.strokeStyle = "#e8e0c8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.x - shot.velocityX * TAIL, shot.y - shot.velocityY * TAIL);
      ctx.stroke();
    }
  }
}

/** Efeitos que cobrem a tela: olhar da Medusa, petrificação, apresentação e vitória. */
function drawFightOverlays(fight) {
  const isGazing = fight.type === "medusa" && fight.body.state === "windup" && fight.body.attackKind === "gaze";
  if (isGazing) {
    ctx.fillStyle = `rgba(60,200,80,${0.1 + 0.08 * Math.sin(game.time * 16)})`;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
  if (fight.hero.petrifiedTime > 0) {
    ctx.fillStyle = "rgba(160,160,160,.18)";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    drawOutlinedText("PETRIFICADO", VIEW_WIDTH / 2, VIEW_HEIGHT - 38, "#e0e0e0", 10);
  }
  if (fight.introTime > 0) {
    ctx.globalAlpha = clamp(fight.introTime / 0.4, 0, 1);
    ctx.fillStyle = "#140e08c0";
    ctx.fillRect(0, VIEW_HEIGHT / 2 - 16, VIEW_WIDTH, 32);
    drawOutlinedText(fight.boss.name.toUpperCase(), VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 3, "#ff9a7a", 16);
    drawOutlinedText("Proteja-se e ataque!", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 10, "#f3e2bd");
    ctx.globalAlpha = 1;
  }
  if (fight.ending && fight.ending.result === "victory") drawOutlinedText("VITÓRIA!", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 30, "#ffe08a", 16);
}

/* ------------------------------------------------------------------ */
/* Névoa, poeira e minimapa                                            */
/* ------------------------------------------------------------------ */

/**
 * Escurece o que o herói não vê: preto onde nunca esteve, penumbra onde já
 * passou e clareira em volta dele. Na luta, a arena fica toda iluminada.
 */
function drawFog(level, view) {
  const FOG_COLOR = "10,6,3";
  const REMEMBERED_DARKNESS = 0.7;
  const FIGHT_OUTSIDE_DARKNESS = 0.6;
  const EDGE_DARKNESS = 0.55;
  const radius = (level.definition.escapeSeconds ? EXPLORATION.escapeVisionRadius : EXPLORATION.visionRadius) + 0.2;
  const centerX = game.fight ? game.fight.hero.x : player.pixelX + 8;
  const centerY = game.fight ? game.fight.hero.y - 6 : player.pixelY + 8;
  const firstX = Math.floor(view.x / TILE_SIZE);
  const firstY = Math.floor(view.y / TILE_SIZE);

  for (let y = firstY; y <= firstY + Math.ceil(VIEW_HEIGHT / TILE_SIZE) + 1; y++) {
    for (let x = firstX; x <= firstX + Math.ceil(VIEW_WIDTH / TILE_SIZE) + 1; x++) {
      if (game.fight && isNearRoom(level, x, y)) continue;
      const inside = x >= 0 && y >= 0 && x < level.width && y < level.height;
      const wasExplored = inside && level.explored[tileIndex(level, x, y)];
      const tilesAway = distance(x * TILE_SIZE + 8, y * TILE_SIZE + 8, centerX, centerY) / TILE_SIZE;
      let darkness;
      if (!wasExplored) darkness = 1;
      else if (game.fight) darkness = FIGHT_OUTSIDE_DARKNESS;
      else if (tilesAway < radius) darkness = clamp((tilesAway - (radius - 2)) / 2, 0, 1) * EDGE_DARKNESS;
      else darkness = REMEMBERED_DARKNESS;
      if (darkness <= 0) continue;
      ctx.fillStyle = `rgba(${FOG_COLOR},${darkness})`;
      ctx.fillRect(x * TILE_SIZE - view.x, y * TILE_SIZE - view.y, TILE_SIZE, TILE_SIZE);
    }
  }
}

function drawDust(level) {
  if (!level.dust.length) return;
  ctx.fillStyle = "#d8c49a";
  for (const speck of level.dust) ctx.fillRect(Math.floor(speck.x), Math.floor(speck.y), 1, 2);
}

const MINIMAP_COLORS = {
  [Tile.WALL]: "#5a3e22",
  [Tile.WATER]: "#4a8a8a",
  [Tile.STATUE]: "#8a8474",
  [Tile.GATE]: "#c8893a",
  [Tile.FLOOR]: "#e2cc98",
};

function drawMinimap(level) {
  const scale = MINIMAP_PIXELS_PER_TILE;
  if (minimapCanvas.width !== level.width * scale) {
    minimapCanvas.width = level.width * scale;
    minimapCanvas.height = level.height * scale;
  }
  minimapCtx.fillStyle = "#1a120a";
  minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (!level.explored[tileIndex(level, x, y)]) continue;
      minimapCtx.fillStyle = MINIMAP_COLORS[tileAt(x, y, level)];
      minimapCtx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  const blinkOn = Math.sin(game.time * 6) > 0;
  if (level.boss && !level.bossDefeated) {
    const room = level.room;
    minimapCtx.strokeStyle = blinkOn ? "#ff4a2a" : "#b02010";
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(room.x0 * scale, room.y0 * scale, (room.x1 - room.x0 + 1) * scale, (room.y1 - room.y0 + 1) * scale);
  }
  if (level.boss && level.bossDefeated) {
    minimapCtx.fillStyle = "#ffd040";
    minimapCtx.fillRect(level.boss.x * scale - 1, level.boss.y * scale - 1, scale + 2, scale + 2);
  }
  if (level.exit) {
    minimapCtx.fillStyle = blinkOn ? "#ffe08a" : "#e0a83a";
    minimapCtx.fillRect(level.exit.x * scale - 2, level.exit.y * scale - 2, scale + 4, scale + 4);
  }

  const heroTileX = Math.floor(game.fight ? game.fight.hero.x / TILE_SIZE : player.pixelX / TILE_SIZE + 0.5);
  const heroTileY = Math.floor(game.fight ? (game.fight.hero.y - 4) / TILE_SIZE : player.pixelY / TILE_SIZE + 0.5);
  minimapCtx.fillStyle = "#fff";
  minimapCtx.fillRect(heroTileX * scale - 1, heroTileY * scale - 1, scale + 2, scale + 2);
  minimapCtx.fillStyle = "#2a6aff";
  minimapCtx.fillRect(heroTileX * scale, heroTileY * scale, scale, scale);
}
