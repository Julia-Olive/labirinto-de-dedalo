/**
 * @file Pontos de salvamento.
 *
 * O jogo salva ao entrar em cada anel, ao entrar numa arena e ao vencer um
 * guardião. O labirinto não é guardado bloco a bloco: guarda-se a semente
 * e o que mudou (itens pegos, áreas exploradas, fio, posição).
 */
"use strict";

const SAVE_FORMAT_VERSION = 3;

/**
 * Fotografa o estado atual.
 * @param {{x: number, y: number}} [position] posição a salvar no lugar da atual
 */
function createCheckpoint(position) {
  const level = game.level;
  return deepCopy({
    version: SAVE_FORMAT_VERSION,
    save: game.save,
    level: {
      index: level.index,
      seed: level.seed,
      takenItemIds: level.items.filter((item) => item.taken).map((item) => item.id),
      explored: Array.from(level.explored),
      trail: level.trail,
      playerX: position ? position.x : player.x,
      playerY: position ? position.y : player.y,
      bossDefeated: level.bossDefeated,
      timeLeft: level.timeLeft,
    },
  });
}

/** Salva o estado atual na memória e no navegador. */
function saveCheckpoint(position) {
  game.checkpoint = createCheckpoint(position);
  storage.write(STORAGE_KEYS.save, JSON.stringify(game.checkpoint));
  showSavedBadge();
}

/** Lê o jogo salvo do navegador, ou null se não houver um válido. */
function readStoredCheckpoint() {
  const raw = storage.read(STORAGE_KEYS.save);
  if (!raw) return null;
  try {
    const checkpoint = JSON.parse(raw);
    return checkpoint.version === SAVE_FORMAT_VERSION ? checkpoint : null;
  } catch {
    return null;
  }
}

function hasStoredCheckpoint() {
  return readStoredCheckpoint() !== null;
}

function deleteStoredCheckpoint() {
  storage.remove(STORAGE_KEYS.save);
}

/** Volta o jogo para um ponto salvo. */
function loadCheckpoint(checkpoint) {
  closeAllModals();
  Dialogue.clear();
  game.fight = null;
  game.pauseDepth = 0;
  game.save = deepCopy(checkpoint.save);
  game.checkpoint = deepCopy(checkpoint);

  const saved = checkpoint.level;
  const level = generateLevel(saved.index, saved.seed);
  for (const item of level.items) item.taken = saved.takenItemIds.includes(item.id);
  level.explored = Uint8Array.from(saved.explored);
  level.trail = saved.trail.slice();
  level.bossDefeated = saved.bossDefeated;
  if (level.definition.escapeSeconds) level.timeLeft = saved.timeLeft;
  game.level = level;

  placePlayer(saved.playerX, saved.playerY);
  snapCamera();
  enterExploration();
}
