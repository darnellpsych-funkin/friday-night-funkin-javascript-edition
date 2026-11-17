import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { AnimatedProp, type PropData } from './props';

// Story mode layout is designed for 1280x720 and scaled to the window.
const W = 1280;
const H = 720;
const BANNER = { x: 48, y: 80, w: 1184, h: 380 };
const LEVEL_IDS = ['tutorial', 'week1'];
const DIFFICULTIES = ['easy', 'normal', 'hard', 'erect', 'nightmare'];
const BASE = '/ui/story-mode';
const PINK = 0xff7ba8;

interface LevelJson {
  name: string;
  background: string;
  songs: string[];
  props: PropData[];
}

interface Level {
  id: string;
  name: string;
  color: number;
  songs: string[];
  title: Texture;
  props: Array<{ data: PropData; prop: AnimatedProp }>;
}

/** Story mode: week banner, props, track list, and difficulty selector. */
export class StoryMenu extends Container {
  private view = new Container(); // 1280x720 coordinate space
  private layer = new Container(); // rebuilt when the week changes
  private levels: Level[] = [];
  private difficultyArt = new Map<string, Texture>();
  private arrows: { left: AnimatedProp; right: AnimatedProp } | null = null;
  private week = 0;
  private diffIndex = DIFFICULTIES.indexOf('normal');
  private notice = new Text({
    text: '',
    style: { fill: 0xffd23f, fontSize: 22, fontFamily: 'monospace', fontWeight: 'bold', stroke: { color: 0, width: 4 } },
  });

  static async load(): Promise<StoryMenu> {
    const menu = new StoryMenu();
    menu.addChild(menu.view);

    menu.view.addChild(new Graphics().rect(0, 0, W, H).fill(0x000000));
    menu.view.addChild(menu.layer);

    for (const id of LEVEL_IDS) {
      const data = (await (await fetch(`${BASE}/levels/${id}.json`)).json()) as LevelJson;
      const props = [];
      for (const p of data.props) {
        const prop = await AnimatedProp.load(p.assetPath, p.animations);
        props.push({ data: p, prop });
      }
      menu.levels.push({
        id,
        name: data.name,
        color: parseInt(data.background.replace('#', ''), 16),
        songs: data.songs,
        title: await Assets.load<Texture>(`${BASE}/levels/${id}.png`),
        props,
      });
    }

    for (const d of DIFFICULTIES) {
      menu.difficultyArt.set(d, await Assets.load<Texture>(`${BASE}/difficulties/${d}.png`));
    }

    const left = await AnimatedProp.load('ui/story-mode/arrows', [
      { name: 'left', prefix: 'leftIdle', looped: true },
    ]);
    const right = await AnimatedProp.load('ui/story-mode/arrows', [
      { name: 'right', prefix: 'rightIdle', looped: true },
    ]);
    menu.arrows = { left, right };
    menu.view.addChild(left, right);
    menu.view.addChild(menu.notice);
    menu.notice.position.set(40, 650);

    menu.render();
    return menu;
  }

  get currentLevel(): Level {
    return this.levels[this.week];
  }

  get difficulty(): string {
    return DIFFICULTIES[this.diffIndex];
  }

  /** The song that Enter would start (the first one in the week). */
  get firstSong(): string {
    return this.currentLevel.songs[0];
  }

  /** Scales the 1280x720 layout to fit the window and centres it. */
  fit(width: number, height: number): void {
    const s = Math.min(width / W, height / H);
    this.view.scale.set(s);
    this.view.position.set((width - W * s) / 2, (height - H * s) / 2);
  }

  moveWeek(delta: number): void {
    this.week = (this.week + delta + this.levels.length) % this.levels.length;
    this.render();
  }

  moveDifficulty(delta: number): void {
    this.diffIndex = (this.diffIndex + delta + DIFFICULTIES.length) % DIFFICULTIES.length;
    this.render();
  }

  showNotice(message: string): void {
    this.notice.text = message;
  }

  private render(): void {
    const level = this.currentLevel;
    this.layer.removeChildren();
    this.view.removeChildren(); // rebuilt below, keeps the child order simple
    this.view.addChild(new Graphics().rect(0, 0, W, H).fill(0x000000));

    // Top bar.
    const score = new Text({
      text: 'LEVEL SCORE: 0',
      style: { fill: 0xffffff, fontSize: 34, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    score.position.set(40, 20);
    const title = new Text({
      text: level.name,
      style: { fill: 0xbbbbbb, fontSize: 34, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    title.anchor.set(1, 0);
    title.position.set(W - 40, 20);

    // Banner with the week's characters.
    this.layer.addChild(new Graphics().rect(BANNER.x, BANNER.y, BANNER.w, BANNER.h).fill(level.color));
    for (const { data, prop } of level.props) {
      const [ox, oy] = data.offsets ?? [0, 0];
      prop.scale.set((data.scale ?? 1) * 0.7);
      prop.position.set(BANNER.x + ox, BANNER.y + oy);
      prop.play(data.startingAnimation ?? data.animations[0].name);
      this.layer.addChild(prop);
    }

    // Track list.
    const tracks = new Text({
      text: 'TRACKS',
      style: { fill: PINK, fontSize: 30, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    tracks.position.set(120, 500);
    this.layer.addChild(tracks);
    level.songs.forEach((song, i) => {
      const label = new Text({
        text: song.charAt(0).toUpperCase() + song.slice(1),
        style: { fill: PINK, fontSize: 34, fontFamily: 'monospace' },
      });
      label.position.set(120, 545 + i * 48);
      this.layer.addChild(label);
    });

    // Week title art and week label.
    const art = new Sprite(level.title);
    const artScale = 360 / level.title.width;
    art.scale.set(artScale);
    art.position.set(610, 492);
    this.layer.addChild(art);

    const weekLabel = new Text({
      text: `WEEK ${this.week + 1}`,
      style: { fill: 0x7f7f7f, fontSize: 80, fontFamily: 'monospace', fontWeight: 'bold' },
    });
    weekLabel.anchor.set(0.5);
    weekLabel.position.set(840, 630);
    this.layer.addChild(weekLabel);

    // Difficulty selector.
    const diffArt = new Sprite(this.difficultyArt.get(this.difficulty) ?? Texture.EMPTY);
    diffArt.anchor.set(0.5);
    diffArt.scale.set(190 / Math.max(1, diffArt.texture.width));
    diffArt.position.set(1150, 580);
    this.layer.addChild(diffArt);
    if (this.arrows) {
      this.arrows.left.centerAt(1072, 580, 'left');
      this.arrows.right.centerAt(1232, 580, 'right');
      this.arrows.left.freeze('left');
      this.arrows.right.freeze('right');
      this.layer.addChild(this.arrows.left, this.arrows.right);
    }

    const hint = new Text({
      text: '↑↓ semana · ←→ dificultad · Enter jugar · Esc volver',
      style: { fill: 0xffffff, fontSize: 20, fontFamily: 'monospace', stroke: { color: 0, width: 3 } },
    });
    hint.anchor.set(0.5, 1);
    hint.position.set(W / 2, H - 14);

    this.view.addChild(this.layer, score, title, hint, this.notice);
    this.notice.text = '';
  }
}
