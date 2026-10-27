import { releaseVersions } from '../../releases/summary';
import { ViewState } from '../state/view-state';
import { Disposable } from '../services/events';
import { IconName } from 'src/app/ui/icon-names';
import { environment } from 'src/environments/environment';
import { UPDATE_DIALOG_STYLE } from '../../app/layout/dialog-geometry';
import { CalculatorLayout as LayoutService } from '../services/calculator-services';


export class AppTopBarComponent extends ViewState {
  private readonly helpImproveSubscription: Disposable;

  constructor(private layoutService: LayoutService) { super();
    this.helpImproveSubscription = this.layoutService.helpImproveOpen.subscribe(() => this.action(() => this.showHelpImproveDialog()));
  }

  ngOnDestroy(): void {
    this.helpImproveSubscription.unsubscribe();
  }

  visibleInfo: boolean = false;
  visibleReference = false;
  visibleMcp = false;
  visibleSettings = false;
  mcpUrlCopied = false;

  /** Public MCP endpoint. Agents connect here; the browser never calls it. */
  readonly mcpUrl = environment.mcpUrl;

  /** What the server is good at, phrased the way someone would actually ask. */
  readonly mcpExamples: { icon: IconName; title: string; prompt: string; note: string }[] = [
    {
      icon: 'search',
      title: 'Procurar itens',
      prompt: 'Quais chapéus dão dano de longa distância para Falcão do Vento?',
      note: 'Busca por nome (sem se importar com acentos), por bônus, por habilidade ou por slot. Inclui itens que existem no LATAM mas ainda não foram cadastrados aqui — esses vêm marcados.',
    },
    {
      icon: 'bolt',
      title: 'Calcular dano',
      prompt: 'Quanto de dano essa build faz em Implosão Tóxica contra o dummy neutro?',
      note: 'Usa o mesmo motor do simulador, então o número é idêntico ao que você vê na tela.',
    },
    {
      icon: 'sort-amount-up',
      title: 'Otimizar uma peça',
      prompt: 'Qual a melhor arma para essa build? Testa as opções e me diz o ganho de DPS.',
      note: 'Testa vários candidatos e devolve um link que já abre o simulador na comparação atual → simulado.',
    },
    {
      icon: 'link',
      title: 'Analisar a sua build',
      prompt: 'Cole aqui o link do simulador — o que dá para melhorar?',
      note: 'Qualquer link de compartilhamento (inclusive o encurtado) pode ser lido e devolvido com alterações.',
    },
    {
      icon: 'table',
      title: 'Comparar alvos e builds',
      prompt: 'Compara o dano dessa build contra Osíris, Bafomé e Doppelganger.',
      note: 'Também dá para pôr duas ou mais builds lado a lado contra o mesmo alvo.',
    },
  ];

  // The Google form and spreadsheet are gone: everything became a card on the
  // shared tracker, and what the spreadsheet held was migrated over.
  readonly issuesReportUrl = `${environment.issuesUrl}/novo?projeto=simulador`;
  readonly issuesBoardUrl = `${environment.issuesUrl}/?projeto=simulador`;
  readonly discordUrl = 'https://discord.gg/JCXTqqWq9Q';
  // Original changelog/history at the fork point (last upstream release v3.2.19).
  readonly originalChangelogUrl =
    'https://github.com/turugrura/tong-calc-ro/blob/ba4312f/src/app/layout/app.topbar.component.ts';

  infos = [
    'Os dados de itens e habilidades vêm do cliente do RO LATAM; os de monstros, da API pública do RagnaPlace. Os links de itens, monstros e habilidades levam ao divine-pride para consulta.',
    'Mude o tema pelo botão Config, no centro à direita.',
    'Os dados salvos ficam no navegador; se você limpar os dados do navegador, eles também serão apagados.',
    'Condições que dizem "a cada nível de habilidade aprendido" exigem subir o nível no campo "Learn to get bonuses" para receber o bônus; se não houver onde subir, o bônus é contado como Nv MÁX.',
    'As opções na linha da arma ficam sempre disponíveis e podem ser usadas como "e se" (What if).',
    'My Magical Element nas opções = aumenta o dano mágico do elemento...',
    'Os jobs 61-64 e 66-69 recebem bônus imprecisos por falta de dados.',
    'A aba "Summary" mostra o que foi equipado / quais habilidades foram subidas / todos os cálculos.',
    'A aba "Equipments Summary" mostra um resumo geral dos bônus dos itens.',
    'A aba "Item Descriptions" mostra os bônus e a descrição de cada item (para conferir se os bônus estão corretos).',
  ];

