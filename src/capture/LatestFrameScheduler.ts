export interface SchedulerState {
  busy: boolean;
  pending: boolean;
}

/** Single-flight work queue with one replaceable pending item. */
export class LatestFrameScheduler<T, R> {
  private active = false;
  private pending: T | null = null;
  private stopped = false;

  constructor(
    private readonly process: (item: T) => Promise<R>,
    private readonly onResult: (result: R, item: T) => void,
    private readonly release: (item: T) => void,
    private readonly onState?: (state: SchedulerState) => void,
    private readonly onError?: (error: unknown) => void,
  ) {}

  submit(item: T): void {
    if (this.stopped) { this.release(item); return; }
    if (this.active) {
      if (this.pending) this.release(this.pending);
      this.pending = item;
      this.emitState();
      return;
    }
    void this.run(item);
  }

  stop(): void {
    this.stopped = true;
    if (this.pending) this.release(this.pending);
    this.pending = null;
    this.emitState();
  }

  private async run(item: T): Promise<void> {
    this.active = true; this.emitState();
    try {
      const result = await this.process(item);
      if (!this.stopped) this.onResult(result, item);
    } catch (error) {
      if (!this.stopped) this.onError?.(error);
    } finally {
      this.release(item);
      const next = this.pending;
      this.pending = null;
      if (next && !this.stopped) await this.run(next);
      else { this.active = false; this.emitState(); }
    }
  }

  private emitState(): void {
    this.onState?.({ busy: this.active, pending: this.pending !== null });
  }
}
