/**
 * @file Fluxo do jogo: título, escolha do herói, anéis, derrota, final,
 * laço principal e inicialização.
 */
"use strict";

/* ------------------------------------------------------------------ */
/* Telas                                                               */
/* ------------------------------------------------------------------ */

/**
 * Mostra uma das telas de menu, ou nenhuma (null) para ver o jogo.
 * @param {"#screen-title"|"#screen-select"|null} screenId
 */
function showScreen(screenId) {
  for (const id of ["#screen-title", "#screen-select"]) $(id).hidden = id !== screenId;
  $("#hud").hidden = screenId !== null;
  $("#stage").classList.toggle("is-menu", screenId !== null);
}

function showTitleScreen() {
  game.mode = Mode.TITLE;
  game.level = null;
  game.fight = null;
  game.pauseDepth = 0;
  closeAllModals();
  Dialogue.clear();
  releaseAllInput();
  showScreen("#screen-title");
  Sound.playSong("explore");

  const continueButton = $("#button-continue");
  const hasSave = hasStoredCheckpoint();
  continueButton.classList.toggle("is-disabled", !hasSave);
  continueButton.title = hasSave ? "Voltar ao último ponto salvo" : "Nenhum jogo salvo ainda";
  $("#button-new-game").focus();
}

/* ------------------------------------------------------------------ */
/* Escolha do herói                                                    */
/* ------------------------------------------------------------------ */

let selectedGender = "m";

function showCharacterSelect() {
  game.mode = Mode.SELECT;
  showScreen("#screen-select");
  selectedGender = "m";
  $("#hero-name").value = HERO_NAME.defaults.m;
  $("#difficulty-normal").checked = true;
  selectHeroCard("m");
  $("#card-m").focus();
}

/** Marca o cartão escolhido. Se o nome ainda é o sugerido, troca pelo sugerido do outro personagem. */
function selectHeroCard(gender) {
  const nameInput = $("#hero-name");
  if (nameInput.value.trim() === HERO_NAME.defaults[selectedGender]) nameInput.value = HERO_NAME.defaults[gender];
  selectedGender = gender;
  $("#card-m").setAttribute("aria-pressed", gender === "m");
  $("#card-f").setAttribute("aria-pressed", gender === "f");
  validateHeroName();
}

/**
 * Valida o nome enquanto o jogador digita e explica o que corrigir.
 * @returns {boolean} true se o nome é válido
 */
function validateHeroName() {
  const name = $("#hero-name").value.trim();
  let error = "";
  if (name.length < HERO_NAME.minLength) error = `O nome precisa de pelo menos ${HERO_NAME.minLength} letras.`;
  else if (!HERO_NAME.allowedPattern.test(name)) error = "Use só letras, espaços, hífen ou apóstrofo.";

  $("#hero-name-error").textContent = error;
  $("#hero-name").classList.toggle("is-invalid", Boolean(error));
  const confirmButton = $("#button-select-confirm");
  confirmButton.classList.toggle("is-disabled", Boolean(error));
  confirmButton.setAttribute("aria-disabled", Boolean(error));
  return !error;
}

async function confirmHeroSelection() {
  if (!validateHeroName()) {
    $("#hero-name").focus();
    return;
  }
  const name = $("#hero-name").value.trim().replace(/\s+/g, " ");
  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  game.save = createSave(selectedGender, name, difficulty);
  deleteStoredCheckpoint();

  game.mode = Mode.STORY;
  showScreen(null);
  $("#hud").hidden = true;
  ctx.fillStyle = "#140e08";
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  await showStory(STORY.intro, "intro");
  startLevel(0);
}

/* ------------------------------------------------------------------ */
/* Anéis do labirinto                                                  */
/* ------------------------------------------------------------------ */

/** Começa um anel: gera o labirinto, mostra a fala de Ícaro e salva. */
function startLevel(index) {
  const save = game.save;
  save.levelIndex = index;
  const level = generateLevel(index, Math.floor(Math.random() * 1e9));
  const escapeSeconds = level.definition.escapeSeconds;
  if (escapeSeconds) level.timeLeft = escapeSeconds[save.difficulty];
  if (level.definition.startingTorchGift) save.items.torches += level.definition.startingTorchGift;
  game.level = level;

  placePlayer(level.start.x, level.start.y);
  level.trail = [[player.x, player.y]];
  snapCamera();
  enterExploration();
  Dialogue.clear();
  Dialogue.playStory(`level${index}`);
  saveCheckpoint();
}

/** Volta ao modo de exploração (depois de carregar, fugir ou vencer). */
function enterExploration() {
  game.mode = Mode.EXPLORE;
  showScreen(null);
  drawPortrait($("#hud-portrait"), "player");
  updateHud();
  Sound.playSong(game.level.definition.escapeSeconds ? "escape" : "explore");
  releaseAllInput();
}

/* ------------------------------------------------------------------ */
/* Derrota e final                                                     */
/* ------------------------------------------------------------------ */

const EXPLORATION_DEFEAT_TIPS = {
  "O teto desabou": "Siga o ponto dourado no mapa e evite corredores sem saída. No modo História a fuga tem mais tempo.",
  "Espinhos": "Os espinhos avisam antes de subir: pontinhos aparecem no chão. Espere eles descerem e passe.",
};
const DEFAULT_DEFEAT_TIP = "Os bichos dos corredores andam em linha reta. Espere num corredor lateral até passarem. A ambrosia (Q) cura você.";

/** Pergunta se o jogador quer tentar de novo ou voltar ao menu. */
async function offerRetry({ eyebrow, title, portrait, text }) {
  const choice = await askPlayer({
    eyebrow, title, portrait, text,
    buttons: [
      { label: "Menu principal", value: "menu" },
      { label: "Tentar de novo", value: "retry", primary: true, key: "Enter" },
    ],
  });
  game.pauseDepth = 0;
  if (choice === "menu") showTitleScreen();
  else loadCheckpoint(game.checkpoint);
}

