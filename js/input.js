/**
 * @file Teclado e controles de toque.
 *
 * Cada tecla é traduzida para uma ação ("attack", "shield", "up"...). A
 * tradução aceita tanto o código físico da tecla (event.code) quanto o
 * caractere digitado (event.key), porque alguns teclados, navegadores e
 * extensões não informam um dos dois.
 */
"use strict";

/** Ações e as teclas que as disparam (códigos físicos). */
const KEY_BINDINGS = Object.freeze({
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  attack: ["Space"],
  shield: ["ShiftLeft", "ShiftRight", "KeyK"],
  special: ["KeyE"],
  torch: ["KeyR"],
  ambrosia: ["KeyQ"],
  journal: ["KeyJ"],
  help: ["KeyH"],
  sound: ["KeyM"],
  pause: ["Escape", "KeyP"],
  confirm: ["Enter", "NumpadEnter"],
  back: ["Backspace"],
});

/** Caractere digitado → código físico, para quando event.code não vem preenchido. */
const KEY_TO_CODE = Object.freeze({
  arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight",
  w: "KeyW", a: "KeyA", s: "KeyS", d: "KeyD", e: "KeyE", k: "KeyK", r: "KeyR", q: "KeyQ",
  j: "KeyJ", h: "KeyH", m: "KeyM", p: "KeyP", " ": "Space", spacebar: "Space",
  shift: "ShiftLeft", escape: "Escape", esc: "Escape", enter: "Enter", backspace: "Backspace",
});

const DIRECTION_VECTORS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });

/** Direções seguradas, da mais antiga para a mais recente. */
const heldDirections = [];
/** Ações que valem enquanto a tecla estiver pressionada (como o escudo). */
const heldActions = new Set();

/** Descobre a ação de um evento de teclado, ou null se a tecla não é usada. */
function actionFromEvent(event) {
  const codes = [event.code, KEY_TO_CODE[(event.key || "").toLowerCase()]].filter(Boolean);
  for (const [action, keys] of Object.entries(KEY_BINDINGS)) {
    if (codes.some((code) => keys.includes(code))) return action;
  }
  return null;
}

/** Direção mais recente ainda segurada (andar nos corredores, bloco a bloco). */
function currentDirection() {
  const latest = heldDirections[heldDirections.length - 1];
  return latest ? DIRECTION_VECTORS[latest] : null;
}

/** Soma de todas as direções seguradas (andar livre na arena, inclusive na diagonal). */
function combinedDirection() {
  let dx = 0;
  let dy = 0;
  for (const direction of heldDirections) {
    dx += DIRECTION_VECTORS[direction][0];
    dy += DIRECTION_VECTORS[direction][1];
  }
  return [clamp(dx, -1, 1), clamp(dy, -1, 1)];
}

function isActionHeld(action) {
  return heldActions.has(action);
}

/** Solta tudo (ao abrir janelas ou trocar de tela), para o herói não seguir andando sozinho. */
function releaseAllInput() {
  heldDirections.length = 0;
  heldActions.clear();
}

function pressDirection(direction) {
  if (!heldDirections.includes(direction)) heldDirections.push(direction);
}

function releaseDirection(direction) {
  const index = heldDirections.indexOf(direction);
  if (index >= 0) heldDirections.splice(index, 1);
}

function isEscapeKey(event) {
  return event.code === "Escape" || event.key === "Escape" || event.key === "Esc";
}

/* ------------------------------------------------------------------ */
/* Teclado                                                             */
/* ------------------------------------------------------------------ */

function onKeyDown(event) {
  Sound.init();
  const action = actionFromEvent(event);
  const isTyping = event.target.tagName === "INPUT" && event.target.type === "text";

  if (modalStack.length) {
    handleModalKey(event, action, isTyping);
    return;
  }
  if (action === "sound" && !isTyping) {
    toggleSound();
    return;
  }

  switch (game.mode) {
    case Mode.TITLE:
      if (action === "help") showHelp();
      return;
    case Mode.SELECT:
      handleSelectKey(event, action, isTyping);
      return;
    case Mode.EXPLORE:
    case Mode.FIGHT:
      handleGameplayKey(event, action);
  }
}

