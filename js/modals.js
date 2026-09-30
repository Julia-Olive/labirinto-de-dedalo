/**
 * @file Janelas: prólogo e epílogo, confirmações, ajuda, diário e pausa.
 *
 * As janelas ficam empilhadas; só a do topo recebe o teclado. Cada uma devolve
 * uma Promise que resolve com o valor do botão escolhido.
 */
"use strict";

/** Valor com que as janelas são fechadas quando o jogo troca de tela à força. */
const MODAL_CLOSED_BY_SYSTEM = "__closed";
const STORY_CHARACTERS_PER_TICK = 2;
const STORY_TYPING_INTERVAL_MS = 18;

const modalStack = [];

/**
 * Abre uma janela.
 * @param {object} options
 * @param {string} options.html conteúdo interno
 * @param {boolean} [options.wide] janela mais larga
 * @param {string} [options.escapeValue] valor devolvido ao apertar Esc
 * @param {(modal: object) => void} [options.setup] liga eventos depois de criar o HTML
 * @returns {Promise<string>}
 */
function openModal({ html, wide = false, escapeValue, setup }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `<div class="frame${wide ? " is-wide" : ""}"><div class="inner">${html}</div></div>`;
    $("#stage").appendChild(overlay);

    const modal = {
      content: overlay.querySelector(".inner"),
      escapeValue,
      /** Tratamento extra de teclas; devolve true se consumiu a tecla. */
      onKey: null,
      close(value) {
        overlay.remove();
        modalStack.splice(modalStack.indexOf(modal), 1);
        if (modalStack.length) focusDefaultButton(modalStack[modalStack.length - 1].content);
        resolve(value);
      },
    };
    modalStack.push(modal);
    if (setup) setup(modal);

    modal.content.addEventListener("click", (event) => {
      const button = event.target.closest("[data-value]");
      if (!button || button.classList.contains("is-disabled")) return;
      Sound.effect("select");
      modal.close(button.dataset.value);
    });
    focusDefaultButton(modal.content);
  });
}

function focusDefaultButton(container) {
  const target = container.querySelector(".btn.primary:not(.is-disabled)") || container.querySelector("button:not(.is-disabled), input");
  if (target) target.focus({ preventScroll: true });
}

function topModal() {
  return modalStack[modalStack.length - 1] || null;
}

function closeAllModals() {
  while (modalStack.length) topModal().close(MODAL_CLOSED_BY_SYSTEM);
}

function buttonHtml({ label, value, primary = false, key }) {
  const shortcut = key ? `<kbd>${key}</kbd>` : "";
  return `<button class="btn${primary ? " primary" : ""}" data-value="${value}">${shortcut}${label}</button>`;
}

function portraitHeadingHtml(portrait, eyebrow, title) {
  const eyebrowHtml = eyebrow ? `<div class="modal-eyebrow">${eyebrow}</div>` : "";
  if (!portrait) return `${eyebrowHtml}<h2>${title}</h2>`;
  return `<div class="modal-heading"><canvas class="pixelated" width="64" height="64" data-portrait="${portrait}"></canvas><div>${eyebrowHtml}<h2>${title}</h2></div></div>`;
}

/**
 * Janela simples com texto e botões.
 * @returns {Promise<string>} valor do botão escolhido
 */
function askPlayer({ title, text, eyebrow, portrait, buttons, escapeValue }) {
  return openModal({
    escapeValue,
    html: `
      <div class="modal-body">
        ${portraitHeadingHtml(portrait, eyebrow, title)}
        <p class="modal-text">${text}</p>
      </div>
      <div class="modal-footer"><span class="spacer"></span>${buttons.map(buttonHtml).join("")}</div>`,
    setup(modal) {
      modal.content.querySelectorAll("[data-portrait]").forEach((canvas) => drawPortrait(canvas, canvas.dataset.portrait));
    },
  });
}

/** Pergunta de sim ou não com Esc cancelando. */
async function confirmAction(title, text, confirmLabel) {
  const choice = await askPlayer({
    title, text,
    buttons: [{ label: "Cancelar", value: "no", key: "Esc" }, { label: confirmLabel, value: "yes", primary: true }],
    escapeValue: "no",
  });
  return choice === "yes";
}

/**
 * Janela de história com páginas, texto letra por letra, Voltar e Pular.
 * @param {{title: string, pages: object[]}} story
 * @param {string} [journalId] se informado, registra o trecho no diário
 */
