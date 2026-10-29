import { releaseVersions } from '../../releases/summary';
import { ReleaseEntry } from '../../releases/entry-logs';
import { ViewState } from '../state/view-state';
import { Disposable } from '../services/events';
import { IconName } from 'src/app/ui/icon-names';
import { TextKey } from '../../app/i18n';
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

  visibleReference = false;
  visibleMcp = false;
  visibleSettings = false;
  mcpUrlCopied = false;

  /** Public MCP endpoint. Agents connect here; the browser never calls it. */
  readonly mcpUrl = environment.mcpUrl;

  /**
   * What the server is good at, phrased the way someone would actually ask.
   *
   * Keys rather than text: the dialog is one of the longest stretches of prose in the
   * app, and the wording has to follow the language the reader picked. The icon is the
   * only part of a row that is not text.
   */
  readonly mcpExamples: { icon: IconName; title: TextKey; prompt: TextKey; note: TextKey }[] = [
    { icon: 'search', title: 'mcp.exampleSearch.title', prompt: 'mcp.exampleSearch.prompt', note: 'mcp.exampleSearch.note' },
    { icon: 'bolt', title: 'mcp.exampleDamage.title', prompt: 'mcp.exampleDamage.prompt', note: 'mcp.exampleDamage.note' },
    { icon: 'sort-amount-up', title: 'mcp.exampleOptimize.title', prompt: 'mcp.exampleOptimize.prompt', note: 'mcp.exampleOptimize.note' },
    { icon: 'link', title: 'mcp.exampleAnalyze.title', prompt: 'mcp.exampleAnalyze.prompt', note: 'mcp.exampleAnalyze.note' },
    { icon: 'table', title: 'mcp.exampleCompare.title', prompt: 'mcp.exampleCompare.prompt', note: 'mcp.exampleCompare.note' },
  ];

  // The Google form and spreadsheet are gone: everything became a card on the
  // shared tracker, and what the spreadsheet held was migrated over.
  readonly issuesReportUrl = `${environment.issuesUrl}/novo?projeto=simulador`;
  readonly issuesBoardUrl = `${environment.issuesUrl}/?projeto=simulador`;
  readonly discordUrl = 'https://discord.gg/JCXTqqWq9Q';
  // Original changelog/history at the fork point (last upstream release v3.2.19).
  readonly originalChangelogUrl =
    'https://github.com/turugrura/tong-calc-ro/blob/ba4312f/src/app/layout/app.topbar.component.ts';

  /**
   * Blog write-ups behind the formulas. `label` is the post's own title and `writer`
   * its author, so neither is translated; `labelKey` is for the one row that is this
   * app's own wording rather than someone's post title.
   */
  references: { label?: string; labelKey?: TextKey; link: string; writer: string; date?: string; }[] = [
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
      labelKey: 'topbar.originalReferences',
      writer: 'tong-calc-ro',
      link: 'https://github.com/turugrura/tong-calc-ro',
    },
  ];

  /** Published release history shared with Discord. */
  updates: ReleaseEntry[] = [];
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
  setShowPreviews(value: boolean): void {
    if (typeof value === 'boolean') this.layoutService.previews.set(value);
  }
}
