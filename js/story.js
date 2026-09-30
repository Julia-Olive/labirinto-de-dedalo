/**
 * @file Textos da história.
 *
 * Cada trecho tem um título e uma lista de páginas. Uma página pode ter:
 * - eyebrow: linha curta acima do título (quem fala ou onde se passa);
 * - portrait: retrato exibido ao lado do texto;
 * - banner: recorte da ilustração do labirinto exibido no topo da janela;
 * - text: o texto em si. "{nome}" e "{um}" são trocados pelos dados do herói.
 */
"use strict";

const STORY = Object.freeze({
  intro: {
    title: "Prólogo",
    pages: [
      {
        eyebrow: "Creta, no tempo do rei Minos",
        banner: "map",
        text: "Há nove anos, Atenas perdeu a guerra contra Creta. O preço da paz: a cada nove anos, catorze jovens atenienses são levados ao Labirinto, onde vive o Minotauro.\nDiante do altar de Zeus, Minos jurou: \"Se o Minotauro cair, a dívida de Atenas estará paga para sempre.\"",
      },
      {
        eyebrow: "{nome}, da guarda de Atenas",
        portrait: "player",
        text: "Você é {um} da guarda da cidade. Seu nome não saiu no sorteio: você se ofereceu.\nSeu objetivo não é sobreviver ao tributo. É acabar com ele. Se o Minotauro cair, nenhum jovem de Atenas será mandado a Creta outra vez.",
      },
      {
        eyebrow: "Uma mensagem da torre",
        banner: "tower",
        text: "Dédalo, o arquiteto do Labirinto, vive preso numa torre com o filho, Ícaro. Ele manda um bilhete:\n\"O Labirinto tem saída: a Porta do Sol. Minos a trancou com quatro Selos de bronze e deu cada um a uma criatura: os Escorpiões Gigantes, a Medusa, a Hidra de Lerna e o Minotauro. Sem os quatro, ninguém sai.\"",
      },
      {
        eyebrow: "O fio e o companheiro",
        portrait: "companion",
        text: "\"Meu filho Ícaro vai com você. Leve também este novelo de fio dourado: ele marca no chão cada passo seu.\nQuando a Porta do Sol se abrir, os selos também quebram as correntes da nossa torre.\"",
      },
      {
        eyebrow: "A entrada",
        banner: "gate",
        text: "O portão de bronze se fecha atrás de vocês. À frente fica o Anel Externo: corredores de areia, espinhos no chão e o som de ferrões arranhando a pedra.",
      },
    ],
  },
  level0: {
    title: "Anel Externo",
    pages: [
      { eyebrow: "Ícaro", portrait: "companion", text: "Os escorpiões estão na arena marcada em vermelho no mapa. Os espinhos do chão sobem num ritmo: espere descerem para passar." },
    ],
  },
  level1: {
    title: "Anel das Estátuas",
    pages: [
      { eyebrow: "Ícaro", portrait: "companion", text: "Essas estátuas eram jovens de outros tributos. A Medusa os petrificou." },
      { eyebrow: "Ícaro", portrait: "companion", text: "Quando os olhos dela brilharem, segure o escudo (Shift). O bronze devolve o olhar para ela." },
    ],
  },
  level2: {
    title: "Anel Alagado",
    pages: [
      { eyebrow: "Ícaro", portrait: "companion", text: "A água deixa os passos lentos. A Hidra está no fundo do pântano." },
      { eyebrow: "Ícaro", portrait: "companion", text: "Cabeças cortadas renascem. Só o fogo impede: jogue uma tocha nela (R). Tome, esta é a primeira." },
    ],
  },
  level3: {
    title: "O Coração do Labirinto",
    pages: [
      { eyebrow: "Ícaro", portrait: "companion", text: "O Minotauro está no centro. Quando ele raspar o chão, vai investir em linha reta." },
      { eyebrow: "Ícaro", portrait: "companion", text: "Saia da linha vermelha ou segure o escudo. Se ele bater na parede, fica tonto: aí é a hora de atacar." },
    ],
  },
  level4: {
    title: "A Fuga",
    pages: [
      { eyebrow: "Selo do Sol", portrait: "mino", text: "O Minotauro caiu. Os quatro selos brilham e, em algum lugar, uma porta dourada range." },
      { eyebrow: "Ícaro", portrait: "companion", text: "O Labirinto está desabando! A Porta do Sol está marcada em dourado no mapa. Corra!" },
    ],
  },
  victory_scorp: {
    title: "Selo de Areia",
    pages: [{ eyebrow: "Selo de Areia · 1 de 4", portrait: "scorp", text: "O Selo de Areia é seu. A escada no centro da arena desce para o próximo anel." }],
  },
  victory_medusa: {
    title: "Selo de Pedra",
    pages: [{ eyebrow: "Selo de Pedra · 2 de 4", portrait: "medusa", text: "A Medusa caiu. As estátuas racham e dois jovens atenienses voltam a respirar. Eles seguirão o seu fio." }],
  },
  victory_hydra: {
    title: "Selo das Águas",
    pages: [{ eyebrow: "Selo das Águas · 3 de 4", portrait: "hydra", text: "A última cabeça afunda no pântano. Falta apenas o coração do Labirinto." }],
  },
  ending: {
    title: "Epílogo",
    pages: [
      { eyebrow: "A Porta do Sol", banner: "gate", text: "Você atravessa a Porta do Sol com Ícaro e os treze jovens atenienses. Atrás de vocês, o Labirinto desaba sobre si mesmo." },
      { eyebrow: "O juramento cumprido", banner: "map", text: "Preso ao próprio juramento diante de Zeus, Minos declara a dívida paga. Nenhum jovem de Atenas será mandado a Creta outra vez." },
      { eyebrow: "Asas de penas e cera", banner: "tower", text: "Naquela noite, os selos quebram as correntes da torre. Da praia, você vê duas figuras com asas de penas cruzarem o céu.\nDédalo e Ícaro estão livres. E {nome} volta para casa." },
    ],
  },
});

