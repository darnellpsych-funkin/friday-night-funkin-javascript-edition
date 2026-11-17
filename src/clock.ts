// Song clock: the chart position must follow the audio clock, not frame time.
export class SongClock {
  private ctx: AudioContext;
  private startTime = 0;
  private offsetMs: number;

  constructor(ctx: AudioContext, offsetMs = 0) {
    this.ctx = ctx;
    this.offsetMs = offsetMs;
  }

  start(): void {
    this.startTime = this.ctx.currentTime;
  }

  /** Current song position in milliseconds, including the user offset. */
  positionMs(): number {
    return (this.ctx.currentTime - this.startTime) * 1000 - this.offsetMs;
  }
}
