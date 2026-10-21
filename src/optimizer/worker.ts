/**
 * Web Worker do otimizador: roda a busca fora da thread da página, para a tela não travar.
 *
 * Mensagens recebidas:
 *   { type: 'describe', id, request }  → { type: 'described', id, className, monsterName, skills, skillValue }
 *   { type: 'run', id, request }       → vários { type: 'progress', id, progress } e um { type: 'done', id, response }
 * Erros: { type: 'error', id, message }. Para cancelar, a página encerra o worker (`terminate()`).
 *
 * Empacotado separadamente pelo build do desktop (desktop/scripts/build-web.mjs).
 */

import { BuildProgress } from './items';
import { loadOptimizerData, OptimizeRequest, OptimizerData, prepareSession, runOptimization } from './runtime';

// O motor do upstream tem `console.log` de depuração no caminho quente; aqui eles só
// custariam tempo e encheriam o console. Erros continuam aparecendo.
console.log = () => undefined;

const scope = self as unknown as { postMessage: (message: unknown) => void; onmessage: ((event: MessageEvent) => void) | null };
let data: Promise<OptimizerData> | undefined;
const getData = () => (data ??= loadOptimizerData(fetch, '/'));

/** Progresso no máximo ~8× por segundo: a busca chama o callback muitas vezes. */
function throttledProgress(id: number) {
  let last = 0;
  return (progress: BuildProgress) => {
    const now = performance.now();
    if (now - last < 120) return;
    last = now;
    scope.postMessage({ type: 'progress', id, progress });
  };
}

scope.onmessage = async (event: MessageEvent) => {
  const { type, id, request } = event.data as { type: string; id: number; request: OptimizeRequest };
  try {
    const loaded = await getData();
    if (type === 'describe') {
      const session = prepareSession(loaded, request);
      scope.postMessage({
        type: 'described', id,
        className: session.className, monsterName: session.monsterName, skills: session.skills, skillValue: session.skillValue,
        defaults: session.defaults,
      });
    } else if (type === 'run') {
      const response = runOptimization(loaded, request, throttledProgress(id));
      scope.postMessage({ type: 'done', id, response });
    }
  } catch (error) {
    scope.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
  }
};