  references: { label: string; link: string; writer: string; date?: string; }[] = [
    {
      label: 'Arch Mage (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/05/arch-mage-2nd-version.html',
    },
    {
      label: 'Dragon Knight (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/08/dragon-knight-2nd-version.html',
    },
    {
      label: 'Shadow Cross (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/06/shadow-cross-2nd-version.html',
    },
    {
      label: 'Abyss Chaser (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/07/abyss-chaser-2nd-version.html',
    },
    {
      label: 'Inquisitor (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/08/inquisitor-2nd-version.html',
    },
    {
      label: 'Imperial Guard (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/08/imperial-guard-2nd-version.html',
    },
    {
      label: 'Troubadour & Trouvere (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/06/troubadour-trouvere-2nd-version.html',
    },
    {
      label: 'Cardinal (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/07/cardinal-2nd-version.html',
    },
    {
      label: 'Biolo (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/07/biolo-2nd-version.html',
    },
    {
      label: 'Elemental Master (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/07/elemental-master-2nd-version.html',
    },
    {
      label: 'Meister (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/07/meister-2nd-version.html',
    },
    {
      label: 'Windhawk (2nd version)',
      writer: 'Sigma the fallen',
      link: 'https://sigmathefallen.blogspot.com/2024/07/windhawk-2nd-version.html',
    },
    {
      label: 'Referências da versão original (pré-fork)',
      writer: 'tong-calc-ro',
      link: 'https://github.com/turugrura/tong-calc-ro',
    },
  ];

  /** Published release history shared with Discord. */
  updates: { v: string; date: string; logs: string[]; }[] = [];
  updatesLoading = false;
  updatesError = false;
  private updatesLoad?: Promise<void>;
  localVersion = localStorage.getItem('version') || '';
  /** Reading width for the changelog; see dialog-geometry.ts. */
  readonly updateDialogStyle = UPDATE_DIALOG_STYLE;

  lastestVersion = releaseVersions[0];

  unreadVersion = releaseVersions.indexOf(this.localVersion);
  showUnreadVersion = this.unreadVersion === -1 ? releaseVersions.length + 1 : this.unreadVersion;

  // Don't auto-open the changelog on load; it's still reachable via the "what's new" button.
  visibleUpdate = false;

  // The call for .rrf recordings ("Ajude o simulador") is PAUSED since 12/09/2026: it
  // neither opens on load nor has a topbar button, so no new recordings arrive while
  // the dialog is being redone. The component, its snooze helper and the submission
  // service are all still here — to bring it back, restore `!isHelpImproveSnoozed()`
  // (help-improve/help-improve-snooze.ts) and the button in the template.
  visibleHelpImprove = false;

  showHelpImproveDialog() {
    this.visibleHelpImprove = true;
  }

  showUpdateDialog(): Promise<void> {
    this.visibleUpdate = true;
    if (!this.updatesLoad) {
      this.updatesLoading = true;
      this.updatesError = false;
      this.updatesLoad = import('../../releases/history.json').then(({ default: history }) => {
        if (this.lifetime.active) this.updates = history;
      }).catch(() => {
        this.updatesError = true;
        this.updatesLoad = undefined;
      }).finally(() => { this.updatesLoading = false; this.publish(); });
    }
    return this.updatesLoad;
  }

  showReferenceDialog() {
    this.visibleReference = true;
  }

  onHideUpdateDialog() {
    // localStorage.setItem('version', this.updates[0].v);
    // this.showUnreadVersion = 0;
  }

  onReadUpdateClick(version: string) {
    localStorage.setItem('version', version);
    this.unreadVersion = releaseVersions.indexOf(version);
    this.showUnreadVersion = this.unreadVersion === -1 ? releaseVersions.length + 1 : this.unreadVersion;
  }

  showInfoDialog() {
    this.visibleInfo = true;
  }

  showMcpDialog() {
    this.mcpUrlCopied = false;
    this.visibleMcp = true;
  }

  async copyMcpUrl() {
    try {
      await navigator.clipboard.writeText(this.mcpUrl);
      this.mcpUrlCopied = true;
    } catch (error) {
      // Clipboard access can be denied (insecure context, permissions); the URL is
      // on screen and selectable, so this is not worth interrupting the user for.
      console.error(error);
    }
  }

  openItemSearch() {
    this.layoutService.openItemSearch();
  }

  openCustomItems() { this.layoutService.openCustomItems(); }

  get showPreviews(): boolean { return this.layoutService.previews.getSnapshot(); }
  readonly previewOptions = [{ label: 'Sim', value: true }, { label: 'Não', value: false }];
  setShowPreviews(value: boolean): void {
    if (typeof value === 'boolean') this.layoutService.previews.set(value);
  }
}
