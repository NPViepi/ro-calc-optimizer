/** Owns delayed hover transitions, including the grace period for scrollable descriptions. */
export class HoverLifetime {
  private showTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private active = false;
  private disposed = false;
  constructor(private readonly show: () => void, private readonly close: () => void, private readonly allowed: () => boolean,
    private readonly showDelay: () => number, private readonly hideDelay: () => number) {}
  activate(): void {
    this.cancelHide();
    if (this.disposed || this.active || this.showTimer || !this.allowed()) return;
    this.showTimer = setTimeout(() => {
      this.showTimer = undefined;
      if (!this.disposed && this.allowed()) { this.active = true; this.show(); }
    }, this.showDelay());
  }
  deactivate(): void {
    clearTimeout(this.showTimer); this.showTimer = undefined; this.cancelHide();
    if (!this.disposed) this.hideTimer = setTimeout(() => this.hide(), this.hideDelay());
  }
  /** Opens at once, as a tap does: there is no pointer travel to wait for. */
  open(): void {
    clearTimeout(this.showTimer); this.showTimer = undefined; this.cancelHide();
    if (!this.disposed && !this.active && this.allowed()) { this.active = true; this.show(); }
  }
  get isOpen(): boolean { return this.active; }
  cancelHide(): void { clearTimeout(this.hideTimer); this.hideTimer = undefined; }
  hide(): void {
    clearTimeout(this.showTimer); this.showTimer = undefined; this.cancelHide();
    if (this.active) { this.active = false; this.close(); }
  }
  dispose(): void { this.hide(); this.disposed = true; }
}
