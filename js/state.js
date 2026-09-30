/**
 * @file Estado compartilhado da partida.
 *
 * - game.save: dados persistentes do herói (vida, itens, selos, diário).
 * - game.level: o anel do labirinto em que o herói está.
 * - game.fight: a luta em andamento, ou null fora da arena.
 * - game.checkpoint: último ponto salvo, usado para tentar de novo.
 */
"use strict";

const game = {
  mode: Mode.LOADING,
  /** Quantas janelas ou falas bloqueantes estão abertas; maior que zero pausa o jogo. */
  pauseDepth: 0,
  /** Tempo de jogo em segundos, usado nas animações. */
  time: 0,
  save: null,
  level: null,
  fight: null,
  checkpoint: null,
};

/**
 * Cria os dados de uma nova partida.
 * @param {"m"|"f"} gender personagem escolhido
 * @param {string} name nome digitado pelo jogador
 * @param {"normal"|"easy"} difficulty
 */
function createSave(gender, name, difficulty) {
  return {
    hero: { gender, name, hp: PROGRESSION.startingHp, maxHp: PROGRESSION.startingHp, level: 1 },
    companion: { hp: PROGRESSION.startingHp, maxHp: PROGRESSION.startingHp },
    items: { ambrosia: PROGRESSION.startingAmbrosia, torches: 0 },
    seals: 0,
    levelIndex: 0,
    difficulty,
    journal: [],
    stats: { steps: 0, seconds: 0, fights: 0 },
  };
}

/** true enquanto o mundo do jogo deve ficar parado. */
function isPaused() {
  const isPlaying = game.mode === Mode.EXPLORE || game.mode === Mode.FIGHT;
  return !isPlaying || game.pauseDepth > 0;
}

/** Aplica o multiplicador de dano da dificuldade escolhida. */
function scaleIncomingDamage(amount) {
  return Math.round(amount * DAMAGE_TAKEN_BY_DIFFICULTY[game.save.difficulty]);
}

/** Registra um trecho da história no diário, sem repetir. */
function addToJournal(entryId) {
  if (game.save && !game.save.journal.includes(entryId)) game.save.journal.push(entryId);
}
