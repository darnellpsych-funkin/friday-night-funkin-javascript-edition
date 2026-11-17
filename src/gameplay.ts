import { Container, Graphics, Text } from 'pixi.js';
import { SongClock } from './clock';
import { playerLane, type ChartNote } from './song';

// Judgement windows in ms (the widest one is the hit window).
const WINDOW_MS = 166;
const RATINGS = [
  { name: 'Sick', maxMs: 45, points: 350, weight: 1, color: 0x36d7f2 },
  { name: 'Good', maxMs: 90, points: 200, weight: 0.8, color: 0x12fa05 },
  { name: 'Bad', maxMs: 135, points: 100, weight: 0.5, color: 0xffd23f },
  { name: 'Shit', maxMs: WINDOW_MS, points: 50, weight: 0.25, color: 0xa79fae },
] as const;
const HOLD_BONUS = 250;

const LANE_X = [760, 880, 1000, 1120];
const HIT_Y = 600;
const PX_PER_MS_BASE = 0.45;
const LANE_COLORS = [0xc24b99, 0x00ffff, 0x12fa05, 0xf9393f];

type Rating = (typeof RATINGS)[number]['name'] | 'Fallo';

interface Lane {
  note: ChartNote;
  lane: number;
  head: Graphics;
  tail: Graphics;
  judged: boolean; // head was hit or missed
  holding: boolean;
  done: boolean; // nothing more to draw or judge
}

export interface Stats {
  score: number;
  accuracy: number; // 0-100
  maxCombo: number;
  counts: Record<Rating, number>;
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
  private maxCombo = 0;
  private weightSum = 0;
  private counts: Record<Rating, number> = { Sick: 0, Good: 0, Bad: 0, Shit: 0, Fallo: 0 };
  private running = false;
  private paused = false;
  private pausedElapsed = 0;
  private pausedPosition = 0;
  private onNote: (lane: number) => void;
  private totalNotes: number;

