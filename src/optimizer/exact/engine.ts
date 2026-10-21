/**
 * Motor de busca exata (DFS) — genérico, sem nada de Ragnarok.
 *
 * Garantias (ver `src/optimizer/exact/README.md`):
 * - Toda conclusão válida é visitada, exceto as eliminadas por:
 *   1. `apply` devolvendo `{ pruned }` — o problema só pode fazer isso quando a escolha viola uma
 *      restrição de forma **irreversível** (nenhuma conclusão daquele estado é válida);
 *   2. o limite superior (`problem.upperBound`), **só** quando `useUpperBound` é ligado e o
 *      problema documenta a prova de que `bound(estado) ≥ score(qualquer conclusão)`.
 * - Heurísticas só mudam a **ordem** de `Decision.choices`; nunca o conjunto.
 * - `OPTIMAL` só sai quando a pilha esvazia (árvore inteira explorada ou podada com prova).
 *   Parada antes disso = `INTERRUPTED`, com cursor para retomar.
 *
 * DFS iterativo com pilha explícita: permite pausar a qualquer momento (execução fatiada no
 * Web Worker, para receber "parar") e salvar um cursor exato para retomar sem perder nem repetir
 * trabalho.
 */

export interface Decision<C> {
  /** Identifica a decisão (ex.: `weapon`, `weaponCard1`). Só para métricas e depuração. */
  key: string;
  /** Todas as escolhas compatíveis, na ordem de exploração (a ordem pode ser heurística). */
  choices: C[];
}

export type ApplyResult<St> = { state: St } | { pruned: string };

export interface UpperBoundSpec<St, Sc> {
  name: string;
  /** Por que `bound(estado)` nunca fica abaixo do melhor score alcançável a partir do estado. */
  proof: string;
  bound(state: St): Sc;
}

export interface SearchProblem<St, C, Sc> {
  root(): St;
  isComplete(state: St): boolean;
  /** Próxima decisão de um estado incompleto. Deve ser determinística (para retomar). */
  nextDecision(state: St): Decision<C>;
  apply(state: St, decision: Decision<C>, choice: C): ApplyResult<St>;
  /** Score de uma build completa. */
  evaluate(state: St): Sc;
  /** > 0: `a` melhor; 0: empate; < 0: pior. */
  compare(a: Sc, b: Sc): number;
  /** Chave canônica de uma build completa (para não repetir empates). */
  keyOf?(state: St): string;
  upperBound?: UpperBoundSpec<St, Sc>;
}

export type SearchMode = 'best' | 'allTies' | 'enumerate';

/**
 * - `OPTIMAL`: busca completa; a melhor build é ótima (no modo `allTies`, todas as empatadas).
 * - `BEST_FOUND`: só em progresso — há build válida, mas a otimalidade ainda não foi provada.
 * - `INTERRUPTED`: parou antes do fim (cancelado, tempo, limite de folhas); há cursor para retomar.
 * - `NO_SOLUTION`: busca completa sem nenhuma build válida.
 * - `COMPLETE`: modo `enumerate` terminou (todas as builds válidas visitadas).
 * - `ERROR`: o resultado não é confiável.
 */
export type SearchStatus = 'OPTIMAL' | 'BEST_FOUND' | 'INTERRUPTED' | 'NO_SOLUTION' | 'COMPLETE' | 'ERROR';

export interface SearchStats {
  /** Estados gerados (aplicações de escolha). */
  nodes: number;
  /** Builds completas avaliadas (ou visitadas, no modo `enumerate`). */
  leaves: number;
  /** Podas por motivo (`upperBound`, `noCandidate` e os motivos do problema). */
  pruned: Record<string, number>;
  depth: number;
  maxDepth: number;
  elapsedMs: number;
  /** Fração da árvore já explorada ou podada (0–1), pela posição do cursor. */
  progress: number;
}

export interface BestSet<St, Sc> {
  score: Sc;
  /** Uma build (`best`) ou todas as empatadas (`allTies`). */
  states: St[];
}

export interface SearchCheckpoint<Sc, Ser> {
  /** Índices das escolhas em andamento por profundidade; o último é a próxima a tentar. */
  cursor: number[];
  best?: { score: Sc; states: Ser[] };
  stats: SearchStats;
  mode: SearchMode;
  useUpperBound: boolean;
}

export interface SearchResult<St, Sc> {
  status: SearchStatus;
  best?: BestSet<St, Sc>;
  stats: SearchStats;
  error?: string;
}