function showStory(story, journalId) {
  if (journalId) addToJournal(journalId);
  return openModal({
    wide: true,
    escapeValue: "skip",
    html: `
      <div class="story-banner"></div>
      <div class="modal-body">
        <div class="modal-heading">
          <canvas class="pixelated" width="64" height="64"></canvas>
          <div><div class="modal-eyebrow"></div><h2></h2></div>
        </div>
        <p class="modal-text is-story" aria-live="polite"></p>
      </div>
      <div class="modal-footer">
        <button class="btn" data-story="back"><kbd>←</kbd>Voltar</button>
        <span class="page-counter"></span>
        <span class="spacer"></span>
        <button class="btn" data-story="skip"><kbd>Esc</kbd>Pular história</button>
        <button class="btn primary" data-story="next"><kbd>Enter</kbd><span>Continuar</span></button>
      </div>`,
    setup: (modal) => setupStoryPages(modal, story),
  });
}

function setupStoryPages(modal, story) {
  const find = (selector) => modal.content.querySelector(selector);
  const textElement = find(".modal-text");
  const portraitCanvas = find(".modal-heading canvas");
  const pages = story.pages;
  let pageIndex = 0;
  let typingTimer = null;
  let fullText = "";

  const finishTyping = () => {
    if (!typingTimer) return;
    clearInterval(typingTimer);
    typingTimer = null;
    textElement.textContent = fullText;
  };

  const renderPage = () => {
    const page = pages[pageIndex];
    const isLastPage = pageIndex === pages.length - 1;
    fullText = personalize(page.text);
    find(".modal-eyebrow").textContent = personalize(page.eyebrow || "");
    find("h2").textContent = personalize(story.title);
    find(".story-banner").replaceChildren(...(page.banner ? [createBanner(page.banner)] : []));
    portraitCanvas.hidden = !page.portrait;
    if (page.portrait) drawPortrait(portraitCanvas, page.portrait);
    find(".page-counter").textContent = `${pageIndex + 1} / ${pages.length}`;
    find('[data-story="back"]').classList.toggle("is-disabled", pageIndex === 0);
    find('[data-story="next"] span').textContent = isLastPage ? "Fechar" : "Continuar";
    find('[data-story="skip"]').hidden = pages.length < 2;

    if (prefersReducedMotion) {
      textElement.textContent = fullText;
      return;
    }
    let shown = 0;
    textElement.textContent = "";
    clearInterval(typingTimer);
    typingTimer = setInterval(() => {
      shown += STORY_CHARACTERS_PER_TICK;
      textElement.textContent = fullText.slice(0, shown);
      if (shown >= fullText.length) {
        clearInterval(typingTimer);
        typingTimer = null;
      }
    }, STORY_TYPING_INTERVAL_MS);
  };

  const goForward = () => {
    if (typingTimer) return finishTyping();
    if (pageIndex < pages.length - 1) {
      pageIndex++;
      Sound.effect("select");
      renderPage();
    } else {
      modal.close("done");
    }
  };

  const goBack = () => {
    if (pageIndex === 0) return;
    finishTyping();
    pageIndex--;
    renderPage();
  };

  modal.content.addEventListener("click", (event) => {
    const button = event.target.closest("[data-story]");
    if (!button) {
      if (event.target.closest(".modal-text")) finishTyping();
      return;
    }
    if (button.classList.contains("is-disabled")) return;
    const action = button.dataset.story;
    if (action === "next") goForward();
    else if (action === "back") goBack();
    else {
      finishTyping();
      modal.close("skip");
    }
  });

  modal.onKey = (action) => {
    if (action === "left" || action === "back") { goBack(); return true; }
    if (action === "right") { goForward(); return true; }
    return false;
  };

  renderPage();
}

/* ------------------------------------------------------------------ */
/* Ajuda                                                               */
/* ------------------------------------------------------------------ */

