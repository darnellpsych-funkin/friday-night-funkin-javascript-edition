// Song clock: the chart position must follow the audio clock, not frame time.
export class SongClock {
  private ctx: AudioContext;
  private startTime = 0;
  private offsetMs: number;

  constructor(ctx: AudioContext, offsetMs = 0) {
    this.ctx = ctx;
    this.offsetMs = offsetMs;
  }

  /** Marks song time zero at `at` (AudioContext seconds). Defaults to now. */
  start(at: number = this.ctx.currentTime): void {
    this.startTime = at;
  }

  /** Current song position in milliseconds, including the user offset. */
  positionMs(): number {
    return (this.ctx.currentTime - this.startTime) * 1000 - this.offsetMs;
  }
}
