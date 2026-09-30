/**
 * @file Caixa de fala.
 *
 * Mostra falas curtas embaixo da tela sem pausar o jogo. As falas entram numa
 * fila, aparecem letra por letra e passam sozinhas depois de um tempo de
 * leitura, ou na hora com Enter ou um clique.
 */
"use strict";

const Dialogue = (() => {
  const CHARACTERS_PER_TICK = 2;
  const TYPING_INTERVAL_MS = 20;
  const BASE_READING_SECONDS = 3.2;
  const READING_SECONDS_PER_CHARACTER = 0.05;

  const box = $("#dialogue");
  const portraitCanvas = box.querySelector("canvas");
  const speakerLabel = box.querySelector(".dialogue-speaker");
  const textElement = box.querySelector(".dialogue-text");
  const hint = box.querySelector(".dialogue-hint");

  const queue = [];
  let current = null;
  let typingTimer = null;
  let readingTimeLeft = 0;

  function stopTyping() {
    clearInterval(typingTimer);
    typingTimer = null;
  }

  function showNext() {
    stopTyping();
    current = queue.shift() || null;
    if (!current) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    portraitCanvas.hidden = !current.portrait;
    if (current.portrait) drawPortrait(portraitCanvas, current.portrait);
    speakerLabel.textContent = current.speaker;
    hint.textContent = queue.length ? `Enter ▸ (${queue.length})` : "Enter ✓";
    readingTimeLeft = BASE_READING_SECONDS + current.text.length * READING_SECONDS_PER_CHARACTER;

    if (prefersReducedMotion) {
      textElement.textContent = current.text;
      return;
    }
    let shown = 0;
    textElement.textContent = "";
    typingTimer = setInterval(() => {
      shown += CHARACTERS_PER_TICK;
      textElement.textContent = current.text.slice(0, shown);
      if (shown >= current.text.length) stopTyping();
    }, TYPING_INTERVAL_MS);
  }

  /** Adiciona uma fala à fila. */
  function say(speaker, portrait, text) {
    queue.push({ speaker, portrait, text });
    if (!current) showNext();
  }

  /** Coloca todas as páginas de um trecho de STORY na fila e registra no diário. */
  function playStory(storyId) {
    const story = STORY[storyId];
    addToJournal(storyId);
    for (const page of story.pages) say(personalize(page.eyebrow || story.title), page.portrait, personalize(page.text));
  }

  /**
   * Completa o texto que está sendo digitado ou passa para a próxima fala.
   * @returns {boolean} false se não havia fala na tela
   */
  function advance() {
    if (!current) return false;
    if (typingTimer) {
      stopTyping();
      textElement.textContent = current.text;
    } else {
      showNext();
    }
    return true;
  }

  function clear() {
    queue.length = 0;
    stopTyping();
    current = null;
    box.hidden = true;
  }

  /** Conta o tempo de leitura; chamada a cada quadro. */
  function update(deltaSeconds) {
    if (!current || typingTimer) return;
    readingTimeLeft -= deltaSeconds;
    if (readingTimeLeft <= 0) showNext();
  }

  box.addEventListener("click", advance);

  return {
    say,
    playStory,
    advance,
    clear,
    update,
    get isActive() { return current !== null; },
  };
})();