function handleModalKey(event, action, isTyping) {
  const modal = topModal();
  if (modal.onKey && modal.onKey(action)) {
    event.preventDefault();
    return;
  }
  if (isEscapeKey(event) && modal.escapeValue !== undefined) {
    event.preventDefault();
    const skipButton = modal.content.querySelector('[data-story="skip"]');
    if (skipButton) skipButton.click();
    else modal.close(modal.escapeValue);
    return;
  }
  if (action === "sound" && !isTyping) toggleSound();
}

function handleSelectKey(event, action, isTyping) {
  if (isEscapeKey(event)) {
    event.preventDefault();
    showTitleScreen();
    return;
  }
  const isOnBackButton = event.target.id === "button-select-back";
  if (action === "confirm" && !isOnBackButton && event.target.type !== "radio") {
    event.preventDefault();
    confirmHeroSelection();
    return;
  }
  if (!isTyping && (action === "left" || action === "right")) {
    const gender = action === "left" ? "m" : "f";
    selectHeroCard(gender);
    $(`#card-${gender}`).focus();
    Sound.effect("select");
  }
}

function handleGameplayKey(event, action) {
  if (!action) return;
  if (DIRECTION_VECTORS[action]) {
    event.preventDefault();
    pressDirection(action);
    return;
  }
  if (action === "shield") {
    event.preventDefault();
    heldActions.add("shield");
  }
  if (game.pauseDepth) return;

  const isFighting = game.mode === Mode.FIGHT;
  if (action === "confirm" || (action === "attack" && !isFighting)) {
    if (Dialogue.advance()) {
      event.preventDefault();
      return;
    }
  }

  switch (action) {
    case "pause":
      event.preventDefault();
      openPauseMenu();
      break;
    case "ambrosia":
      useAmbrosia();
      break;
    case "help":
      withGamePaused(() => showHelp(isFighting ? "fight" : "controls"));
      break;
    case "journal":
      if (!isFighting) withGamePaused(showJournal);
      break;
    case "attack":
      event.preventDefault();
      if (isFighting) heroAttack();
      break;
    case "special":
      if (isFighting) heroSpecial();
      break;
    case "torch":
      if (isFighting) heroThrowTorch();
      break;
  }
}

function onKeyUp(event) {
  const action = actionFromEvent(event);
  if (DIRECTION_VECTORS[action]) releaseDirection(action);
  if (action === "shield") heldActions.delete("shield");
}

/* ------------------------------------------------------------------ */
/* Toque                                                               */
/* ------------------------------------------------------------------ */

const TOUCH_ACTIONS = {
  attack: () => heroAttack(),
  special: () => heroSpecial(),
  torch: () => heroThrowTorch(),
  ambrosia: () => useAmbrosia(),
  pause: () => openPauseMenu(),
};

function setupTouchControls() {
  const releaseEvents = ["pointerup", "pointerleave", "pointercancel"];

  document.querySelectorAll("#touch-dpad [data-direction]").forEach((button) => {
    const direction = button.dataset.direction;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      Sound.init();
      pressDirection(direction);
    });
    releaseEvents.forEach((type) => button.addEventListener(type, () => releaseDirection(direction)));
  });

  document.querySelectorAll("#touch-actions [data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!game.pauseDepth || button.dataset.action === "pause") TOUCH_ACTIONS[button.dataset.action]();
    });
  });

  const shieldButton = $('#touch-actions [data-hold="shield"]');
  shieldButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    heldActions.add("shield");
  });
  releaseEvents.forEach((type) => shieldButton.addEventListener(type, () => heldActions.delete("shield")));

  if (matchMedia("(pointer: coarse)").matches) $("#stage").classList.add("is-touch");
}

function setupInput() {
  // Captura na fase inicial do evento, antes de outros scripts da página.
  window.addEventListener("keydown", onKeyDown, { capture: true });
  window.addEventListener("keyup", onKeyUp, { capture: true });
  window.addEventListener("blur", releaseAllInput);
  window.addEventListener("pointerdown", () => Sound.init(), { capture: true });
  setupTouchControls();
}
