import { Container, Graphics, Text } from 'pixi.js';
import { SongClock } from './clock';
import { playerLane, type ChartNote } from './song';

// Judgement window in ms, and visual layout.
const HIT_WINDOW_MS = 166;
const LANE_X = [760, 880, 1000, 1120];
const HIT_Y = 600;
const PX_PER_MS_BASE = 0.45;
const LANE_COLORS = [0xc24b99, 0x00ffff, 0x12fa05, 0xf9393f];

interface Lane {
  note: ChartNote;
  gfx: Graphics;
  judged: boolean;
}

export class Gameplay extends Container {
  private ctx: AudioContext;
  private clock: SongClock;
  private lanes: Lane[];
  private pxPerMs: number;
  private inst: AudioBuffer;
  private voices: AudioBuffer;
  private sources: AudioBufferSourceNode[] = [];
  private scoreText: Text;
  private judgeText: Text;
  private score = 0;
  private combo = 0;
  private misses = 0;
  private running = false;
  private onNote: (lane: number) => void;

  constructor(
    ctx: AudioContext,
    notes: ChartNote[],
    speed: number,
    inst: AudioBuffer,
    voices: AudioBuffer,
    onNote: (lane: number) => void,
  ) {
    super();
    this.ctx = ctx;
    this.inst = inst;
    this.voices = voices;
    this.onNote = onNote;
    this.clock = new SongClock(ctx);
    this.pxPerMs = PX_PER_MS_BASE * speed;

    // One receptor per lane, so the player sees where to hit.
    for (let lane = 0; lane < 4; lane++) {
      const receptor = new Graphics().circle(0, 0, 40).stroke({ width: 6, color: LANE_COLORS[lane] });
      receptor.position.set(LANE_X[lane], HIT_Y);
      this.addChild(receptor);
    }

    this.lanes = notes.map((note) => {
      const gfx = new Graphics().circle(0, 0, 36).fill(LANE_COLORS[playerLane(note)]);
      gfx.position.set(LANE_X[playerLane(note)], HIT_Y);
      this.addChild(gfx);
      return { note, gfx, judged: false };
    });

    this.scoreText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 24, fontFamily: 'sans-serif' } });
    this.scoreText.position.set(24, 110);
    this.addChild(this.scoreText);

    this.judgeText = new Text({ text: '', style: { fill: 0xffffff, fontSize: 36, fontFamily: 'sans-serif' } });
    this.judgeText.position.set(LANE_X[1] - 40, HIT_Y - 120);
    this.addChild(this.judgeText);
  }

  /** Starts the song audio and the chart clock at the same AudioContext time. */
  start(): void {
    const at = this.ctx.currentTime + 0.05;
    for (const buffer of [this.inst, this.voices]) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(at);
      this.sources.push(source);
    }
    this.clock.start(at);
    this.running = true;
  }

  /** Current song position in ms. */
  get positionMs(): number {
    return this.clock.positionMs();
  }

  /** Handles a press on a player lane (0-3). */
  press(lane: number): void {
    if (!this.running) return;
    const pos = this.positionMs;

    // Pick the closest unjudged note in this lane within the window.
    let best: Lane | null = null;
    for (const entry of this.lanes) {
      if (entry.judged || playerLane(entry.note) !== lane) continue;
      const diff = Math.abs(entry.note.t - pos);
      if (diff > HIT_WINDOW_MS) continue;
      if (!best || diff < Math.abs(best.note.t - pos)) best = entry;
    }
    if (!best) return;

    best.judged = true;
    best.gfx.visible = false;
    this.combo++;
    this.score += 350;
    this.judgeText.text = 'Bien';
    this.onNote(lane);
  }

  update(): void {
    if (!this.running) return;
    const pos = this.positionMs;

    for (const entry of this.lanes) {
      if (entry.judged) continue;

      // Missed: passed the hit window without a press.
      if (entry.note.t < pos - HIT_WINDOW_MS) {
        entry.judged = true;
        entry.gfx.visible = false;
        this.misses++;
        this.combo = 0;
        this.judgeText.text = 'Fallo';
        continue;
      }

      // Scroll toward the hit line.
      const y = HIT_Y - (entry.note.t - pos) * this.pxPerMs;
      entry.gfx.y = y;
      entry.gfx.visible = y > -60 && y < 800;
    }

    this.scoreText.text = `Score: ${this.score}  Combo: ${this.combo}  Fallos: ${this.misses}`;
  }

  get finished(): boolean {
    return this.running && this.lanes.every((l) => l.judged);
  }

  stopSong(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    }
    this.running = false;
  }
}
