/**
 * @file HUD: barras de vida, itens, objetivo, cronômetro e avisos rápidos.
 */
"use strict";

const TOAST_DURATION_MS = 2500;
const MAX_VISIBLE_TOASTS = 3;
const URGENT_TIMER_SECONDS = 30;

/** Atualiza todo o HUD a partir do estado atual. */
function updateHud() {
  const save = game.save;
  if (!save) return;
  const { hero, companion, items } = save;
  const isFighting = Boolean(game.fight);

  $("#hud-name").textContent = `${hero.name} · Nv ${hero.level}`;
  setBar("#hud-hp-fill", "#hud-hp-text", hero.hp, hero.maxHp, `HP ${hero.hp}/${hero.maxHp}`);
  setBar("#hud-companion-fill", "#hud-companion-text", companion.hp, companion.maxHp,
    companion.hp > 0 ? `${companion.hp}/${companion.maxHp}` : "caído");

  $("#hud-seals").innerHTML = [0, 1, 2, 3]
    .map((i) => `<i class="seal${i < save.seals ? " is-owned" : ""}"></i>`)
    .join("");
  $("#hud-ambrosia").textContent = items.ambrosia;
  $("#hud-torches").textContent = items.torches;

  $("#hud-exploration").hidden = isFighting;
  $("#boss-panel").hidden = !isFighting;
  $("#hud-breath").hidden = !isFighting;
  $("#keys-exploration").hidden = isFighting;
  $("#keys-fight").hidden = !isFighting;
  $("#stage").classList.toggle("is-fighting", isFighting);

  if (isFighting) {
    $("#hud-breath-pips").innerHTML = [0, 1, 2]
      .map((i) => `<i class="breath-pip${i < game.fight.breath ? " is-full" : ""}"></i>`)
      .join("");
    $("#boss-name").textContent = game.fight.boss.name;
    updateBossPanel(true);
  } else {
    $("#boss-warning").textContent = "";
    updateExplorationInfo();
  }
}

function setBar(fillSelector, textSelector, value, max, label) {
  $(fillSelector).style.width = `${(100 * Math.max(0, value)) / max}%`;
  $(textSelector).textContent = label;
}

function updateExplorationInfo() {
  const level = game.level;
  if (!level) return;
  $("#hud-level").textContent = `${level.definition.name} · ${level.index + 1} de ${LEVELS.length}`;
  $("#hud-objective").textContent = currentObjective(level);
  updateEscapeTimer();
}

function currentObjective(level) {
  if (level.exit) return "Chegue à Porta do Sol (dourada no mapa) antes do desabamento";
  if (level.bossDefeated) return "Desça pela escada no centro da arena";
  const boss = BOSSES[level.boss.type];
  return `Entre na arena d${boss.article} ${boss.name} (vermelha no mapa). A luta começa ao entrar.`;
}

let lastBossPanelKey = "";

/**
 * Atualiza a barra do chefe e o aviso do próximo golpe.
 * Só mexe no DOM quando algo mudou, porque é chamada a cada quadro.
 */
function updateBossPanel(force = false) {
  const fight = game.fight;
  if (!fight) return;
  const extra = fight.type === "hydra" ? ` · ${fight.heads.length} cabeças` : "";
  const key = `${fight.hp}|${fight.warning}|${fight.warningIsDanger}|${extra}`;
  if (!force && key === lastBossPanelKey) return;
  lastBossPanelKey = key;

  setBar("#boss-hp-fill", "#boss-hp-text", fight.hp, fight.maxHp, `HP ${fight.hp}/${fight.maxHp}${extra}`);
  const warning = $("#boss-warning");
  warning.textContent = fight.warning;
  warning.className = `boss-warning${fight.warningIsDanger ? " is-danger" : ""}`;
}

function updateEscapeTimer() {
  const timer = $("#hud-timer");
  const level = game.level;
  if (!level || !level.definition.escapeSeconds) {
    timer.hidden = true;
    return;
  }
  const seconds = Math.ceil(level.timeLeft);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  timer.hidden = false;
  timer.textContent = Dialogue.isActive ? `${clock} (pausado)` : clock;
  timer.classList.toggle("is-urgent", seconds <= URGENT_TIMER_SECONDS);
}

/**
 * Mostra um aviso rápido no topo da tela.
 * @param {string} message
 * @param {boolean} [isBad] destaca em vermelho (dano, erro)
 */
function showToast(message, isBad = false) {
  const container = $("#toasts");
  const toast = document.createElement("div");
  toast.textContent = message;
  if (isBad) toast.className = "is-bad";
  container.appendChild(toast);
  while (container.children.length > MAX_VISIBLE_TOASTS) container.firstChild.remove();
  setTimeout(() => toast.remove(), TOAST_DURATION_MS);
}

/** Pisca a tela em vermelho quando o herói leva dano. */
function flashDamage() {
  const flash = $("#damage-flash");
  flash.style.opacity = 0.3;
  setTimeout(() => (flash.style.opacity = 0), 110);
}

/** Mostra "Salvo" ao lado do mapa por um instante. */
function showSavedBadge() {
  const badge = $("#saved-badge");
  badge.classList.add("is-visible");
  setTimeout(() => badge.classList.remove("is-visible"), 1500);
}
