/**
 * @file Música e efeitos sonoros, gerados em tempo real com a Web Audio API.
 *
 * As músicas usam a escala frígia dominante em Ré, de sonoridade mediterrânea.
 * Cada faixa é uma sequência de notas no formato "Nota:duração", em que a
 * duração é medida em colcheias e "-" é pausa. Exemplo: "D5:2 Eb5:1 -:1".
 */
"use strict";

const Sound = (() => {
  const SCHEDULE_AHEAD_SECONDS = 0.25;
  const SCHEDULER_INTERVAL_MS = 40;
  const MUSIC_GAIN = 0.5;
  const EFFECTS_GAIN = 0.8;

  let context = null;
  let masterGain = null;
  let musicGain = null;
  let effectsGain = null;
  let noiseBuffer = null;
  let enabled = storage.read(STORAGE_KEYS.music) !== "0";
  let volume = Number(storage.read(STORAGE_KEYS.volume) ?? 0.7);
  let requestedSong = null;
  let currentSong = null;
  let tracks = null;
  let eighthNoteSeconds = 0;

  /* ---------- Partituras ---------- */

  function parseSequence(text) {
    return text.trim().split(/\s+/).map((token) => {
      const [note, length] = token.split(":");
      return { note: note === "-" ? null : note, length: Number(length || 1) };
    });
  }

  /** Padrão de baixo de um compasso: tônica longa, quinta, oitava e quinta. */
  function bassBar(root, fifth, octave) {
    return `${root}:3 ${fifth}:1 ${octave}:2 ${fifth}:2`;
  }

  const SONGS = {
    explore: {
      bpm: 92,
      tracks: [
        { instrument: "lyre", volume: 1, notes: parseSequence(`
          D5:2 Eb5:1 F#5:1 G5:2 F#5:2 Eb5:1 D5:1 Eb5:1 F#5:1 D5:4 A4:2 Bb4:1 C5:1 D5:2 C5:1 Bb4:1 A4:6 -:2
          G5:2 A5:1 G5:1 F#5:2 Eb5:2 F#5:1 G5:1 F#5:1 Eb5:1 D5:4 C5:1 D5:1 Eb5:2 D5:1 C5:1 Bb4:2 A4:2 Eb5:1 C5:1 D5:4
          D4:2 A4:2 G4:1 F#4:1 G4:2 A4:3 Bb4:1 A4:4 G4:1 F#4:1 Eb4:2 F#4:2 G4:2 A4:8
          Bb4:2 A4:1 G4:1 A4:2 D5:2 C5:1 Bb4:1 A4:1 G4:1 A4:4 G4:2 F#4:1 Eb4:1 F#4:2 G4:2 D4:6 -:2`) },
        { instrument: "bass", volume: 1, notes: parseSequence([
          bassBar("D2", "A2", "D3"), bassBar("D2", "A2", "D3"), bassBar("Bb1", "F2", "Bb2"), bassBar("A1", "E2", "A2"),
          bassBar("G1", "D2", "G2"), bassBar("D2", "A2", "D3"), bassBar("C2", "G2", "C3"), bassBar("D2", "A2", "D3"),
          bassBar("D2", "A2", "D3"), bassBar("A1", "E2", "A2"), bassBar("G1", "D2", "G2"), bassBar("A1", "E2", "A2"),
          bassBar("Bb1", "F2", "Bb2"), bassBar("A1", "E2", "A2"), bassBar("G1", "D2", "G2"), bassBar("D2", "A2", "D3"),
        ].join(" ")) },
        { instrument: "pad", volume: 1, notes: parseSequence("D3:8 D3:8 Bb2:8 A2:8 G2:8 D3:8 C3:8 D3:8 D3:8 A2:8 G2:8 A2:8 Bb2:8 A2:8 G2:8 D3:8") },
        { instrument: "drum", volume: 0.8, notes: parseSequence("K:2 t:1 t:1 K:1 t:1 K:1 t:1") },
      ],
    },
    battle: {
      bpm: 152,
      tracks: [
        { instrument: "lead", volume: 1, notes: parseSequence(`
          D5:3 Eb5:1 F#5:2 A5:2 G5:1 F#5:1 Eb5:1 F#5:1 D5:4 Bb4:2 D5:2 Eb5:2 D5:2 C5:2 Eb5:2 G5:4
          A5:3 G5:1 F#5:2 Eb5:2 F#5:1 G5:1 A5:2 D5:4 Bb5:2 A5:2 G5:2 F#5:2 Eb5:2 F#5:2 A4:4`) },
        { instrument: "bass", volume: 1.1, notes: parseSequence(`
          D2 D2 D3 D2 Eb2 D2 C3 D2 D2 D2 D3 D2 Eb2 D2 C3 D2 Bb1 Bb1 Bb2 Bb1 C2 C2 C3 C2 C2 C2 C3 C2 D2 D2 Eb2 C2
          D2 D2 D3 D2 Eb2 D2 C3 D2 D2 D2 D3 D2 Eb2 D2 C3 D2 Bb1 Bb1 Bb2 Bb1 C2 C2 C3 C2 A1 A1 A2 A1 Bb1 A1 C#2 A1`) },
        { instrument: "drum", volume: 1, notes: parseSequence("K t S t K K S t") },
      ],
    },
    escape: {
      bpm: 176,
      tracks: [
        { instrument: "lead", volume: 0.9, notes: parseSequence("A5:2 G5:1 F#5:1 Eb5:2 F#5:2 G5:2 F#5:1 Eb5:1 D5:4 Bb4:1 C5:1 D5:1 Eb5:1 F#5:2 G5:2 A5:2 Bb5:2 A5:4") },
        { instrument: "bass", volume: 1.1, notes: parseSequence("D2 D3 D2 D3 Eb2 Eb3 D2 D3 D2 D3 D2 D3 C2 C3 C2 C3 Bb1 Bb2 Bb1 Bb2 C2 C3 C2 C3 A1 A2 A1 A2 A1 A2 C#2 A1") },
        { instrument: "drum", volume: 1, notes: parseSequence("K t S t K S S t") },
      ],
    },
  };

  /** Converte o nome de uma nota ("F#4", "Bb2") em frequência (Hz). */
  function noteFrequency(name) {
    const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    const semitoneInOctave = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
    const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
    const midi = semitoneInOctave + accidental + (Number(match[3]) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /* ---------- Instrumentos ---------- */

  function createNoiseSource(startTime) {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.start(startTime);
    source.stop(startTime + 0.5);
    return source;
  }

  function playDrum(symbol, time, volumeScale, output) {
    const gain = context.createGain();
    gain.connect(output);
    if (symbol === "K") {
      const oscillator = context.createOscillator();
      oscillator.frequency.setValueAtTime(150, time);
      oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.14);
      gain.gain.setValueAtTime(0.55 * volumeScale, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      oscillator.connect(gain);
      oscillator.start(time);
      oscillator.stop(time + 0.22);
      return;
    }
    const filter = context.createBiquadFilter();
    createNoiseSource(time).connect(filter);
    filter.connect(gain);
    const isSnare = symbol === "S";
    filter.type = isSnare ? "bandpass" : "highpass";
    filter.frequency.value = isSnare ? 1800 : 7000;
    gain.gain.setValueAtTime((isSnare ? 0.22 : 0.06) * volumeScale, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (isSnare ? 0.13 : 0.04));
  }

  /** Lira: corda dedilhada com ataque rápido e decaimento longo. */
  function playLyre(frequency, time, duration, volumeScale, output) {
    const gain = context.createGain();
    const body = context.createOscillator();
    const shimmer = context.createOscillator();
    const shimmerGain = context.createGain();
    body.type = "triangle";
    body.frequency.value = frequency;
    shimmer.type = "sine";
    shimmer.frequency.value = frequency * 2.003;
    shimmerGain.gain.value = 0.3;
    body.connect(gain);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(gain);
    gain.connect(output);
    const decay = Math.min(1.6, duration * 2);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.24 * volumeScale, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    for (const oscillator of [body, shimmer]) {
      oscillator.start(time);
      oscillator.stop(time + decay + 0.05);
    }
  }

  /** Nota sustentada com envelope simples (ataque, sustentação, soltura). */
  function playSustained(oscillators, filterFrequency, peak, time, duration, attack, releaseStart, output) {
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFrequency;
    filter.connect(gain);
    gain.connect(output);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + attack);
    gain.gain.setValueAtTime(peak, time + releaseStart);
    gain.gain.linearRampToValueAtTime(0, time + duration * 0.97);
    for (const oscillator of oscillators) {
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(time + duration);
    }
  }

  function oscillator(type, frequency) {
    const node = context.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    return node;
  }

  function playNote(instrument, note, time, duration, volumeScale, output) {
    if (instrument === "drum") return playDrum(note, time, volumeScale, output);
    const frequency = noteFrequency(note);
    switch (instrument) {
      case "lyre":
        return playLyre(frequency, time, duration, volumeScale, output);
      case "lead":
        return playSustained([oscillator("square", frequency)], 2200, 0.075 * volumeScale, time, duration, 0.01, duration * 0.7, output);
      case "bass":
        return playSustained([oscillator("triangle", frequency), oscillator("sawtooth", frequency)], 420, 0.26 * volumeScale, time, duration, 0.01, duration * 0.6, output);
      case "pad":
        return playSustained([oscillator("sawtooth", frequency), oscillator("sawtooth", frequency * 1.006)], 650, 0.045 * volumeScale, time, duration, 0.4, duration - 0.4, output);
    }
  }

  /* ---------- Agendador das músicas ---------- */

  function scheduleNotes() {
    if (!tracks) return;
    const now = context.currentTime;
    for (const track of tracks) {
      // Se a aba ficou em segundo plano, recomeça do ponto atual em vez de tocar tudo acumulado.
      if (track.nextTime < now - 0.1) track.nextTime = now + 0.05;
      while (track.nextTime < now + SCHEDULE_AHEAD_SECONDS) {
        if (track.index >= track.notes.length) track.index = 0;
        const { note, length } = track.notes[track.index++];
        const duration = length * eighthNoteSeconds;
        if (note) playNote(track.instrument, note, track.nextTime, duration, track.volume, musicGain);
        track.nextTime += duration;
      }
    }
  }

  /* ---------- API pública ---------- */

  /** Cria o contexto de áudio. Os navegadores só permitem isso após um clique ou tecla. */
  function init() {
    if (context) {
      if (context.state === "suspended") context.resume();
      return;
    }
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    masterGain = context.createGain();
    masterGain.gain.value = enabled ? volume : 0;
    masterGain.connect(context.destination);
    musicGain = context.createGain();
    musicGain.gain.value = MUSIC_GAIN;
    musicGain.connect(masterGain);
    effectsGain = context.createGain();
    effectsGain.gain.value = EFFECTS_GAIN;
    effectsGain.connect(masterGain);

    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    setInterval(scheduleNotes, SCHEDULER_INTERVAL_MS);
    if (requestedSong) {
      currentSong = null;
      playSong(requestedSong);
    }
  }

  /**
   * Troca a música de fundo.
   * @param {"explore"|"battle"|"escape"|null} name null para silêncio
   */
  function playSong(name) {
    requestedSong = name;
    if (!context || currentSong === name) return;
    currentSong = name;
    if (!name) {
      tracks = null;
      return;
    }
    const song = SONGS[name];
    const startTime = context.currentTime + 0.08;
    eighthNoteSeconds = 60 / song.bpm / 2;
    tracks = song.tracks.map((track) => ({ ...track, index: 0, nextTime: startTime }));
  }

  /** Toca um efeito sonoro curto. */
  function effect(name) {
    if (!context) return;
    const now = context.currentTime;

    const sweep = (type, fromHz, toHz, seconds, level) => {
      const node = oscillator(type, fromHz);
      const gain = context.createGain();
      node.frequency.setValueAtTime(fromHz, now);
      node.frequency.exponentialRampToValueAtTime(toHz, now + seconds);
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      node.connect(gain);
      gain.connect(effectsGain);
      node.start(now);
      node.stop(now + seconds + 0.02);
    };
    const noise = (filterType, frequency, seconds, level) => {
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      filter.type = filterType;
      filter.frequency.value = frequency;
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      createNoiseSource(now).connect(filter);
      filter.connect(gain);
      gain.connect(effectsGain);
    };
    const arpeggio = (notes, instrument, step) => {
      notes.forEach((note, i) => playNote(instrument, note, now + i * step, step * 1.5, 1, effectsGain));
    };

    const EFFECTS = {
      hit: () => { noise("bandpass", 900, 0.12, 0.4); sweep("square", 220, 70, 0.12, 0.12); },
      hurt: () => sweep("square", 320, 90, 0.22, 0.14),
      swing: () => noise("highpass", 2500, 0.08, 0.18),
      heal: () => arpeggio(["D5", "F#5", "A5", "D6"], "lyre", 0.07),
      pickup: () => arpeggio(["A5", "D6"], "lead", 0.07),
      select: () => sweep("square", 700, 660, 0.05, 0.06),
      spike: () => noise("highpass", 3000, 0.1, 0.3),
      stairs: () => arpeggio(["D6", "A5", "F#5", "D5", "A4"], "lyre", 0.09),
      petrify: () => sweep("sawtooth", 220, 55, 0.9, 0.12),
      fire: () => noise("lowpass", 1200, 0.4, 0.4),
      shield: () => sweep("triangle", 900, 1300, 0.15, 0.22),
      rumble: () => noise("lowpass", 200, 0.8, 0.5),
      roar: () => { sweep("sawtooth", 160, 60, 0.7, 0.2); noise("lowpass", 400, 0.6, 0.3); },
      arrow: () => noise("bandpass", 3000, 0.12, 0.2),
      gate: () => { sweep("square", 90, 60, 0.3, 0.15); noise("lowpass", 500, 0.3, 0.3); },
      victory: () => arpeggio(["D5", "F#5", "A5", "D6", "A5", "D6"], "lyre", 0.12),
      defeat: () => arpeggio(["A4", "G4", "Eb4", "D4"], "lyre", 0.28),
    };
    EFFECTS[name]?.();
  }

  /** Liga ou desliga todo o som e lembra a escolha. */
  function setEnabled(isEnabled) {
    enabled = isEnabled;
    storage.write(STORAGE_KEYS.music, isEnabled ? "1" : "0");
    if (masterGain) masterGain.gain.setTargetAtTime(isEnabled ? volume : 0, context.currentTime, 0.05);
  }

  /** Ajusta o volume geral (0 a 1) e lembra a escolha. */
  function setVolume(level) {
    volume = level;
    storage.write(STORAGE_KEYS.volume, String(level));
    if (masterGain && enabled) masterGain.gain.setTargetAtTime(level, context.currentTime, 0.05);
  }

  return {
    init,
    playSong,
    effect,
    setEnabled,
    setVolume,
    get enabled() { return enabled; },
    get volume() { return volume; },
  };
})();
