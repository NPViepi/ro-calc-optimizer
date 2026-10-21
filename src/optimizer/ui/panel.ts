/**
 * Fase 5: painel do otimizador, injetado na página pelo app desktop (sem alterar o upstream).
 *
 * Lê a build que o próprio app salva (`localStorage['ro-set']`) e o monstro selecionado,
 * manda a busca para o Web Worker (`/optimizer/worker.js`) e mostra progresso e resultado.
 * "Aplicar" e "Comparar" abrem links `/s/<token>/` gerados com o codec de compartilhamento
 * do app, que carrega a build como se fosse um link compartilhado.
 *
 * DOM simples (sem React) para não depender do bundle do app; cores pelos tokens do tema do
 * app (`--surface-card`, `--text-color`…), com valores de reserva.
 */

import type { ConstraintCheck } from '../objective';
import type { NamedChange, OptimizeRequest, OptimizeResponse, PreparedSession, SkillOption } from '../runtime';

type Described = { className: string; monsterName: string; skills: SkillOption[]; skillValue: string; defaults: PreparedSession['defaults'] };

const WORKER_URL = '/optimizer/worker.js';

const SLOTS: [string, string][] = [
  ['weapon', 'Arma'], ['ammo', 'Munição'], ['shield', 'Escudo'], ['headUpper', 'Topo'], ['headMiddle', 'Meio'],
  ['headLower', 'Baixo'], ['armor', 'Armadura'], ['garment', 'Capa'], ['boot', 'Sapatos'], ['accLeft', 'Acessório (E)'],
  ['accRight', 'Acessório (D)'], ['pet', 'Mascote'], ['shadowWeapon', 'Arma sombria'], ['shadowArmor', 'Armadura sombria'],
  ['shadowShield', 'Escudo sombrio'], ['shadowBoot', 'Sapatos sombrios'], ['shadowEarring', 'Brinco sombrio'],
  ['shadowPendant', 'Colar sombrio'], ['costumeEnchantUpper', 'Encant. visual topo'],
  ['costumeEnchantMiddle', 'Encant. visual meio'], ['costumeEnchantLower', 'Encant. visual baixo'],
  ['costumeEnchantGarment', 'Encant. visual capa 1'], ['costumeEnchantGarment2', 'Encant. visual capa 2'],
  ['costumeEnchantGarment4', 'Encant. visual capa 4'],
];
const MAIN_STATS: [string, string][] = [['str', 'FOR'], ['agi', 'AGI'], ['vit', 'VIT'], ['int', 'INT'], ['dex', 'DES'], ['luk', 'SOR']];
const PHASES: Record<string, string> = {
  stats: 'Distribuindo atributos', screening: 'Testando itens por slot', sets: 'Testando conjuntos', search: 'Combinando itens, cartas e encantamentos',
};

