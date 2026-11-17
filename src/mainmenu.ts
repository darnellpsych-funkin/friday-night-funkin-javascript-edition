import { Assets, Container, Sprite, Text, Texture } from 'pixi.js';
import { AnimatedProp } from './props';

const BASE = '/ui/main-menu';
const ITEMS = [
  { id: 'story', asset: 'story-mode', prefix: 'storymode' },
  { id: 'freeplay', asset: 'freeplay', prefix: 'freeplay' },
  { id: 'merch', asset: 'upgrade', prefix: 'upgrade' },
  { id: 'options', asset: 'options', prefix: 'options' },
] as const;

export type MenuChoice = (typeof ITEMS)[number]['id'];

/** Main menu: background, four animated buttons and the version line. */
export class MainMenu extends Container {
  private items: AnimatedProp[] = [];
  private selected = 0;

  static async load(width: number, height: number): Promise<MainMenu> {
    const menu = new MainMenu();
    const bg = new Sprite(await Assets.load<Texture>(`${BASE}/menu-bg.png`));
    bg.width = width;
    bg.height = height;
    menu.addChild(bg);

    const gap = 150;
    const top = 170;
    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];
      const prop = await AnimatedProp.load(`ui/main-menu/items/${item.asset}`, [
        { name: 'idle', prefix: `${item.prefix} idle`, looped: true, frameRate: 24 },
        { name: 'selected', prefix: `${item.prefix} selected`, looped: true, frameRate: 24 },
      ]);
      prop.centerAt(width / 2, top + i * gap, 'idle');
      menu.items.push(prop);
      menu.addChild(prop);
    }

    const version = new Text({
      text: 'v0.5.1 (develop : e66290c) PROTOTYPE',
      style: { fill: 0xffffff, fontSize: 18, fontFamily: 'monospace', stroke: { color: 0x000000, width: 3 } },
    });
    version.position.set(12, height - 32);
    menu.addChild(version);

    menu.refresh();
    return menu;
  }

  get choice(): MenuChoice {
    return ITEMS[this.selected].id;
  }

  move(delta: number): void {
    this.selected = (this.selected + delta + ITEMS.length) % ITEMS.length;
    this.refresh();
  }

  private refresh(): void {
    this.items.forEach((prop, i) => prop.play(i === this.selected ? 'selected' : 'idle'));
  }
}
