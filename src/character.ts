import { AnimatedSprite, Assets, Container, Rectangle, Texture } from 'pixi.js';
import { groupByPrefix, parseSparrow, type AtlasFrame } from './sparrow';

// Maps game animation names to atlas prefixes (same mapping as Psych/V-Slice Boyfriend).
const ANIMATIONS: Record<string, string> = {
  idle: 'BF idle dance',
  singLEFT: 'BF NOTE LEFT',
  singDOWN: 'BF NOTE DOWN',
  singUP: 'BF NOTE UP',
  singRIGHT: 'BF NOTE RIGHT',
  singLEFTmiss: 'BF NOTE LEFT MISS',
  singDOWNmiss: 'BF NOTE DOWN MISS',
  singUPmiss: 'BF NOTE UP MISS',
  singRIGHTmiss: 'BF NOTE RIGHT MISS',
};

interface Anim {
  sprite: AnimatedSprite;
  offsets: Array<{ x: number; y: number }>;
}

export class Character extends Container {
  private anims = new Map<string, Anim>();
  private current: Anim | null = null;
  private currentName = '';

  /** Loads the atlas XML and its image, and builds one AnimatedSprite per animation. */
  static async load(basePath: string): Promise<Character> {
    const xml = await (await fetch(`${basePath}/bf.xml`)).text();
    const atlas = parseSparrow(xml);
    const baseTexture = await Assets.load<Texture>(`${basePath}/${atlas.imagePath}`);
    const groups = groupByPrefix(atlas.frames);

    const character = new Character();
    for (const [animName, prefix] of Object.entries(ANIMATIONS)) {
      const frames = groups.get(prefix);
      if (!frames || frames.length === 0) {
        console.warn(`[Character] missing animation "${prefix}"`);
        continue;
      }
      character.addAnimation(animName, frames, baseTexture);
    }
    character.play('idle');
    return character;
  }

  private addAnimation(name: string, frames: AtlasFrame[], base: Texture): void {
    const textures = frames.map(
      (f) =>
        new Texture({
          source: base.source,
          frame: new Rectangle(f.x, f.y, f.width, f.height),
        }),
    );
    const sprite = new AnimatedSprite(textures);
    sprite.animationSpeed = 24 / 60; // 24 fps at a 60 Hz ticker
    sprite.loop = name === 'idle';
    sprite.stop();
    sprite.visible = false;
    this.addChild(sprite);

    // Trimmed frames are drawn offset by -frameX/-frameY so they stay aligned.
    const offsets = frames.map((f) => ({ x: -f.frameX, y: -f.frameY }));
    this.anims.set(name, { sprite, offsets });
  }

  /** Plays an animation. Sing animations return to idle when they finish. */
  play(name: string): void {
    const anim = this.anims.get(name);
    if (!anim) return;
    if (this.current) this.current.sprite.visible = false;

    this.current = anim;
    this.currentName = name;
    anim.sprite.visible = true;
    anim.sprite.onFrameChange = (frame: number) => {
      const off = anim.offsets[frame] ?? { x: 0, y: 0 };
      anim.sprite.position.set(off.x, off.y);
    };
    anim.sprite.onComplete = () => {
      if (name !== 'idle') this.play('idle');
    };
    anim.sprite.gotoAndPlay(0);
  }

  get animationName(): string {
    return this.currentName;
  }
}
