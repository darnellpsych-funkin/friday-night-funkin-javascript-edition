import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { groupByPrefix, parseSparrow } from './sparrow';

// Atlas names for characters that are not plain letters or digits.
const SPECIAL: Record<string, string> = {
  '!': 'exclamation point',
  '?': 'question mark',
  '.': 'period',
  ',': 'comma',
  "'": 'apostraphie',
  '/': 'forward slash',
  '&': 'amp',
};

const BASELINE = 70; // approximate glyph height in the atlas, in pixels

/** Bold letters from the original game's font (alphabet.png / alphabet.xml). */
export class Alphabet {
  private glyphs = new Map<string, Texture>();

  static async load(basePath: string): Promise<Alphabet> {
    const xml = await (await fetch(`${basePath}/alphabet.xml`)).text();
    const atlas = parseSparrow(xml);
    const base = await Assets.load<Texture>(`${basePath}/${atlas.imagePath}`);

    const alphabet = new Alphabet();
    for (const [name, frames] of groupByPrefix(atlas.frames)) {
      const f = frames[0];
      alphabet.glyphs.set(
        name,
        new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.width, f.height) }),
      );
    }
    return alphabet;
  }

  /** Builds a line of text. Accents are dropped (e.g. "ó" becomes "o"). */
  text(value: string, scale = 1): Container {
    const line = new Container();
    let x = 0;
    for (const raw of value) {
      const char = raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (char === ' ') {
        x += 28 * scale;
        continue;
      }
      const texture = this.glyph(char);
      if (!texture) continue;
      const sprite = new Sprite(texture);
      sprite.scale.set(scale);
      // Align glyphs on a shared baseline so mixed heights line up.
      sprite.position.set(x, (BASELINE - texture.height) * scale);
      line.addChild(sprite);
      x += texture.width * scale * 0.92;
    }
    return line;
  }

  private glyph(char: string): Texture | null {
    let name: string;
    if (/[A-Z]/.test(char)) name = `${char} bold`;
    else if (/[a-z]/.test(char)) name = `${char} lowercase`;
    else if (/[0-9]/.test(char)) name = `${char}`;
    else name = SPECIAL[char] ?? char;
    return this.glyphs.get(name) ?? null;
  }
}
