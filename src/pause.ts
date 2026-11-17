import { Container, Graphics, Text } from 'pixi.js';
import type { Alphabet } from './alphabet';

// Same options as the original game's pause screen.
// Uppercase glyphs are the bold style used by the original menus.
const ITEMS = ['REANUDAR', 'REINICIAR CANCION', 'SALIR AL MENU'];

export interface SongInfo {
  song: string;
  artist: string;
  difficulty: string;
}

/** Pause overlay: dimmed game, song info top-right, and bold options. */
export class PauseMenu extends Container {
  private items: Container[] = [];
  private selected = 0;

  constructor(width: number, height: number, alphabet: Alphabet, info: SongInfo) {
    super();
    this.addChild(new Graphics().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.6 }));

    const details = new Text({
      text: `${info.song}\nArtist: ${info.artist}\nDifficulty: ${info.difficulty}`,
      style: {
        fill: 0xffffff,
        fontSize: 26,
        fontFamily: 'monospace',
        fontWeight: 'bold',
        align: 'right',
        stroke: { color: 0x000000, width: 4 },
      },
    });
    details.anchor.set(1, 0);
    details.position.set(width - 24, 20);
    this.addChild(details);

    ITEMS.forEach((label, i) => {
      const line = alphabet.text(label, 0.9);
      line.position.set(width / 2 - line.width / 2, height * 0.4 + i * 110);
      this.items.push(line);
      this.addChild(line);
    });
    this.refresh();
  }

  /** Index of the highlighted option. */
  get current(): number {
    return this.selected;
  }

  move(delta: number): void {
    this.selected = (this.selected + delta + ITEMS.length) % ITEMS.length;
    this.refresh();
  }

  private refresh(): void {
    this.items.forEach((line, i) => {
      line.alpha = i === this.selected ? 1 : 0.5;
    });
  }
}