  constructor(
    ctx: AudioContext,
    notes: ChartNote[],
    speed: number,
    inst: AudioBuffer,
    voices: AudioBuffer,
    onNote: (lane: number) => void,
    offsetMs = 0,
  ) {
    super();
    this.ctx = ctx;
    this.inst = inst;
    this.voices = voices;
    this.onNote = onNote;
    this.clock = new SongClock(ctx, offsetMs);
    this.pxPerMs = PX_PER_MS_BASE * speed;
    this.totalNotes = notes.length;

    // Receptors show where to press.
    for (let lane = 0; lane < 4; lane++) {
      const receptor = new Graphics().circle(0, 0, 40).stroke({ width: 6, color: LANE_COLORS[lane] });
      receptor.position.set(LANE_X[lane], HIT_Y);
      this.addChild(receptor);
    }

    this.lanes = notes.map((note) => {
      const lane = playerLane(note);
      const tail = new Graphics();
      const head = new Graphics().circle(0, 0, 36).fill(LANE_COLORS[lane]);
      head.position.set(LANE_X[lane], HIT_Y);
      this.addChild(tail, head);
      return { note, lane, head, tail, judged: false, holding: false, done: false };
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
    this.startSources(at, 0);
    this.clock.start(at);
    this.running = true;
  }

  /** Freezes the song: stops the audio and holds the chart position. */
  pause(): void {
    if (!this.running || this.paused) return;
    this.pausedElapsed = this.clock.elapsedMs();
    this.pausedPosition = this.clock.positionMs();
    this.paused = true;
    this.stopAudio();
  }

  /** Continues from the paused point, restarting the audio at the same place. */
  resume(): void {
    if (!this.paused) return;
    const at = this.ctx.currentTime + 0.05;
    const offsetSec = Math.max(0, this.pausedElapsed / 1000);
    this.startSources(at, offsetSec);
    this.clock.start(at - this.pausedElapsed / 1000);
    this.paused = false;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Stops the audio and ends the song. */
  stopSong(): void {
    this.stopAudio();
    this.running = false;
    this.paused = false;
  }

  get positionMs(): number {
    return this.paused ? this.pausedPosition : this.clock.positionMs();
  }

  private startSources(at: number, offsetSec: number): void {
    this.sources = [];
    for (const buffer of [this.inst, this.voices]) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(at, offsetSec);
      this.sources.push(source);
    }
  }

  private stopAudio(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    }
    this.sources = [];
  }

  /** True when every note has been hit, missed or finished. */
  get finished(): boolean {
    return this.running && this.lanes.every((l) => l.done);
  }

  get stats(): Stats {
    return {
      score: this.score,
      accuracy: this.totalNotes ? (this.weightSum / this.totalNotes) * 100 : 0,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
    };
  }

  /** Handles a press on a player lane (0-3). */
  press(lane: number): void {
    if (!this.running || this.paused) return;
    const pos = this.positionMs;

    // Closest unjudged note in this lane inside the window.
    let best: Lane | null = null;
    for (const entry of this.lanes) {
      if (entry.judged || entry.lane !== lane) continue;
      const diff = Math.abs(entry.note.t - pos);
      if (diff > WINDOW_MS) continue;
      if (!best || diff < Math.abs(best.note.t - pos)) best = entry;
    }
    if (!best) return;

    const diff = Math.abs(best.note.t - pos);
    const rating = RATINGS.find((r) => diff <= r.maxMs) ?? RATINGS[RATINGS.length - 1];
    best.judged = true;
    this.addScore(rating.points, rating.weight, rating.name);

    if (best.note.l && best.note.l > 0) {
      best.holding = true; // finished on release or when the tail ends
    } else {
      best.done = true;
      best.head.visible = false;
    }
    this.onNote(lane);
  }

  /** Handles a release on a lane (0-3); breaks holds released too early. */
  release(lane: number): void {
    if (!this.running || this.paused) return;
    const pos = this.positionMs;
    for (const entry of this.lanes) {
      if (!entry.holding || entry.lane !== lane) continue;
      entry.holding = false;
      const tailEnd = entry.note.t + (entry.note.l ?? 0);
      if (pos >= tailEnd - WINDOW_MS) {
        this.completeHold(entry);
      } else {
        this.breakHold(entry);
      }
    }
  }

  update(): void {
    if (!this.running || this.paused) return;
    const pos = this.positionMs;

    for (const entry of this.lanes) {
      if (entry.done) continue;
      const { note } = entry;
      const tailEnd = note.t + (note.l ?? 0);

      if (!entry.judged && note.t < pos - WINDOW_MS) {
        // Missed: passed the window without a press.
        entry.judged = true;
        entry.done = true;
        entry.head.visible = false;
        entry.tail.visible = false;
        this.breakCombo('Fallo');
        continue;
      }

      if (entry.holding && pos >= tailEnd) {
        entry.holding = false;
        this.completeHold(entry);
        continue;
      }

      const x = LANE_X[entry.lane];
      const headY = entry.holding ? HIT_Y : HIT_Y - (note.t - pos) * this.pxPerMs;
      entry.head.y = headY;
      entry.head.visible = headY > -60 && headY < 800;

      // Sustain: from the head up to the tail end (clamped to the hit line while held).
      entry.tail.clear();
      if (note.l && note.l > 0) {
        const tailY = HIT_Y - (tailEnd - pos) * this.pxPerMs;
        const top = Math.min(tailY, headY);
        const bottom = entry.holding ? HIT_Y : headY;
        if (bottom - top > 0) {
          entry.tail.rect(x - 12, top, 24, bottom - top).fill({ color: LANE_COLORS[entry.lane], alpha: 0.6 });
        }
        entry.tail.visible = true;
      }
    }

    this.scoreText.text = `Score: ${this.score}  Combo: ${this.combo}  Fallos: ${this.counts.Fallo}`;
  }

  private completeHold(entry: Lane): void {
    entry.done = true;
    entry.head.visible = false;
    entry.tail.visible = false;
    this.score += HOLD_BONUS;
    this.judgeText.text = 'Sostenida';
    this.judgeText.style.fill = 0x36d7f2;
  }

  private breakHold(entry: Lane): void {
    entry.done = true;
    entry.head.visible = false;
    entry.tail.visible = false;
    this.breakCombo('Fallo');
  }

  private addScore(points: number, weight: number, rating: Rating): void {
    this.score += points;
    this.weightSum += weight;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.counts[rating]++;
    this.showJudge(rating);
  }

  private breakCombo(rating: Rating): void {
    this.combo = 0;
    this.counts[rating]++;
    this.showJudge(rating);
  }

  private showJudge(rating: Rating): void {
    const color = rating === 'Fallo' ? 0xf9393f : RATINGS.find((r) => r.name === rating)?.color ?? 0xffffff;
    this.judgeText.text = rating;
    this.judgeText.style.fill = color;
  }
}
