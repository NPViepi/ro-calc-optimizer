/**
 * Limites de encantamento por item, conforme a bROWiki. O simulador do upstream não modela
 * esses limites (ver o comentário de `capaceteBP` em `_enchant_table.ts`), então o otimizador
 * os aplica por conta própria para não sugerir builds que o jogo não deixa montar.
 *
 * Tudo é por id (itens e encantamentos), conferido contra `item.json`/`latam-items.json`.
 * Para acrescentar uma família: crie uma regra com os ids das peças, o limite de cópias por
 * encantamento (`perEnchant`) e, se a wiki disser, limites de grupo (`groups`).
 */

export interface EnchantGroupLimit {
  label: string;
  /** Ids dos encantamentos do grupo. */
  enchants: number[];
  /** Máximo de encantamentos do grupo no mesmo item (somando todas as cópias). */
  max: number;
}

export interface EnchantLimitRule {
  label: string;
  /** Ids das peças às quais a regra vale. */
  items: number[];
  /** Encantamento → máximo de cópias no mesmo item. */
  perEnchant: Record<number, number>;
  groups?: EnchantGroupLimit[];
  source: string;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

// ── Automatron ────────────────────────────────────────────────────────────────────────────
// https://browiki.org/wiki/Equipamentos_Automatron — "Os equipamentos podem ser encantados
// até 3 vezes, mas cada encanto específico possui um limite." Os acessórios "Ac. D." são as
// peças R (Turbina/Soquete A) e "Ac. E." as L (B), o que confere com os pools da tabela.

const AUTOMATRON_ARMOR = [450127, 450128];
const AUTOMATRON_ENGINE = [480020, 480021];
const AUTOMATRON_LEG = [470022, 470023];
const AUTOMATRON_SHIELD = [460157, 460158];
const AUTOMATRON_ACC = [490024, 490025, 490026, 490027];

/** H- Habilidade (Automatic_Orb46–96): "x2" cada. */
const AUTOMATRON_SKILL = range(310127, 310177);
/** F- Fantástico: "Apenas 2 encantos Fantásticos podem ser adicionados, mas não podem ser repetidos." */
const AUTOMATRON_FANTASTIC = range(310121, 310126);

const AUTOMATRON_LIMITS: Record<number, number> = {
  // B- Básico
  310086: 2, 310087: 2, 310084: 2, 310088: 2, 310089: 2, 310085: 2, // FOR AGI VIT INT DES SOR
  310082: 3, 310083: 3, // DEF DEFM
  // M- Mediano
  310090: 2, 310091: 2, // HPR SPR
  310092: 1, 310093: 1, 310094: 1, 310095: 1, // Encanto Atraso Fatal Mira
  310096: 2, 310097: 2, 310098: 2, // HPMax SPMax Cura
  310099: 2, 310100: 2, 310101: 2, // ATQ ATQM Tiro
  310102: 2, 310103: 2, 310104: 2, // Rapidez Magia CRIT
  // P- Perfeito
  310105: 1, 310106: 1, 310107: 1, 310108: 1, 310109: 1, 310110: 1, 310117: 1, 310178: 1, // Mágico… Espelho
  310112: 1, 310119: 1, 310179: 1, // Total Dano Refletor
  310113: 1, 310115: 1, 310114: 1, 310116: 1, 310120: 1, // Vida Mental Alma Mana Geral
  310118: 1, 310111: 1, // Robusto Fixa
  // F- Fantástico
  ...Object.fromEntries(AUTOMATRON_FANTASTIC.map((id) => [id, 1])),
  // H- Habilidade
  ...Object.fromEntries(AUTOMATRON_SKILL.map((id) => [id, 2])),
};

// ── Ilusión ───────────────────────────────────────────────────────────────────────────────
// https://browiki.org/wiki/Equipamentos_Ilusión — mesma regra das 3 vezes com limite por
// encanto; "Apenas 1 encanto Lendário pode ser adicionado". A wiki não traz a coluna do
// Escudo Ilusión: ele recebe os mesmos limites das outras peças (os pools coincidem).

const ILLUSION_ITEMS = [
  15376, 15377, 450147, 450148, // Colete (+ [Apoio])
  20933, 20934, 480062, 480063, // Motor
  22196, 22197, 470054, 470055, // Perna
  32207, 32208, 32209, 32210, 490072, 490073, 490074, 490075, // Turbina/Soquete
  460004, 460014, // Escudo
];

const ILLUSION_LEGENDARY = range(29547, 29552);

const ILLUSION_LIMITS: Record<number, number> = {
  4702: 3, 4732: 3, 4742: 3, 4712: 3, 4722: 3, 4752: 3, // FOR AGI VIT INT DES SOR +3
  29527: 3, 29528: 3, // N-DEF N-DEFM
  4826: 1, 4881: 1, 4866: 1, 4836: 1, // Pedra de Encantamento 5, Anti-Atraso 4, Fatal 4, Mira Apurada 5
  29531: 2, 29533: 2, // S-HPMax S-Cura
  29534: 2, 29535: 2, 29536: 2, // S-ATQ S-ATQM S-Tiro
  29537: 2, 29538: 2, 29539: 2, // S-Rapidez S-Magia S-CRIT
  29540: 1, 29541: 1, 29542: 1, 29545: 1, 29546: 1, // U-Pós U-Fixa U-Total U-Mental U-Mana
  ...Object.fromEntries(ILLUSION_LEGENDARY.map((id) => [id, 1])),
};

export const ENCHANT_LIMIT_RULES: readonly EnchantLimitRule[] = [
  {
    label: 'Automatron',
    items: [...AUTOMATRON_ARMOR, ...AUTOMATRON_ENGINE, ...AUTOMATRON_LEG, ...AUTOMATRON_ACC],
    perEnchant: AUTOMATRON_LIMITS,
    groups: [{ label: 'Fantásticos', enchants: AUTOMATRON_FANTASTIC, max: 2 }],
    source: 'https://browiki.org/wiki/Equipamentos_Automatron',
  },
  {
    // Igual às outras peças, menos M-Rapidez: "Motor x2; Escudo x1".
    label: 'Escudo Automatron',
    items: AUTOMATRON_SHIELD,
    perEnchant: { ...AUTOMATRON_LIMITS, 310102: 1 },
    groups: [{ label: 'Fantásticos', enchants: AUTOMATRON_FANTASTIC, max: 2 }],
    source: 'https://browiki.org/wiki/Equipamentos_Automatron',
  },
  {
    label: 'Ilusión',
    items: ILLUSION_ITEMS,
    perEnchant: ILLUSION_LIMITS,
    groups: [{ label: 'Lendários', enchants: ILLUSION_LEGENDARY, max: 1 }],
    source: 'https://browiki.org/wiki/Equipamentos_Ilusión',
  },
  {
    // "Encantos dos Capacetes" — coluna "Limite".
    label: 'Capacetes do Passe de Batalha',
    items: [401433, 401434, 401435],
    perEnchant: {
      313365: 2, // Encanto de Ataque
      313366: 2, // Encanto de Poder
      310105: 2, // P-Mágico
      313367: 2, // Encanto de Conjuração
      313368: 2, // Encanto de Talento
      313369: 1, // Encanto Decadente
      313370: 1, // Encanto Fortificado
      313371: 1, // Encanto de Sucata
    },
    source: 'https://browiki.org/wiki/Passe_de_Batalha',
  },
];
