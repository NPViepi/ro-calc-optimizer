// Gerado por tools/build-chance-effects.mjs — não edite à mão.
// Efeitos de ativação (`chance__*`) com gatilho explícito na descrição pt-BR.

export type ChanceTrigger = 'physical' | 'magical' | 'any' | 'skill';

export interface ChanceEffect {
  /** Chance por tentativa, em %. */
  chance: number;
  /** Duração, em segundos. */
  duration: number;
  /** `physical`/`magical`/`any`: sorteia a cada golpe desse tipo; `skill`: a cada uso de `skill`. */
  trigger: ChanceTrigger;
  /** Nome pt-BR da skill que ativa (gatilho `skill`). */
  skill?: string;
}

export const CHANCE_EFFECTS: Readonly<Record<number, ChanceEffect>> = {
  1336: { chance: 3, duration: 10, trigger: 'physical' }, // Machado Real
  1847: { chance: 3, duration: 7, trigger: 'physical' }, // Garra Ancestral
  1867: { chance: 3, duration: 10, trigger: 'physical' }, // Luva de Segurança
  1870: { chance: 3, duration: 10, trigger: 'physical' }, // Soqueira Real
  2048: { chance: 3, duration: 7, trigger: 'magical' }, // Cetro Ancestral
  2058: { chance: 3, duration: 10, trigger: 'magical' }, // Bastão Detector
  2060: { chance: 3, duration: 10, trigger: 'magical' }, // Cetro Real
  4425: { chance: 0.5, duration: 10, trigger: 'physical' }, // Carta Atroce
  4671: { chance: 3, duration: 6, trigger: 'magical' }, // Carta Feiticeira Celia
  4672: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Shura Chen
  4673: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Trovador Alphoccio
  4674: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Sicário Eremes
  4675: { chance: 3, duration: 6, trigger: 'magical' }, // Carta Arcebispa Margaretha
  4676: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Sentinela Cecil
  4677: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Mecânico Howard
  4678: { chance: 3, duration: 6, trigger: 'magical' }, // Carta Arcana Kathryne
  4679: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Cavaleiro Rúnico Seyren
  4680: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Guardião Real Randel
  4681: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Bioquímico Flamel
  4682: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Renegada Gertie
  4683: { chance: 3, duration: 6, trigger: 'physical' }, // Carta Musa Trentini
  4876: { chance: 1.5, duration: 10, trigger: 'magical' }, // Epifania
  4877: { chance: 1, duration: 5, trigger: 'physical' }, // Ânimo
  4879: { chance: 3, duration: 5, trigger: 'physical' }, // Instinto
  4880: { chance: 1.5, duration: 5, trigger: 'any' }, // Euforia
  13345: { chance: 3, duration: 7, trigger: 'physical' }, // Shuriken Huuma Ancestral
  13346: { chance: 3, duration: 10, trigger: 'physical' }, // Disco Diamantado
  13347: { chance: 3, duration: 10, trigger: 'physical' }, // Shuriken Huuma Real
  13485: { chance: 3, duration: 7, trigger: 'physical' }, // Sabre Ancestral
  15097: { chance: 0.3, duration: 10, trigger: 'physical' }, // Veste Heroica
  16099: { chance: 3, duration: 10, trigger: 'magical' }, // Martelo de Borracha
  18170: { chance: 3, duration: 7, trigger: 'physical' }, // Arco Ancestral
  18174: { chance: 5, duration: 10, trigger: 'physical' }, // Arco de Caça Ilusional
  18190: { chance: 3, duration: 10, trigger: 'physical' }, // Parafusadeira
  18191: { chance: 3, duration: 10, trigger: 'physical' }, // Catapulta Real
  18198: { chance: 3, duration: 10, trigger: 'physical' }, // Arco Real
  19191: { chance: 5, duration: 5, trigger: 'physical' }, // Boné Maratonista Mortal
  21038: { chance: 3, duration: 7, trigger: 'physical' }, // Espada Ancestral
  21054: { chance: 3, duration: 5, trigger: 'physical' }, // Terçado
  21055: { chance: 3, duration: 10, trigger: 'physical' }, // Claymore Real
  24539: { chance: 30, duration: 5, trigger: 'physical' }, // Manopla Sombria do Katar
  26118: { chance: 3, duration: 7, trigger: 'magical' }, // Cajado Ancestral
  26151: { chance: 4, duration: 10, trigger: 'magical' }, // Rutilus-OS
  26154: { chance: 3, duration: 7, trigger: 'magical' }, // Pêndulo Ancestral
  26155: { chance: 3, duration: 7, trigger: 'any' }, // Cauda de Gato Ancestral
  26162: { chance: 3, duration: 10, trigger: 'magical' }, // Varinha de Solda
  26165: { chance: 3, duration: 10, trigger: 'magical' }, // Cruz Real
  26166: { chance: 3, duration: 10, trigger: 'magical' }, // Varinha Real
  26172: { chance: 3, duration: 10, trigger: 'any' }, // Cauda de Gato Real
  26215: { chance: 3, duration: 10, trigger: 'physical' }, // Fita Métrica
  26216: { chance: 3, duration: 10, trigger: 'magical' }, // Chicote Real
  27109: { chance: 3, duration: 6, trigger: 'any' }, // Carta Jitterbug
  28045: { chance: 3, duration: 10, trigger: 'physical' }, // Alicate
  28046: { chance: 3, duration: 10, trigger: 'physical' }, // Katar Real
  28130: { chance: 3, duration: 7, trigger: 'any' }, // Cutelo Ancestral
  28140: { chance: 3, duration: 10, trigger: 'physical' }, // Motosserra
  28141: { chance: 3, duration: 10, trigger: 'physical' }, // Lábris Real
  28254: { chance: 5, duration: 10, trigger: 'skill', skill: "Expurgar" }, // Retalhadora Ilusional
  28257: { chance: 3, duration: 7, trigger: 'physical' }, // Lança-Granadas Ancestral
  28258: { chance: 3, duration: 7, trigger: 'physical' }, // Gatling Ancestral
  28635: { chance: 3, duration: 10, trigger: 'physical' }, // Manual de Segurança
  28636: { chance: 3, duration: 10, trigger: 'magical' }, // Livro Real
  28762: { chance: 5, duration: 10, trigger: 'magical' }, // Bazerald Ilusional
  28763: { chance: 3, duration: 7, trigger: 'physical' }, // Kodachi Ancestral
  28768: { chance: 5, duration: 10, trigger: 'physical' }, // Adaga Platina
  28771: { chance: 3, duration: 10, trigger: 'physical' }, // Detector de Metal
  28772: { chance: 3, duration: 10, trigger: 'magical' }, // Detector de Joias
  28776: { chance: 3, duration: 10, trigger: 'magical' }, // Punhal Real
  29311: { chance: 1, duration: 3, trigger: 'physical' }, // Maratona Rúnica 2
  29312: { chance: 3, duration: 5, trigger: 'physical' }, // Maratona Rúnica 3
  29317: { chance: 1, duration: 5, trigger: 'physical' }, // Maratona Mecânica 2
  29318: { chance: 3, duration: 10, trigger: 'physical' }, // Maratona Mecânica 3
  29548: { chance: 3, duration: 10, trigger: 'magical' }, // L-Sortilégio
  29549: { chance: 3, duration: 10, trigger: 'physical' }, // L-Astúcia
  29550: { chance: 3, duration: 10, trigger: 'physical' }, // L-Superpoder
  29551: { chance: 3, duration: 10, trigger: 'physical' }, // L-Lampejo
  29552: { chance: 3, duration: 10, trigger: 'magical' }, // L-Fortuna
  32018: { chance: 3, duration: 7, trigger: 'physical' }, // Lança Ancestral
  32026: { chance: 3, duration: 10, trigger: 'physical' }, // Britadeira
  32027: { chance: 3, duration: 10, trigger: 'physical' }, // Lança Real
  32110: { chance: 3, duration: 10, trigger: 'physical' }, // Sinalizador Sonoro
  32111: { chance: 3, duration: 10, trigger: 'magical' }, // Alaúde Real
  32302: { chance: 3, duration: 7, trigger: 'physical' }, // Revólver Ancestral
  32303: { chance: 3, duration: 10, trigger: 'physical' }, // Furadeira
  32304: { chance: 3, duration: 10, trigger: 'physical' }, // Revólver Real
  32353: { chance: 3, duration: 10, trigger: 'any' }, // Espada Real
  32401: { chance: 3, duration: 10, trigger: 'physical' }, // Clava Real
  32402: { chance: 3, duration: 10, trigger: 'physical' }, // Seringa Real
  32403: { chance: 3, duration: 10, trigger: 'physical' }, // Bengala Real
  300242: { chance: 3, duration: 7, trigger: 'physical' }, // Carta Quve Fantasma
  300243: { chance: 4, duration: 7, trigger: 'magical' }, // Carta Lude Alhita
  310122: { chance: 3, duration: 10, trigger: 'magical' }, // F-Sortilégio
  310123: { chance: 3, duration: 10, trigger: 'physical' }, // F-Astúcia
  310124: { chance: 3, duration: 10, trigger: 'physical' }, // F-Superpoder
  310125: { chance: 3, duration: 10, trigger: 'physical' }, // F-Lampejo
  310126: { chance: 3, duration: 10, trigger: 'magical' }, // F-Fortuna
  310609: { chance: 3, duration: 10, trigger: 'physical' }, // Orbe Lupino - Eternidade
  310610: { chance: 3, duration: 10, trigger: 'magical' }, // Orbe Lupino - Sortilégio
  310611: { chance: 3, duration: 10, trigger: 'physical' }, // Orbe Lupino - Astúcia
  310612: { chance: 3, duration: 10, trigger: 'physical' }, // Orbe Lupino - Superpoder
  310613: { chance: 3, duration: 10, trigger: 'physical' }, // Orbe Lupino - Lampejo
  310614: { chance: 3, duration: 10, trigger: 'magical' }, // Orbe Lupino - Fortuna
  310908: { chance: 3, duration: 10, trigger: 'physical' }, // FOR Ancestral
  310909: { chance: 3, duration: 10, trigger: 'physical' }, // SOR Ancestral
  310910: { chance: 3, duration: 10, trigger: 'physical' }, // DES Ancestral
  310911: { chance: 1.5, duration: 10, trigger: 'magical' }, // INT Ancestral
  310913: { chance: 3, duration: 10, trigger: 'physical' }, // AGI Ancestral
  311120: { chance: 3, duration: 10, trigger: 'physical' }, // Flor Invernal (Eternidade)
  311121: { chance: 3, duration: 10, trigger: 'magical' }, // Flor Invernal (Sortilégio)
  311122: { chance: 3, duration: 10, trigger: 'physical' }, // Flor Invernal (Astúcia)
  311123: { chance: 3, duration: 10, trigger: 'physical' }, // Flor Invernal (Superpoder)
  311124: { chance: 3, duration: 10, trigger: 'physical' }, // Flor Invernal (Lampejo)
  311125: { chance: 3, duration: 10, trigger: 'magical' }, // Flor Invernal (Fortuna)
  400152: { chance: 5, duration: 10, trigger: 'physical' }, // Chapéu Transformacento-LT
  400153: { chance: 7, duration: 10, trigger: 'any' }, // Orelhinhas da Wickebine-LT
  400155: { chance: 7, duration: 60, trigger: 'any' }, // Chapéu de Dourado-LT
  400156: { chance: 7, duration: 60, trigger: 'any' }, // Chapéu de Imp-LT
  400245: { chance: 1.5, duration: 7, trigger: 'physical' }, // Chapéu de Eddga-LT
  400246: { chance: 1.5, duration: 7, trigger: 'magical' }, // Boneca da Lady Branca-LT
  450192: { chance: 3, duration: 7, trigger: 'physical' }, // Cota de Naga Runificada
  470033: { chance: 3, duration: 5, trigger: 'physical' }, // Bota Elemental
  470066: { chance: 3, duration: 10, trigger: 'physical' }, // Sapato Corredor Ilusional
  470071: { chance: 5, duration: 10, trigger: 'physical' }, // Bota Desconhecida FOR
  470072: { chance: 5, duration: 10, trigger: 'any' }, // Bota Desconhecida DES
  470073: { chance: 5, duration: 10, trigger: 'any' }, // Bota Desconhecida VIT
  470074: { chance: 5, duration: 10, trigger: 'magical' }, // Bota Desconhecida INT
  470076: { chance: 5, duration: 10, trigger: 'physical' }, // Bota Desconhecida AGI
  470077: { chance: 5, duration: 10, trigger: 'physical' }, // Bota Desconhecida SOR
  500003: { chance: 3, duration: 7, trigger: 'magical' }, // Vingadora Ancestral
  500004: { chance: 3, duration: 7, trigger: 'any' }, // Lâmina Ancestral
  510006: { chance: 3, duration: 7, trigger: 'physical' }, // Adaga Ancestral
  510034: { chance: 2, duration: 10, trigger: 'magical' }, // Ritualística Ilusional
  510070: { chance: 3, duration: 7, trigger: 'physical' }, // Faca Ancestral
  550006: { chance: 3, duration: 10, trigger: 'any' }, // Cabo de Aço
  550007: { chance: 3, duration: 7, trigger: 'magical' }, // Feitiço Ancestral
  550080: { chance: 3, duration: 7, trigger: 'magical' }, // Bastão Ancestral
  560002: { chance: 3, duration: 7, trigger: 'physical' }, // Soqueira Ancestral
  570002: { chance: 3, duration: 7, trigger: 'any' }, // Ocarina Ancestral
  580002: { chance: 3, duration: 7, trigger: 'any' }, // Concertina Ancestral
  590002: { chance: 3, duration: 7, trigger: 'any' }, // Maça Ancestral
  590003: { chance: 3, duration: 7, trigger: 'magical' }, // Clava Ancestral
  600004: { chance: 3, duration: 7, trigger: 'physical' }, // Bastarda Ancestral
  610003: { chance: 3, duration: 7, trigger: 'physical' }, // Jur Ancestral
  630006: { chance: 5, duration: 10, trigger: 'skill', skill: "Lança do Destino" }, // Brionac Ilusional
  640004: { chance: 3, duration: 7, trigger: 'magical' }, // Báculo Ancestral
  700003: { chance: 3, duration: 7, trigger: 'physical' }, // Gakkung Ancestral
};
