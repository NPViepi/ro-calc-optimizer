/**
 * Tempo máximo dos testes que rodam o motor do simulador. O padrão do vitest (5 s) é curto:
 * com a suíte inteira em paralelo (e no Windows) um teste de 1–2 s passa de 5 s e falha por
 * tempo, sem nada errado no código.
 */
export const ENGINE_TIMEOUT = 60_000;