export interface SearchOptions<St, Sc, Ser = St> {
  mode?: SearchMode;
  /** Usar `problem.upperBound` para podar. Padrão: false. */
  useUpperBound?: boolean;
  /** Chamado a cada build no modo `enumerate` (e, nos outros, a cada build avaliada). */
  onLeaf?: (state: St, score: Sc | undefined) => void;
  /** No modo `enumerate`, avaliar cada build (padrão: false). */
  evaluateInEnumerate?: boolean;
  shouldStop?: () => boolean;
  /** Tempo máximo desta execução (ms). Ausente = sem limite. */
  timeLimitMs?: number;
  /** Para testes: interromper depois de N folhas. */
  maxLeaves?: number;
  onProgress?: (snapshot: { status: SearchStatus; stats: SearchStats; best?: BestSet<St, Sc> }) => void;
  progressEveryMs?: number;
  onCheckpoint?: (checkpoint: SearchCheckpoint<Sc, Ser>) => void;
  checkpointEveryMs?: number;
  serialize?: (state: St) => Ser;
  deserialize?: (data: Ser) => St;
  resume?: SearchCheckpoint<Sc, Ser>;
}

interface Frame<St, C> {
  state: St;
  decision: Decision<C>;
  next: number;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class ExactSearch<St, C, Sc, Ser = St> {
  private readonly stack: Frame<St, C>[] = [];
  private best?: BestSet<St, Sc>;
  private readonly tieKeys = new Set<string>();
  readonly stats: SearchStats;
  private readonly mode: SearchMode;
  private readonly bounding: boolean;
  private started = false;
  private finished = false;
  private interrupted = false;
  private error?: string;
  private baseElapsed = 0;
  private runStarted = 0;
  private lastProgress = 0;
  private lastCheckpoint = 0;

  constructor(private readonly problem: SearchProblem<St, C, Sc>, private readonly options: SearchOptions<St, Sc, Ser> = {}) {
    this.mode = options.resume?.mode ?? options.mode ?? 'best';
    this.bounding = (options.resume?.useUpperBound ?? options.useUpperBound ?? false) && this.mode !== 'enumerate';
    if (this.bounding && !problem.upperBound) throw new Error('useUpperBound sem upperBound no problema.');
    this.stats = options.resume
      ? { ...options.resume.stats, pruned: { ...options.resume.stats.pruned } }
      : { nodes: 0, leaves: 0, pruned: {}, depth: 0, maxDepth: 0, elapsedMs: 0, progress: 0 };
    this.baseElapsed = this.stats.elapsedMs;
  }

  private get serialize() { return this.options.serialize ?? ((state: St) => state as unknown as Ser); }

  private get deserialize() { return this.options.deserialize ?? ((data: Ser) => data as unknown as St); }

  private prune(reason: string) {
    this.stats.pruned[reason] = (this.stats.pruned[reason] ?? 0) + 1;
  }

  private start() {
    this.started = true;
    const resume = this.options.resume;
    if (resume?.best) {
      this.best = { score: resume.best.score, states: resume.best.states.map(this.deserialize) };
      if (this.problem.keyOf) for (const state of this.best.states) this.tieKeys.add(this.problem.keyOf(state));
    }
    const root = this.problem.root();
    if (this.problem.isComplete(root)) {
      if (!resume) this.leaf(root);
      return;
    }
    if (resume) {
      if (!resume.cursor.length) return; // a execução salva já tinha terminado
      let state = root;
      resume.cursor.forEach((index, depth) => {
        const decision = this.problem.nextDecision(state);
        if (index > decision.choices.length) throw new Error('Checkpoint incompatível com o problema atual.');
        const frame: Frame<St, C> = { state, decision, next: index };
        this.stack.push(frame);
        if (depth < resume.cursor.length - 1) {
          const result = this.problem.apply(state, decision, decision.choices[index]);
          if (!('state' in result)) throw new Error('Checkpoint incompatível: o caminho salvo foi podado.');
          frame.next = index + 1;
          state = result.state;
        }
      });
      return;
    }
    if (this.bounding && this.boundPrunes(root)) return;
    const decision = this.problem.nextDecision(root);
    if (!decision.choices.length) { this.prune('noCandidate'); return; }
    this.stack.push({ state: root, decision, next: 0 });
  }

  private boundPrunes(state: St): boolean {
    if (!this.best) return false;
    const bound = this.problem.upperBound!.bound(state);
    const comparison = this.problem.compare(bound, this.best.score);
    // Uma build ótima basta: empatar não ajuda. Todas as empatadas: só poda se for estritamente pior.
    const prunes = this.mode === 'allTies' ? comparison < 0 : comparison <= 0;
    if (prunes) this.prune('upperBound');
    return prunes;
  }

  private leaf(state: St) {
    this.stats.leaves++;
    if (this.mode === 'enumerate') {
      const score = this.options.evaluateInEnumerate ? this.problem.evaluate(state) : undefined;
      this.options.onLeaf?.(state, score);
      return;
    }
    const score = this.problem.evaluate(state);
    this.options.onLeaf?.(state, score);
    const comparison = this.best ? this.problem.compare(score, this.best.score) : 1;
    if (comparison > 0) {
      this.best = { score, states: [state] };
      this.tieKeys.clear();
      if (this.problem.keyOf) this.tieKeys.add(this.problem.keyOf(state));
    } else if (comparison === 0 && this.mode === 'allTies' && this.best) {
      const key = this.problem.keyOf?.(state);
      if (key === undefined || !this.tieKeys.has(key)) {
        if (key !== undefined) this.tieKeys.add(key);
        this.best.states.push(state);
      }
    }
  }

  private updateProgress() {
    let fraction = 0;
    let scale = 1;
    this.stack.forEach((frame, depth) => {
      const total = frame.decision.choices.length || 1;
      const done = depth < this.stack.length - 1 ? frame.next - 1 : frame.next;
      fraction += scale * (Math.max(0, done) / total);
      scale /= total;
    });
    this.stats.progress = this.finished ? 1 : Math.min(1, fraction);
    this.stats.depth = this.stack.length;
    this.stats.elapsedMs = this.baseElapsed + (now() - this.runStarted);
  }

  /** Cursor exato da posição atual (vazio quando terminou). */
  checkpoint(): SearchCheckpoint<Sc, Ser> {
    this.updateProgress();
    return {
      cursor: this.stack.map((frame, depth) => (depth < this.stack.length - 1 ? frame.next - 1 : frame.next)),
      best: this.best ? { score: this.best.score, states: this.best.states.map(this.serialize) } : undefined,
      stats: { ...this.stats, pruned: { ...this.stats.pruned } },
      mode: this.mode,
      useUpperBound: this.bounding,
    };
  }

  /**
   * Avança a busca por até `budgetMs`. Devolve true quando acabou (terminou, parou ou deu erro).
   */
  step(budgetMs = Infinity): boolean {
    if (this.finished || this.interrupted || this.error) return true;
    const sliceStart = now();
    if (!this.runStarted) { this.runStarted = sliceStart; this.lastProgress = sliceStart; this.lastCheckpoint = sliceStart; }
    try {
      if (!this.started) this.start();
      const { options, problem } = this;
      let worked = false;
      while (this.stack.length) {
        const time = now();
        if (options.shouldStop?.()
          || (options.timeLimitMs != null && time - this.runStarted >= options.timeLimitMs)
          || (options.maxLeaves != null && this.stats.leaves >= options.maxLeaves)) {
          this.interrupted = true;
          break;
        }
        this.report(time);
        // Pelo menos um passo por fatia, para sempre avançar.
        if (worked && time - sliceStart >= budgetMs) return false;
        worked = true;

        const top = this.stack[this.stack.length - 1];
        if (top.next >= top.decision.choices.length) { this.stack.pop(); continue; }
        const choice = top.decision.choices[top.next++];
        const result = problem.apply(top.state, top.decision, choice);
        this.stats.nodes++;
        if (!('state' in result)) { this.prune(result.pruned); continue; }
        const child = result.state;
        if (problem.isComplete(child)) { this.leaf(child); continue; }
        if (this.bounding && this.boundPrunes(child)) continue;
        const decision = problem.nextDecision(child);
        if (!decision.choices.length) { this.prune('noCandidate'); continue; }
        this.stack.push({ state: child, decision, next: 0 });
        if (this.stack.length > this.stats.maxDepth) this.stats.maxDepth = this.stack.length;
      }
      if (!this.interrupted) this.finished = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
    this.updateProgress();
    return true;
  }

  private report(time: number) {
    const { options } = this;
    if (options.onProgress && time - this.lastProgress >= (options.progressEveryMs ?? 250)) {
      this.lastProgress = time;
      this.updateProgress();
      options.onProgress({ status: this.best ? 'BEST_FOUND' : 'INTERRUPTED', stats: this.stats, best: this.best });
    }
    if (options.onCheckpoint && time - this.lastCheckpoint >= (options.checkpointEveryMs ?? 5_000)) {
      this.lastCheckpoint = time;
      options.onCheckpoint(this.checkpoint());
    }
  }

  result(): SearchResult<St, Sc> {
    this.updateProgress();
    const stats = { ...this.stats, pruned: { ...this.stats.pruned } };
    if (this.error) return { status: 'ERROR', best: this.best, stats, error: this.error };
    if (this.interrupted || !this.finished) return { status: 'INTERRUPTED', best: this.best, stats };
    if (this.mode === 'enumerate') return { status: 'COMPLETE', stats };
    return this.best ? { status: 'OPTIMAL', best: this.best, stats } : { status: 'NO_SOLUTION', stats };
  }

  run(): SearchResult<St, Sc> {
    this.step();
    return this.result();
  }

  /** Igual a `run`, mas cede a vez a cada `sliceMs` (o worker continua recebendo mensagens). */
  async runAsync(sliceMs = 50): Promise<SearchResult<St, Sc>> {
    while (!this.step(sliceMs)) await new Promise((resolve) => setTimeout(resolve, 0));
    return this.result();
  }
}

/** Atalho: busca completa. */
export function exactSearch<St, C, Sc, Ser = St>(problem: SearchProblem<St, C, Sc>, options: SearchOptions<St, Sc, Ser> = {}) {
  return new ExactSearch(problem, options).run();
}