const HELP_TABS = {
  controls: {
    label: "Controles",
    html: `
      <dl>
        <dt>WASD / Setas</dt><dd>Andar. Segure para continuar andando.</dd>
        <dt>Q</dt><dd>Ambrosia: cura 50 de vida. Não é gasta se a vida estiver cheia.</dd>
        <dt>Enter</dt><dd>Avança a fala na caixa de diálogo. As falas também passam sozinhas.</dd>
        <dt>Esc</dt><dd>Pausa: diário, ajuda, som, recomeçar, fugir da luta ou sair.</dd>
        <dt>J</dt><dd>Diário: releia qualquer parte da história.</dd>
        <dt>H</dt><dd>Esta ajuda.</dd>
        <dt>M</dt><dd>Liga ou desliga o som.</dd>
      </dl>
      <p style="margin-top:.5em">O fio dourado mostra por onde você passou, e Ícaro segue você por ele. No mapa, a arena do guardião aparece em vermelho e a saída em dourado. O jogo salva ao entrar em cada anel, ao entrar numa arena e ao vencer.</p>`,
  },
  fight: {
    label: "Como lutar",
    html: `
      <p>A luta acontece na arena, em tempo real. Ao entrar, os portões se fecham.</p>
      <dl>
        <dt>Espaço</dt><dd>Golpe de lança na direção em que você anda. A cada 3 acertos você ganha 1 de fôlego.</dd>
        <dt>Shift ou K</dt><dd>Segure para erguer o escudo: você anda devagar, recebe só 30% do dano, bloqueia projéteis, reflete o olhar da Medusa e para a investida do Minotauro.</dd>
        <dt>E</dt><dd>Golpe heroico: gasta 2 de fôlego e atinge tudo ao seu redor.</dd>
        <dt>R</dt><dd>Arremessa uma tocha. Contra a Hidra, impede que as cabeças renasçam.</dd>
        <dt>Q</dt><dd>Ambrosia.</dd>
      </dl>
      <p style="margin-top:.5em">Círculos e linhas vermelhas no chão mostram onde o golpe do inimigo vai cair: saia deles. Ícaro atira pedras com a funda e cura você duas vezes por luta quando sua vida fica baixa.</p>`,
  },
  usability: {
    label: "Usabilidade",
    html: `
      <p>O jogo segue as 10 heurísticas de usabilidade de Jakob Nielsen:</p>
      <ol>
        <li><b>Visibilidade do status</b>: barras de vida do herói, de Ícaro e do chefe, fôlego, selos, itens, cronômetro da fuga e o aviso "Salvo".</li>
        <li><b>Correspondência com o mundo real</b>: termos da mitologia grega (ambrosia, selos de bronze, o fio) e português do dia a dia.</li>
        <li><b>Controle e liberdade</b>: pausar, pular a história, fugir da luta pelo menu de pausa, desligar o som.</li>
        <li><b>Consistência e padrões</b>: Enter confirma e Esc volta em todas as telas; verde é aliado e vermelho é perigo.</li>
        <li><b>Prevenção de erros</b>: a arena é marcada em vermelho antes de você entrar, os golpes fortes são avisados no chão, a ambrosia não é gasta com vida cheia e o nome é validado enquanto você digita.</li>
        <li><b>Reconhecer em vez de lembrar</b>: objetivo sempre visível, teclas da luta na tela, fio dourado no chão, aviso do próximo golpe abaixo da barra do chefe.</li>
        <li><b>Flexibilidade e eficiência</b>: teclado ou toque, falas que passam sozinhas ou com Enter, modo História para menos desafio.</li>
        <li><b>Design minimalista</b>: a luta acontece no próprio mapa, sem janelas; as falas aparecem numa caixa pequena que não para o jogo.</li>
        <li><b>Recuperação de erros</b>: ao cair, o jogo explica o que fazer diferente e volta você à entrada da arena.</li>
        <li><b>Ajuda e documentação</b>: esta tela (H), o Diário (J) e as dicas de Ícaro em cada anel.</li>
      </ol>`,
  },
};

/**
 * @param {"controls"|"fight"|"usability"} initialTab
 */
function showHelp(initialTab = "controls") {
  const tabsHtml = Object.entries(HELP_TABS)
    .map(([id, tab]) => `<button class="tab" role="tab" data-tab="${id}">${tab.label}</button>`)
    .join("");
  return openModal({
    wide: true,
    escapeValue: "close",
    html: `
      <div class="modal-body help-content">
        <h2 style="margin-bottom:.35em">Ajuda</h2>
        <div class="tabs" role="tablist">${tabsHtml}</div>
        <div class="help-tab-content"></div>
      </div>
      <div class="modal-footer"><span class="spacer"></span>${buttonHtml({ label: "Fechar", value: "close", primary: true, key: "Esc" })}</div>`,
    setup(modal) {
      const selectTab = (id) => {
        modal.content.querySelectorAll(".tab").forEach((tab) => tab.setAttribute("aria-selected", tab.dataset.tab === id));
        modal.content.querySelector(".help-tab-content").innerHTML = HELP_TABS[id].html;
      };
      modal.content.addEventListener("click", (event) => {
        const tab = event.target.closest(".tab");
        if (tab) selectTab(tab.dataset.tab);
      });
      selectTab(initialTab);
    },
  });
}