/** Anotações de Dédalo: uma por anel, encontradas como pergaminhos no chão. */
const DAEDALUS_NOTES = Object.freeze([
  "Minos me pediu uma prisão da qual nada escapasse. Construí uma prisão da qual só se sai com paciência.",
  "Os corredores parecem iguais de propósito. Quem marca o caminho não anda em círculos. Por isso o fio.",
  "Ícaro pergunta se um dia vamos voar para longe daqui. Ando juntando penas e cera.",
  "O Minotauro não escolheu nascer assim. Minos o escondeu aqui para esconder a própria vergonha.",
  "A Porta do Sol se abre para o leste, na direção de Atenas. Siga a luz.",
]);

/** Prefixo do identificador das anotações no diário ("note0", "note1"...). */
const NOTE_ID_PREFIX = "note";

/**
 * Troca os marcadores do texto pelos dados do herói atual.
 * @param {string} text
 * @returns {string}
 */
function personalize(text) {
  const hero = game.save ? game.save.hero : null;
  const isFemale = hero && hero.gender === "f";
  return text
    .replace(/\{nome\}/g, hero ? hero.name : "")
    .replace(/\{um\}/g, isFemale ? "uma guerreira" : "um guerreiro");
}

/**
 * Título de uma entrada do diário.
 * @param {string} entryId identificador de um trecho de STORY ou de uma anotação
 * @returns {string}
 */
function journalTitle(entryId) {
  if (entryId.startsWith(NOTE_ID_PREFIX)) {
    const noteNumber = Number(entryId.slice(NOTE_ID_PREFIX.length)) + 1;
    return `Anotações de Dédalo, página ${noteNumber}`;
  }
  return STORY[entryId].title;
}

/**
 * Monta um trecho de história (no formato de STORY) para uma anotação de Dédalo.
 * @param {number} index
 * @returns {{title: string, pages: object[]}}
 */
function noteAsStory(index) {
  return {
    title: "Anotações de Dédalo",
    pages: [{ eyebrow: `Página ${index + 1} de ${DAEDALUS_NOTES.length}`, portrait: "scroll", text: DAEDALUS_NOTES[index] }],
  };
}
