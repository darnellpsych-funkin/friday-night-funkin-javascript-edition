import { AnimatedSprite, Assets, Container, Rectangle, Texture } from 'pixi.js';
import { parseSparrow, type AtlasFrame } from './sparrow';

/** One animation of a prop, as written in the story level JSON. */
export interface AnimDef {
  name: string;
  prefix: string;
  frameIndices?: number[];
  frameRate?: number;
  looped?: boolean;
}

/** A prop (character or decoration) placed on a story level banner. */
export interface PropData {
  assetPath: string; // e.g. "ui/story-mode/props/bf", without extension
  offsets?: [number, number];
  scale?: number;
  startingAnimation?: string;
  animations: AnimDef[];
}

/** Sparrow-atlas sprite with named animations. Frames are picked by name prefix. */
export class AnimatedProp extends Container {
  private anims = new Map<string, AnimatedSprite>();
  private current: AnimatedSprite | null = null;

  static async load(assetPath: string, defs: AnimDef[]): Promise<AnimatedProp> {
    const xml = await (await fetch(`/${assetPath}.xml`)).text();
    const atlas = parseSparrow(xml);
    const dir = assetPath.slice(0, assetPath.lastIndexOf('/') + 1);
    const base = await Assets.load<Texture>(`/${dir}${atlas.imagePath}`);

    const prop = new AnimatedProp();
    for (const def of defs) {
      const matches = atlas.frames
        .filter((f) => f.name.startsWith(def.prefix))
        .sort((a, b) => a.name.localeCompare(b.name));
      const chosen = def.frameIndices
        ? def.frameIndices.map((i) => matches[i]).filter((f): f is AtlasFrame => f !== undefined)
        : matches;
      if (chosen.length === 0) {
        console.warn(`[AnimatedProp] no frames for "${def.prefix}" in ${assetPath}`);
        continue;
      }
      prop.addAnimation(def, chosen, base);
    }
    return prop;
  }

  private addAnimation(def: AnimDef, frames: AtlasFrame[], base: Texture): void {
    const textures = frames.map(
      (f) => new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.width, f.height) }),
    );
    const sprite = new AnimatedSprite(textures);
    sprite.animationSpeed = (def.frameRate ?? 24) / 60;
    sprite.loop = def.looped ?? true;
    sprite.visible = false;
    sprite.stop();
    const offsets = frames.map((f) => ({ x: -f.frameX, y: -f.frameY }));
    sprite.onFrameChange = (frame: number) => {
      const off = offsets[frame] ?? { x: 0, y: 0 };
      sprite.position.set(off.x, off.y);
    };
    this.anims.set(def.name, sprite);
    this.addChild(sprite);
  }

  /** Moves the prop so the centre of its first frame sits at (x, y). */
  centerAt(x: number, y: number, animation?: string): void {
    const sprite = animation ? this.anims.get(animation) : this.anims.values().next().value;
    const frame = sprite?.texture.frame;
    const w = frame?.width ?? 0;
    const h = frame?.height ?? 0;
    this.position.set(x - w / 2, y - h / 2);
  }

  /** Plays one animation and hides the rest. */
  play(name: string): void {
    const sprite = this.anims.get(name);
    if (!sprite) return;
    if (this.current) this.current.visible = false;
    this.current = sprite;
    sprite.visible = true;
    sprite.gotoAndPlay(0);
  }

  /** Shows one frame of an animation without playing it (used for arrows). */
  freeze(name: string): void {
    this.play(name);
    this.current?.stop();
  }
}