function handleExplorationDefeat(cause) {
  game.pauseDepth++;
  releaseAllInput();
  Sound.effect("defeat");
  Sound.playSong(null);
  const tip = EXPLORATION_DEFEAT_TIPS[cause] || DEFAULT_DEFEAT_TIP;
  offerRetry({ eyebrow: "Você caiu", title: cause, portrait: "player", text: `Sua vida chegou a zero.\nDica: ${tip}` });
}

function handleFightDefeat(fight) {
  game.pauseDepth++;
  releaseAllInput();
  offerRetry({
    eyebrow: `Derrota contra ${fight.boss.name}`,
    title: `${game.save.hero.name} caiu`,
    portrait: fight.type,
    text: `Dica: ${fight.boss.tip}\nVocê volta à entrada da arena, com a vida e os itens de antes da luta.`,
  });
}

async function finishGame() {
  game.pauseDepth++;
  game.mode = Mode.STORY;
  releaseAllInput();
  Dialogue.clear();
  Sound.effect("victory");
  $("#hud").hidden = true;

  await showStory(STORY.ending, "ending");
  deleteStoredCheckpoint();
  const { stats, hero } = game.save;
  const totalSeconds = Math.round(stats.seconds);
  const statsHtml = `
    <span class="final-stats">
      <span><b>Tempo</b><br>${Math.floor(totalSeconds / 60)} min ${totalSeconds % 60} s</span>
      <span><b>Passos</b><br>${stats.steps}</span>
      <span><b>Lutas</b><br>${stats.fights}</span>
      <span><b>Nível final</b><br>${hero.level}</span>
    </span>`;
  const choice = await askPlayer({
    eyebrow: "Atenas está livre",
    title: `Obrigado, ${hero.name}`,
    portrait: "player",
    text: statsHtml,
    buttons: [
      { label: "Menu principal", value: "menu" },
      { label: "Jogar de novo", value: "again", primary: true, key: "Enter" },
    ],
  });
  game.pauseDepth = 0;
  if (choice === "again") showCharacterSelect();
  else showTitleScreen();
}

/* ------------------------------------------------------------------ */
/* Botões dos menus                                                    */
/* ------------------------------------------------------------------ */

function setupMenuButtons() {
  $("#button-new-game").addEventListener("click", async () => {
    Sound.effect("select");
    const replacingSave = hasStoredCheckpoint();
    if (replacingSave && !(await confirmAction("Começar um novo jogo?", "O jogo salvo será apagado quando a nova jornada começar.", "Novo jogo"))) return;
    showCharacterSelect();
  });

  $("#button-continue").addEventListener("click", () => {
    const checkpoint = readStoredCheckpoint();
    if (!checkpoint) {
      showToast("Nenhum jogo salvo ainda. Comece um Novo jogo.", true);
      return;
    }
    loadCheckpoint(checkpoint);
    showToast("Jogo carregado do último ponto salvo");
  });

  $("#button-help").addEventListener("click", () => showHelp());
  $("#card-m").addEventListener("click", () => { selectHeroCard("m"); Sound.effect("select"); });
  $("#card-f").addEventListener("click", () => { selectHeroCard("f"); Sound.effect("select"); });
  $("#hero-name").addEventListener("input", validateHeroName);
  $("#button-select-back").addEventListener("click", showTitleScreen);
  $("#button-select-confirm").addEventListener("click", confirmHeroSelection);
}

/* ------------------------------------------------------------------ */
/* Laço principal e inicialização                                      */
/* ------------------------------------------------------------------ */

/** Maior intervalo aceito entre quadros; evita saltos quando a aba volta do segundo plano. */
const MAX_FRAME_SECONDS = 0.05;
let lastFrameTimestamp = 0;

function update(deltaSeconds) {
  if (isPaused()) return;
  game.time += deltaSeconds;
  game.save.stats.seconds += deltaSeconds;
  Dialogue.update(deltaSeconds);
  if (game.mode === Mode.FIGHT) updateFight(deltaSeconds);
  else updateExploration(deltaSeconds);
}

function gameLoop(timestamp) {
  const deltaSeconds = Math.min(MAX_FRAME_SECONDS, (timestamp - lastFrameTimestamp) / 1000 || 0);
  lastFrameTimestamp = timestamp;
  update(deltaSeconds);
  renderFrame(deltaSeconds);
  requestAnimationFrame(gameLoop);
}

/** Ajusta o palco a 16:9 dentro da janela; o tamanho da fonte acompanha a largura. */
function fitStageToWindow() {
  const SIDE_GUTTER = 32;
  const VERTICAL_GUTTER = 16;
  const MIN_WIDTH = 280;
  const FONT_DIVISOR = 50;
  const availableWidth = window.innerWidth - SIDE_GUTTER;
  const availableHeight = window.innerHeight - VERTICAL_GUTTER;
  const width = Math.max(MIN_WIDTH, Math.floor(Math.min(availableWidth, (availableHeight * 16) / 9)));
  const stage = $("#stage");
  stage.style.width = `${width}px`;
  stage.style.height = `${Math.floor((width * 9) / 16)}px`;
  stage.style.fontSize = `${width / FONT_DIVISOR}px`;
}

async function boot() {
  fitStageToWindow();
  window.addEventListener("resize", fitStageToWindow);
  applyMeanderPattern();
  buildSprites();
  setupInput();
  setupMenuButtons();
  await loadAllImages();
  $("#loading").remove();
  showTitleScreen();
  requestAnimationFrame(gameLoop);
}

boot();
