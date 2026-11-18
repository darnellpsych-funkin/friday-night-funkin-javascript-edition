import { Assets, Container, Matrix, Rectangle, Sprite, Texture } from 'pixi.js';

// Adobe Animate texture-atlas export (Animation.json + spritemap1.json/png).
// Matrices are [a, b, c, d, tx, ty] and map points as x' = a*x + c*y + tx.
type Mat = [number, number, number, number, number, number];

interface Element {
  SI?: { SN: string; FF?: number; LP?: string; MX: Mat };
  ASI?: { N: string; MX: Mat };
}
interface Frame {
  I: number;
  DU: number;
  N?: string;
  E?: Element[];
}
interface Timeline {
  L: Array<{ LN: string; FR: Frame[] }>;
}
interface Symbol {
  SN: string;
  TL: Timeline;
}

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** Returns parent ∘ child: apply child first, then parent. */
function compose(p: Mat, c: Mat): Mat {
  return [
    p[0] * c[0] + p[2] * c[1],
    p[1] * c[0] + p[3] * c[1],
    p[0] * c[2] + p[2] * c[3],
    p[1] * c[2] + p[3] * c[3],
    p[0] * c[4] + p[2] * c[5] + p[4],
    p[1] * c[4] + p[3] * c[5] + p[5],
  ];
}

/** Loaded Animate atlas: symbols, sprite textures and the labels of the root timeline. */
export class AnimateAtlas {
  readonly symbols = new Map<string, Symbol>();
  readonly sprites = new Map<string, Texture>();
  readonly labels = new Map<string, { start: number; dur: number }>();
  readonly root: Symbol;
  readonly fps: number;

  private constructor(root: Symbol, fps: number) {
    this.root = root;
    this.fps = fps;
  }

  static async load(basePath: string): Promise<AnimateAtlas> {
    const anim = await (await fetch(`/${basePath}/Animation.json`)).json();
    const map = await (await fetch(`/${basePath}/spritemap1.json`)).json();
    const sheet = await Assets.load<Texture>(`/${basePath}/${map.meta.image}`);

    const root: Symbol = { SN: anim.AN.SN ?? 'root', TL: anim.AN.TL };
    const atlas = new AnimateAtlas(root, anim.MD?.FRT ?? 24);

    for (const sym of anim.SD?.S ?? []) atlas.symbols.set(sym.SN, sym);
    for (const { SPRITE } of map.ATLAS.SPRITES) {
      const frame = new Rectangle(SPRITE.x, SPRITE.y, SPRITE.w, SPRITE.h);
      // Rotated sprites are stored turned 90 degrees in the sheet.
      const texture = new Texture({ source: sheet.source, frame, rotate: SPRITE.rotated ? 2 : 0 });
      atlas.sprites.set(SPRITE.name, texture);
    }

    // Labels are frame names on the root timeline (e.g. "Idle", "Up").
    for (const layer of root.TL.L) {
      for (const f of layer.FR) {
        if (f.N && !atlas.labels.has(f.N)) atlas.labels.set(f.N, { start: f.I, dur: f.DU });
      }
    }
    return atlas;
  }

  /** Length in frames of a symbol's timeline. */
  lengthOf(sym: Symbol): number {
    let end = 1;
    for (const layer of sym.TL.L) {
      for (const f of layer.FR) end = Math.max(end, f.I + f.DU);
    }
    return end;
  }
}

/** Animated character: draws the atlas at a given frame and plays labelled animations. */
export class AnimateCharacter extends Container {
  private frame = 0;
  private current = '';
  private end = 0;
  private loop = true;
  private lastDrawn = -1;
  private accumulator = 0;
  private pendingLabel: string | null = null;
  private idleLabel: string;
  private renderedChildren: Sprite[] = [];
  onComplete: (() => void) | null = null;

  constructor(private atlas: AnimateAtlas, idleLabel: string) {
    super();
    this.idleLabel = idleLabel;
    this.play(idleLabel, true);
  }

  /** Plays a label from the atlas. Non-looping labels call onComplete when done. */
  play(label: string, loop = false): void {
    const info = this.atlas.labels.get(label);
    if (!info) return;
    this.current = label;
    this.frame = info.start;
    this.end = info.start + info.dur;
    this.loop = loop;
    this.accumulator = 0;
    this.lastDrawn = -1;
  }

  /** Advances the animation by the given milliseconds and redraws if the frame changed. */
  update(dtMs: number): void {
    this.accumulator += dtMs * (this.atlas.fps / 1000);
    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      this.frame++;
      if (this.frame >= this.end) {
        if (this.loop) {
          this.frame = this.atlasLabelStart();
        } else {
          this.onComplete?.();
          this.play(this.idleLabel, true);
          break;
        }
      }
    }
    if (this.frame !== this.lastDrawn) this.draw();
  }

  private atlasLabelStart(): number {
    return this.atlas.labels.get(this.current)?.start ?? 0;
  }

  private draw(): void {
    for (const s of this.renderedChildren) s.destroy();
    this.renderedChildren = [];
    this.removeChildren();
    this.collect(this.atlas.root, this.frame, IDENTITY);
    this.lastDrawn = this.frame;
  }

  /** Adds sprites for one symbol at one frame, transformed by the parent matrix. */
  private collect(sym: Symbol, frame: number, m: Mat): void {
    // Layers are listed top to bottom; draw the bottom ones first.
    for (const layer of [...sym.TL.L].reverse()) {
      const fr = layer.FR.find((f) => frame >= f.I && frame < f.I + f.DU);
      if (!fr?.E) continue;
      for (const el of fr.E) {
        if (el.SI) {
          const child = this.atlas.symbols.get(el.SI.SN);
          if (!child) continue;
          const elapsed = frame - fr.I;
          const len = this.atlas.lengthOf(child);
          const first = el.SI.FF ?? 0;
          const childFrame = el.SI.LP === 'SF' ? first : (first + elapsed) % len;
          this.collect(child, childFrame, compose(m, el.SI.MX));
        } else if (el.ASI) {
          const texture = this.atlas.sprites.get(el.ASI.N);
          if (!texture) continue;
          const total = compose(m, el.ASI.MX);
          const sprite = new Sprite(texture);
          sprite.setFromMatrix(new Matrix(total[0], total[1], total[2], total[3], total[4], total[5]));
          this.addChild(sprite);
          this.renderedChildren.push(sprite);
        }
      }
    }
  }
}
