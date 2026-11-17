import { Container, Graphics, Text } from 'pixi.js';

// Same options as the original game's pause screen.
const ITEMS = ['Reanudar', 'Reiniciar canción', 'Salir a la pantalla principal'];

/** Pause overlay: a dark shade with three options chosen with ↑/↓ and Enter. */
export class PauseMenu extends Container {
  private texts: Text[] = [];
  private selected = 0;

  constructor(width: number, height: number) {
    super();
    this.addChild(new Graphics().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.7 }));

    const title = new Text({
      text: 'PAUSA',
      style: { fill: 0xffffff, fontSize: 64, fontFamily: 'sans-serif', fontWeight: 'bold' },
    });
    title.anchor.set(0.5);
    title.position.set(width / 2, height * 0.3);
    this.addChild(title);

    ITEMS.forEach((_, i) => {
      const text = new Text({ text: '', style: { fill: 0xffffff, fontSize: 40, fontFamily: 'sans-serif' } });
      text.anchor.set(0.5);
      text.position.set(width / 2, height * 0.5 + i * 64);
      this.texts.push(text);
      this.addChild(text);
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
    this.texts.forEach((text, i) => {
      const on = i === this.selected;
      text.text = on ? `> ${ITEMS[i]} <` : ITEMS[i];
      text.style.fill = on ? 0xffd23f : 0xa79fae;
    });
  }
}
