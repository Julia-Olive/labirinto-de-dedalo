/**
 * @file Funções utilitárias sem relação direta com as regras do jogo.
 */
"use strict";

/** Atalho para document.querySelector. */
const $ = (selector) => document.querySelector(selector);

/** Limita um valor ao intervalo [min, max]. */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Inteiro aleatório entre min e max, incluindo os dois. */
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/** Número aleatório entre min e max. */
const randomBetween = (min, max) => min + Math.random() * (max - min);

/** Distância entre dois pontos. */
const distance = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

/** Cópia profunda de dados simples (sem funções nem referências circulares). */
const deepCopy = (value) => JSON.parse(JSON.stringify(value));

/** As quatro direções ortogonais: direita, esquerda, baixo e cima. */
const ORTHOGONAL_DIRECTIONS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);

/** true quando o sistema pede menos animação (acessibilidade). */
const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Acesso ao localStorage que nunca lança erro. Em janelas anônimas ou com
 * armazenamento bloqueado, as leituras devolvem null e as escritas são ignoradas.
 */
const storage = Object.freeze({
  read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* armazenamento indisponível: o jogo continua sem salvar */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* armazenamento indisponível */
    }
  },
});

/**
 * Cria um canvas com suavização desligada, para manter os pixels nítidos.
 * @param {number} width
 * @param {number} height
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
 */
function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/**
 * Gerador pseudoaleatório com semente (algoritmo mulberry32). A mesma semente
 * gera sempre o mesmo labirinto, o que permite recarregar um jogo salvo.
 * @param {number} seed
 * @returns {() => number} função que devolve números entre 0 e 1
 */
function createSeededRandom(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Embaralha uma lista no próprio lugar (Fisher-Yates).
 * @param {Array} list
 * @param {() => number} random
 * @returns {Array} a mesma lista
 */
function shuffleInPlace(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
