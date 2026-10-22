/**
 * Correções manuais para a detecção de cartas de MVP (`mvp-cards.ts`), por id de carta.
 * `include`: cartas de MVP que o casamento por nome não pega. `exclude`: falsos positivos.
 */
export const MVP_CARD_OVERRIDES: { include: number[]; exclude: number[] } = {
  // O LATAM chama o Howard de "Harword" (Mestre-ferreiro/Mecânico Harword), então o nome da
  // carta ("Howard") não casa com o do monstro.
  include: [4361, 4677],
  exclude: [],
};
