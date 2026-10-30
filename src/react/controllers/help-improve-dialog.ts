import { ViewState } from '../state/view-state';
import { Events } from '../services/events';
import { ReplaySubmissionClient as ReplaySubmissionService } from '../../app/replay/submission-client';
import { CalculatorData as RoService } from '../services/calculator-services';
import { ReplayTraits, TRAIT_KEYS } from 'src/app/replay/replay-traits';
import { SubmissionCheck, validateReplaySubmission } from 'src/app/replay/validate-submission';
import { createNumberDropdownList } from 'src/app/utils/create-number-dropdown-list';
import { HELP_IMPROVE_DIALOG_STYLE } from '../../app/layout/dialog-geometry';
import { TextKey, Translate, resolveText } from 'src/app/i18n';

const ZERO_TRAITS: ReplayTraits = { pow: 0, sta: 0, wis: 0, spl: 0, con: 0, crt: 0 };


export class HelpImproveDialogComponent extends ViewState {
   visible = false;
   visibleChange = new Events<boolean>();

  /** Stamped on the submission so a bug report can be tied to a release. */
   appVersion = '';

  readonly dialogStyle = HELP_IMPROVE_DIALOG_STYLE;
  readonly traitKeys = TRAIT_KEYS;
  /** The calculator's own trait range, so the two pickers offer the same values. */
  readonly traitStatusList = createNumberDropdownList({ from: 0, to: 100 });
  /** The status-window abbreviations, from the catalog rather than the replay layer. */
  get traitLabels(): Record<string, string> {
    return Object.fromEntries(TRAIT_KEYS.map((key) => [key, this.text(`stat.${key}` as TextKey)]));
  }

  /** Why a recording was refused, in the reader's language. */
  get rejectionMessage(): string {
    return this.rejected ? resolveText(this.text, this.rejected.text) : '';
  }

  readonly browikiUrl = 'https://browiki.org/wiki/Replay';
  readonly discordUrl = 'https://discord.gg/JCXTqqWq9Q';

  fileName = '';
  dragOver = false;
  parsing = false;
  check: SubmissionCheck | null = null;

  /** Kept aside so the send doesn't have to re-read the file. */
  private bytes: Uint8Array | null = null;

  traits: ReplayTraits = { ...ZERO_TRAITS };
  nick = '';
  discord = '';
  notes = '';
  consent = false;

  sending = false;
  sentId = '';
  sendError = '';

  constructor(private roService: RoService, private submissions: ReplaySubmissionService,
    private readonly text: Translate) { super();}

  get accepted(): SubmissionCheck | null {
    return this.check && this.check.ok ? this.check : null;
  }

  get rejected(): SubmissionCheck | null {
    return this.check && !this.check.ok ? this.check : null;
  }

  /** The traits the recording itself carried, when it carried all six. */
  get importedTraits(): ReplayTraits | null {
    return this.accepted?.traits ?? null;
  }

  /**
   * Every field still at zero on a class that has traits. Any single stat may
   * legitimately be 0, but all six at once means the form was left untouched —
   * and traits nobody filled in would silently wreck the comparison. Only ever
   * asked about the form: a recording that reports six zeros is reporting a fact.
   */
  get traitsUntouched(): boolean {
    if (!this.accepted?.needsTraits) return false;
    return TRAIT_KEYS.every((k) => !this.traits[k]);
  }

  get canSend(): boolean {
    return !!this.accepted && this.consent && !this.traitsUntouched && !this.sending && !this.sentId;
  }

  onHide() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.reset();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.readFile(file);
  }

  onInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.readFile(file);
    input.value = ''; // allow re-picking the same file
  }

  /** Parses and validates in the browser; nothing is sent until "Enviar". */
  async readFile(file: File) {
    if (this.parsing) return;
    this.parsing = true;
    this.check = null;
    this.sentId = '';
    this.sendError = '';
    this.fileName = file.name;
    try {
      const buf = await file.arrayBuffer();
      const items = await this.roService.getItems<Record<number, any>>();
      this.check = validateReplaySubmission(buf, items);
      this.bytes = this.check.ok ? new Uint8Array(buf) : null;
    } catch (e) {
      console.error(e);
      this.check = {
        ok: false,
        blocker: 'unreadable',
        text: { key: 'hi.readFailed' },
        summary: null,
        traits: null,
        needsTraits: false,
        warnings: [],
      };
      this.bytes = null;
    } finally {
      this.parsing = false;
    }
  }

  async send() {
    const accepted = this.accepted;
    if (!accepted || !this.bytes || !this.canSend) return;
    this.sending = true;
    this.sendError = '';
    try {
      this.sentId = await this.submissions.submit({
        bytes: this.bytes,
        fileName: this.fileName,
        appVersion: this.appVersion,
        summary: accepted.summary,
        // The recording's own traits win; the form only fills the gap it leaves.
        traits: accepted.traits ?? (accepted.needsTraits ? this.traits : null),
        traitsSource: accepted.traits ? 'replay' : accepted.needsTraits ? 'form' : null,
        nick: this.nick,
        discord: this.discord,
        notes: this.notes,
      });
      // The bytes are the bulk of the memory here and are no longer needed.
      this.bytes = null;
    } catch (e) {
      console.error(e);
      this.sendError = this.text('hi.sendFailed');
    } finally {
      this.sending = false;
    }
  }

  /** Clears the file and the form, but keeps who the person is. */
  startAnother() {
    this.check = null;
    this.bytes = null;
    this.fileName = '';
    this.sentId = '';
    this.sendError = '';
    this.notes = '';
    this.consent = false;
    this.traits = { ...ZERO_TRAITS };
  }

  formatDuration(ms: number): string {
    const total = Math.round(ms / 1000);
    return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
  }

  private reset() {
    this.startAnother();
    this.nick = '';
    this.discord = '';
  }
}