const CSS = `
.rco-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;border-radius:999px;padding:10px 18px;
  font:600 14px/1.2 system-ui,sans-serif;cursor:pointer;color:var(--primary-color-text,#fff);background:var(--primary-color,#2f6fdb);
  box-shadow:0 4px 14px rgba(0,0,0,.25)}
.rco-fab:hover{filter:brightness(1.08)}
.rco-panel{position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);z-index:2147483001;display:flex;flex-direction:column;
  background:var(--surface-card,#fff);color:var(--text-color,#1f2328);border-left:1px solid var(--surface-border,#d0d7de);
  box-shadow:-8px 0 24px rgba(0,0,0,.18);font:14px/1.45 system-ui,sans-serif}
.rco-panel[hidden]{display:none}
.rco-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--surface-border,#d0d7de)}
.rco-head h2{margin:0;font-size:16px}
.rco-x{background:none;border:0;font-size:20px;cursor:pointer;color:inherit;line-height:1}
.rco-body{flex:1;overflow:auto;padding:12px 16px 24px}
.rco-ctx{color:var(--text-color-secondary,#57606a);margin-bottom:10px}
.rco-field{display:flex;flex-direction:column;gap:4px;margin:10px 0}
.rco-field>span,.rco-legend{font-weight:600;font-size:13px}
.rco-panel select,.rco-panel input[type=number]{font:inherit;padding:6px 8px;border-radius:6px;color:inherit;
  background:var(--surface-ground,transparent);border:1px solid var(--surface-border,#d0d7de);min-width:0}
.rco-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.rco-grid .rco-field{margin:0}
.rco-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.rco-grid3 .rco-field{margin:0}
.rco-grid6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
.rco-grid6 label{display:flex;flex-direction:column;font-size:12px;gap:2px}
.rco-checks{display:flex;flex-wrap:wrap;gap:6px 14px}
.rco-checks label{display:flex;gap:6px;align-items:center}
.rco-panel details{margin:10px 0;border:1px solid var(--surface-border,#d0d7de);border-radius:8px;padding:6px 10px}
.rco-panel summary{cursor:pointer;font-weight:600;font-size:13px}
.rco-hint{font-size:12px;color:var(--text-color-secondary,#57606a);margin:4px 0}
.rco-actions{display:flex;gap:8px;margin:14px 0}
.rco-btn{border-radius:6px;padding:8px 14px;font:600 14px system-ui,sans-serif;cursor:pointer;border:1px solid var(--primary-color,#2f6fdb)}
.rco-primary{background:var(--primary-color,#2f6fdb);color:var(--primary-color-text,#fff)}
.rco-secondary{background:transparent;color:var(--primary-color,#2f6fdb)}
.rco-btn:disabled{opacity:.5;cursor:default}
.rco-progress{margin:10px 0}
.rco-bar{height:6px;border-radius:3px;background:var(--surface-border,#d0d7de);overflow:hidden}
.rco-bar>i{display:block;height:100%;width:0;background:var(--primary-color,#2f6fdb);transition:width .2s}
.rco-banner{padding:8px 10px;border-radius:8px;margin:10px 0;font-weight:600}
.rco-ok{background:rgba(46,160,67,.15);color:var(--green-600,#1a7f37)}
.rco-bad{background:rgba(207,34,46,.12);color:var(--red-600,#cf222e)}
.rco-table{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0}
.rco-table th,.rco-table td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--surface-border,#d0d7de);vertical-align:top}
.rco-table td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.rco-up{color:var(--green-600,#1a7f37)}
.rco-down{color:var(--red-600,#cf222e)}
.rco-panel h3{font-size:14px;margin:16px 0 4px}
.rco-warn{font-size:12px;margin:2px 0;color:var(--orange-600,#9a6700)}
`;

type Attrs = Record<string, string | number | boolean | undefined | ((event: Event) => void)>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') element.addEventListener(key.replace(/^on/, ''), value as EventListener);
    else if (key === 'class') element.className = String(value);
    else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, String(value));
  }
  for (const child of children) if (child !== null && child !== undefined && child !== false) element.append(child);
  return element;
}