/* ------------------------------------------------------------------ */
/* Diário                                                              */
/* ------------------------------------------------------------------ */

async function showJournal() {
  const entries = game.save.journal;
  const listHtml = entries.length
    ? `<div class="journal-list">${entries.map((id) => `<button class="journal-item" data-value="${id}">${journalTitle(id)}</button>`).join("")}</div>`
    : `<p class="modal-text">Ainda não há nada no diário.</p>`;

  const choice = await openModal({
    wide: true,
    escapeValue: "close",
    html: `
      <div class="modal-body"><h2 style="margin-bottom:.4em">Diário</h2>${listHtml}</div>
      <div class="modal-footer"><span class="spacer"></span>${buttonHtml({ label: "Fechar", value: "close", primary: true, key: "Esc" })}</div>`,
  });
  if (!choice || choice === "close" || choice === MODAL_CLOSED_BY_SYSTEM) return;

  const story = choice.startsWith(NOTE_ID_PREFIX)
    ? noteAsStory(Number(choice.slice(NOTE_ID_PREFIX.length)))
    : STORY[choice];
  await showStory(story);
  return showJournal();
}

/* ------------------------------------------------------------------ */
/* Pausa                                                               */
/* ------------------------------------------------------------------ */

function pauseMenuHtml() {
  const fleeButton = game.fight ? buttonHtml({ label: "Fugir da luta", value: "flee" }) : "";
  return `
    <div class="modal-body">
      <h2 style="text-align:center;margin-bottom:.5em">Pausa</h2>
      <div class="pause-menu">
        ${buttonHtml({ label: "Continuar", value: "resume", primary: true, key: "Esc" })}
        ${fleeButton}
        ${buttonHtml({ label: "Diário", value: "journal", key: "J" })}
        ${buttonHtml({ label: "Ajuda", value: "help", key: "H" })}
        ${buttonHtml({ label: `Som: ${Sound.enabled ? "ligado" : "desligado"}`, value: "sound", key: "M" })}
        <div class="volume-control">
          <label for="volume">Volume</label>
          <input type="range" id="volume" min="0" max="1" step=".05" value="${Sound.volume}">
        </div>
        ${buttonHtml({ label: "Recomeçar do último ponto salvo", value: "restart" })}
        ${buttonHtml({ label: "Sair para o menu principal", value: "quit" })}
      </div>
    </div>`;
}

async function openPauseMenu() {
  if (isPaused()) return;
  game.pauseDepth++;
  releaseAllInput();

  for (;;) {
    const choice = await openModal({
      escapeValue: "resume",
      html: pauseMenuHtml(),
      setup(modal) {
        modal.content.querySelector("#volume").addEventListener("input", (event) => Sound.setVolume(Number(event.target.value)));
      },
    });

    if (choice === "resume" || choice === MODAL_CLOSED_BY_SYSTEM) break;
    if (choice === "journal") await showJournal();
    if (choice === "help") await showHelp(game.fight ? "fight" : "controls");
    if (choice === "sound") toggleSound();
    if (choice === "flee") {
      game.pauseDepth--;
      fleeFight();
      return;
    }
    if (choice === "restart" && await confirmAction("Recomeçar?", "Você volta ao último ponto salvo. O que fez desde então será perdido.", "Recomeçar")) {
      game.pauseDepth--;
      loadCheckpoint(game.checkpoint);
      return;
    }
    if (choice === "quit" && await confirmAction("Sair para o menu?", "Seu progresso fica guardado no último ponto salvo. Volte depois com Continuar.", "Sair")) {
      showTitleScreen();
      return;
    }
  }
  game.pauseDepth--;
}

/** Abre uma janela que pausa o jogo enquanto estiver aberta. */
async function withGamePaused(openWindow) {
  game.pauseDepth++;
  releaseAllInput();
  try {
    await openWindow();
  } finally {
    game.pauseDepth = Math.max(0, game.pauseDepth - 1);
  }
}

function toggleSound() {
  Sound.init();
  Sound.setEnabled(!Sound.enabled);
  showToast(Sound.enabled ? "Som ligado" : "Som desligado");
}