const fmt = (value: number, digits = 0) => (Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—');
const secs = (value: number) => `${fmt(value, 2)} s`;
const unitOf = (check: Pick<ConstraintCheck, 'unit'>, value: number) => (check.unit === '%' ? `${fmt(value, 0)}%` : secs(value));

function readBuild(): { preset: Record<string, any>; monsterId: number; betelgeuseHp?: number } | null {
  try {
    const preset = JSON.parse(localStorage.getItem('ro-set') ?? 'null');
    if (!preset || typeof preset !== 'object') return null;
    return {
      preset,
      monsterId: Number(localStorage.getItem('monster')) || 21067,
      betelgeuseHp: Number(localStorage.getItem('betelgeuseHp')) || undefined,
    };
  } catch {
    return null;
  }
}

class OptimizerPanel {
  private worker?: Worker;
  private nextId = 1;
  private runId = 0;
  private timeLimitMs = 60_000;
  private readonly panel: HTMLElement;
  private readonly body: HTMLElement;

  constructor() {
    document.head.append(h('style', {}, CSS));
    this.body = h('div', { class: 'rco-body' });
    this.panel = h('aside', { class: 'rco-panel', hidden: true, role: 'dialog', 'aria-label': 'Otimizador de build' },
      h('div', { class: 'rco-head' },
        h('h2', {}, 'Otimizador de build'),
        h('button', { class: 'rco-x', 'aria-label': 'Fechar', onclick: () => this.close() }, '×')),
      this.body);
    const fab = h('button', { class: 'rco-fab', title: 'Otimizar itens e atributos para uma skill', onclick: () => this.open() }, 'Otimizar build');
    document.body.append(fab, this.panel);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !this.panel.hidden) this.close(); });
  }

  private ensureWorker(): Worker {
    this.worker ??= new Worker(WORKER_URL, { type: 'module' });
    return this.worker;
  }

  private request<T>(message: Record<string, unknown>, onProgress?: (data: any) => void): Promise<T> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const listener = (event: MessageEvent) => {
        const data = event.data;
        if (data?.id !== id) return;
        if (data.type === 'progress') { onProgress?.(data.progress); return; }
        worker.removeEventListener('message', listener);
        if (data.type === 'error') reject(new Error(data.message));
        else resolve(data as T);
      };
      worker.addEventListener('message', listener);
      worker.addEventListener('error', (event) => reject(new Error(event.message || 'Falha no worker do otimizador.')), { once: true });
      worker.postMessage({ ...message, id });
    });
  }

  private cancel() {
    this.worker?.terminate();
    this.worker = undefined;
    this.runId++;
  }

  close() {
    this.panel.hidden = true;
  }

  async open() {
    this.panel.hidden = false;
    const build = readBuild();
    if (!build) {
      this.body.replaceChildren(h('p', {}, 'Monte ou carregue uma build no simulador primeiro: o otimizador parte da build atual.'));
      return;
    }
    this.body.replaceChildren(h('p', { class: 'rco-ctx' }, 'Carregando dados do simulador…'));
    try {
      const described = await this.request<Described>(
        { type: 'describe', request: build },
      );
      this.renderForm(build, described);
    } catch (error) {
      this.body.replaceChildren(h('p', { class: 'rco-banner rco-bad' }, `Não foi possível preparar o otimizador: ${(error as Error).message}`));
    }
  }

  private renderForm(build: NonNullable<ReturnType<typeof readBuild>>, described: Described) {
    const skill = h('select', {}, ...described.skills.map((option) => h('option', { value: option.value, selected: option.value === described.skillValue }, option.label)));
    const objective = h('select', {},
      h('option', { value: 'dps', selected: true }, 'Maior DPS (considera conjuração e pós)'),
      h('option', { value: 'avg' }, 'Maior dano médio por uso'),
      h('option', { value: 'max' }, 'Maior dano máximo por uso'),
      h('option', { value: 'min' }, 'Maior dano mínimo por uso'));
    const percent = () => h('input', { type: 'number', min: 0, max: 100, step: 1, placeholder: 'sem meta' });
    const limits = {
      minVctPercent: percent(),
      minFctReduction: h('input', { type: 'number', min: 0, step: 0.1, placeholder: 'sem meta' }),
      minAcdPercent: percent(),
    };
    // Tetos: vazio = meta + folga (5% ou 0,3 s), para a redução não "viajar" além da meta.
    const SLACK = { minVctPercent: 5, minFctReduction: 0.3, minAcdPercent: 5 } as const;
    const MAX_KEY = { minVctPercent: 'maxVctPercent', minFctReduction: 'maxFctReduction', minAcdPercent: 'maxAcdPercent' } as const;
    const ceilings = {
      minVctPercent: h('input', { type: 'number', min: 0, max: 100, step: 1, placeholder: 'auto' }),
      minFctReduction: h('input', { type: 'number', min: 0, step: 0.1, placeholder: 'auto' }),
      minAcdPercent: h('input', { type: 'number', min: 0, max: 100, step: 1, placeholder: 'auto' }),
    };
    for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
      limits[key].addEventListener('input', () => {
        const meta = limits[key].value === '' ? undefined : Number(limits[key].value);
        ceilings[key].placeholder = meta === undefined ? 'auto' : `auto: ${fmt(meta + SLACK[key], key === 'minFctReduction' ? 1 : 0)}`;
      });
    }
    const check = (label: string, checked = true) => {
      const input = h('input', { type: 'checkbox', checked });
      return { input, label: h('label', {}, input, label) };
    };
    const what = {
      stats: check('Atributos'), items: check('Equipamentos'), costumes: check('Encant. de visual'), cards: check('Cartas'),
      enchants: check('Encantamentos'), sets: check('Conjuntos'),
    };
    const locks = SLOTS.map(([key, label]) => ({ key, ...check(label, false) }));
    const minimums = MAIN_STATS.map(([key, label]) => ({ key, input: h('input', { type: 'number', min: 1, max: 130, placeholder: '—' }), label }));
    const mvpCards = check('Permitir cartas MVP');
    const godly = check('Permitir itens divinos', false);
    const refineEquip = h('input', { type: 'number', min: 0, max: 18, step: 1, value: described.defaults.equipRefine });
    const refineShadow = h('input', { type: 'number', min: 0, max: 10, step: 1, value: described.defaults.shadowRefine });
    const grade = h('select', {}, ...([['', 'Sem grau'], ['D', 'Grau D'], ['C', 'Grau C'], ['B', 'Grau B'], ['A', 'Grau A']] as const)
      .map(([value, label]) => h('option', { value, selected: value === described.defaults.grade }, label)));
    const raiseCurrent = check('Levar também os itens atuais a esse refino/grau', false);
    const keepWeapon = check('Manter o tipo de arma (só em skills que não dizem qual arma usam)');
    const noRepeat = check('Não repetir encantamentos sem limite conhecido', false);
    const time = h('input', { type: 'number', min: 10, max: 600, step: 10, value: 60 });
    const run = h('button', { class: 'rco-btn rco-primary' }, 'Otimizar');
    const stop = h('button', { class: 'rco-btn rco-secondary', disabled: true }, 'Cancelar');
    const output = h('div');

    const numberOf = (input: HTMLInputElement) => (input.value === '' ? undefined : Number(input.value));
    run.addEventListener('click', async () => {
      const constraints: Record<string, number> = {};
      for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
        const meta = numberOf(limits[key]);
        const ceiling = numberOf(ceilings[key]);
        if (meta !== undefined) constraints[key] = meta;
        if (ceiling !== undefined) constraints[MAX_KEY[key]] = ceiling;
        else if (meta !== undefined) constraints[MAX_KEY[key]] = meta + SLACK[key];
      }
      const minimumStats = Object.fromEntries(minimums.map(({ key, input }) => [key, numberOf(input)]).filter(([, value]) => value !== undefined));
      this.timeLimitMs = Math.max(10, Number(time.value) || 60) * 1000;
      const request: OptimizeRequest = {
        ...build,
        skillValue: skill.value,
        objective: objective.value as OptimizeRequest['objective'],
        constraints,
        minimumStats,
        optimizeStats: what.stats.input.checked,
        includeCostumes: what.costumes.input.checked,
        // Sem "Equipamentos", só os encantamentos de visual (se marcados) podem mudar.
        slots: what.items.input.checked ? undefined
          : (what.costumes.input.checked ? SLOTS.map(([key]) => key).filter((key) => key.startsWith('costumeEnchant')) : []) as OptimizeRequest['slots'],
        lockedSlots: locks.filter((lock) => lock.input.checked).map((lock) => lock.key) as OptimizeRequest['lockedSlots'],
        optimizeCards: what.cards.input.checked,
        optimizeEnchants: what.enchants.input.checked,
        optimizeSets: what.sets.input.checked,
        keepWeaponType: keepWeapon.input.checked,
        allowMvpCards: mvpCards.input.checked,
        allowGodlyItems: godly.input.checked,
        defaultRefine: { equip: Number(refineEquip.value) || 0, shadow: Number(refineShadow.value) || 0, accessory: Number(refineEquip.value) || 0 },
        defaultGrade: grade.value as OptimizeRequest['defaultGrade'],
        applyLimitsToCurrent: raiseCurrent.input.checked,
        unknownEnchantRepeats: noRepeat.input.checked ? 'forbid' : 'allow',
        timeLimitMs: this.timeLimitMs,
      };
      run.disabled = true;
      stop.disabled = false;
      const myRun = ++this.runId;
      const bar = h('i');
      const status = h('div', { class: 'rco-hint' }, 'Iniciando…');
      output.replaceChildren(h('div', { class: 'rco-progress' }, h('div', { class: 'rco-bar' }, bar), status));
      try {
        const done = await this.request<{ response: OptimizeResponse }>({ type: 'run', request }, (progress) => {
          if (myRun !== this.runId) return;
          bar.style.width = `${Math.min(100, (progress.elapsedMs / this.timeLimitMs) * 100)}%`;
          const best = progress.score.violation > 0 ? 'buscando cumprir os limites' : `melhor até agora: ${fmt(progress.score.damage)}`;
          status.textContent = `${PHASES[progress.phase] ?? progress.phase} · ${best} · ${fmt(progress.evaluations)} builds testadas`;
        });
        if (myRun === this.runId) output.replaceChildren(this.renderResult(done.response, objective.value));
      } catch (error) {
        if (myRun === this.runId) output.replaceChildren(h('p', { class: 'rco-banner rco-bad' }, `Erro: ${(error as Error).message}`));
      } finally {
        if (myRun === this.runId) { run.disabled = false; stop.disabled = true; }
      }
    });
    stop.addEventListener('click', () => {
      this.cancel();
      run.disabled = false;
      stop.disabled = true;
      output.replaceChildren(h('p', { class: 'rco-hint' }, 'Otimização cancelada.'));
    });

    this.body.replaceChildren(
      h('p', { class: 'rco-ctx' }, `${described.className} · alvo: ${described.monsterName}`),
      h('label', { class: 'rco-field' }, h('span', {}, 'Skill'), skill),
      h('label', { class: 'rco-field' }, h('span', {}, 'Objetivo'), objective),
      h('div', { class: 'rco-field' }, h('span', { class: 'rco-legend' }, 'Metas de redução'),
        h('div', { class: 'rco-grid3' },
          h('label', { class: 'rco-field' }, h('span', {}, 'Variável (%)'), limits.minVctPercent),
          h('label', { class: 'rco-field' }, h('span', {}, 'Fixa (s)'), limits.minFctReduction),
          h('label', { class: 'rco-field' }, h('span', {}, 'Pós (%)'), limits.minAcdPercent),
          h('label', { class: 'rco-field' }, h('span', {}, 'até'), ceilings.minVctPercent),
          h('label', { class: 'rco-field' }, h('span', {}, 'até'), ceilings.minFctReduction),
          h('label', { class: 'rco-field' }, h('span', {}, 'até'), ceilings.minAcdPercent)),
        h('p', { class: 'rco-hint' }, 'Quanto de redução a build precisa ter, somando equipamentos, cartas, encantamentos e buffs — ex.: pós 40 = "Pós-conjuração −40%", fixa 1 = "Conjuração fixa −1 s". A variável não inclui DES/INT. A build fica entre a meta e o "até" (vazio = meta + 5%, ou + 0,3 s na fixa); dentro da faixa, o excedente não conta no DPS.'),
        h('div', { class: 'rco-grid3' },
          h('label', { class: 'rco-field' }, h('span', {}, 'Refino máx.'), refineEquip),
          h('label', { class: 'rco-field' }, h('span', {}, 'Refino sombrio máx.'), refineShadow),
          h('label', { class: 'rco-field' }, h('span', {}, 'Grau máx.'), grade)),
        h('p', { class: 'rco-hint' }, 'Refino e grau dos itens que o otimizador colocar (sugestão: o maior que você já usa). Itens que não aceitam refino ou grau ficam sem.'),
        h('div', { class: 'rco-checks' }, raiseCurrent.label)),
      h('div', { class: 'rco-field' }, h('span', { class: 'rco-legend' }, 'O que otimizar'),
        h('div', { class: 'rco-checks' }, ...Object.values(what).map((entry) => entry.label), mvpCards.label, godly.label)),
      h('details', {}, h('summary', {}, 'Travar slots'),
        h('p', { class: 'rco-hint' }, 'Slots travados não mudam (nem cartas e encantamentos).'),
        h('div', { class: 'rco-checks' }, ...locks.map((lock) => lock.label))),
      h('details', {}, h('summary', {}, 'Mínimos de atributo'),
        h('p', { class: 'rco-hint' }, 'Ex.: VIT 100 para sobreviver. Vazio = livre.'),
        h('div', { class: 'rco-grid6' }, ...minimums.map(({ input, label }) => h('label', {}, label, input)))),
      h('details', {}, h('summary', {}, 'Opções'),
        h('div', { class: 'rco-checks' }, keepWeapon.label, noRepeat.label),
        h('label', { class: 'rco-field' }, h('span', {}, 'Tempo máximo (s)'), time)),
      h('div', { class: 'rco-actions' }, run, stop),
      output,
    );
  }

  private renderResult(response: OptimizeResponse, objective: string): HTMLElement {
    const delta = (after: number, before: number, lowerIsBetter = false) => {
      if (!Number.isFinite(after) || !Number.isFinite(before) || after === before) return h('td', { class: 'n' }, fmt(after, 2));
      const better = lowerIsBetter ? after < before : after > before;
      return h('td', { class: `n ${better ? 'rco-up' : 'rco-down'}` }, fmt(after, after < 10 ? 2 : 0));
    };
    const metricRow = (label: string, key: 'damageAvg' | 'damageMin' | 'damageMax' | 'dps' | 'vct' | 'fct' | 'acd' | 'cd' | 'acdPercent' | 'fctReduction' | 'vctPercent', lower = false) =>
      h('tr', {}, h('td', {}, label), h('td', { class: 'n' }, fmt(response.before[key], response.before[key] < 10 ? 2 : 0)), delta(response.after[key], response.before[key], lower));
    const gain = response.damageBefore > 0 ? ((response.damageAfter / response.damageBefore) - 1) * 100 : 0;
    const limitRows = (checks: ConstraintCheck[]) => checks.map((check) =>
      h('tr', {}, h('td', {}, check.label), h('td', { class: 'n' }, `${check.kind === 'max' ? '≤' : '≥'} ${unitOf(check, check.limit)}`),
        h('td', { class: `n ${check.ok ? 'rco-up' : 'rco-down'}` }, `${unitOf(check, check.value)} ${check.ok ? '✔' : '✖'}`)));
    const group = (title: string, entries: NamedChange[]) => entries.length ? [
      h('h3', {}, title),
      h('table', { class: 'rco-table' }, ...entries.map((change) => h('tr', {}, h('td', {}, change.label), h('td', {}, change.from), h('td', {}, '→ ', change.to)))),
    ] : [];
    const go = (path: string) => () => { window.location.assign(path); };

    return h('div', {},
      response.constraints.length
        ? h('div', { class: `rco-banner ${response.feasible ? 'rco-ok' : 'rco-bad'}` },
          response.feasible ? 'Todos os limites de tempo foram cumpridos.' : 'Não foi possível cumprir todos os limites: esta é a build mais próxima.')
        : null,
      h('p', {}, `${objective === 'dps' ? 'DPS' : 'Dano'}: ${fmt(response.damageBefore)} → `, h('strong', {}, fmt(response.damageAfter)),
        ` (${gain >= 0 ? '+' : ''}${fmt(gain, 1)}%)`),
      h('table', { class: 'rco-table' },
        h('tr', {}, h('th', {}, ''), h('th', {}, 'Antes'), h('th', {}, 'Depois')),
        metricRow('Dano médio', 'damageAvg'), metricRow('DPS', 'dps'),
        metricRow('Conj. variável (s)', 'vct', true), metricRow('Conj. fixa (s)', 'fct', true),
        metricRow('Pós-conjuração (s)', 'acd', true), metricRow('Recarga (s)', 'cd', true),
        metricRow('Redução de variável (%)', 'vctPercent'), metricRow('Redução de fixa (s)', 'fctReduction'), metricRow('Redução de pós (%)', 'acdPercent')),
      response.constraints.length ? h('table', { class: 'rco-table' }, ...limitRows(response.constraints)) : null,
      h('div', { class: 'rco-actions' },
        h('button', { class: 'rco-btn rco-secondary', onclick: go(response.comparePath), title: 'Abre a build atual com a otimizada na coluna de comparação' }, 'Comparar no simulador'),
        h('button', { class: 'rco-btn rco-primary', onclick: go(response.applyPath), title: 'Substitui a build atual pela otimizada' }, 'Aplicar build')),
      h('p', { class: 'rco-hint' }, 'Aplicar substitui a build atual — salve-a antes em "Simulações" se quiser mantê-la.'),
      response.notCompared.length ? h('p', { class: 'rco-hint' }, `A comparação não mostra: ${response.notCompared.join(', ')} (use Aplicar para ver tudo).`) : null,
      ...group('Equipamentos', response.changes.filter((change) => change.group === 'item')),
      ...group('Cartas e encantamentos', response.changes.filter((change) => change.group === 'attachment')),
      ...group('Atributos', response.changes.filter((change) => change.group === 'stat')),
      response.sets.length ? h('h3', {}, 'Conjuntos usados') : null,
      ...response.sets.map((set) => h('p', { class: 'rco-hint' }, set)),
      response.warnings.length ? h('h3', {}, 'Conferir') : null,
      ...response.warnings.map((warning) => h('p', { class: 'rco-warn' }, warning)),
      h('p', { class: 'rco-hint' }, `${fmt(response.evaluations)} builds testadas em ${fmt(response.elapsedMs / 1000, 1)} s${response.truncated ? ' (parou pelo tempo máximo)' : ''}.`),
    );
  }
}

if (typeof document !== 'undefined' && !(window as any).__roCalcOptimizer) {
  (window as any).__roCalcOptimizer = true;
  const start = () => new OptimizerPanel();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
