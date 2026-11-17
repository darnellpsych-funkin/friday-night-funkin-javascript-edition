import { Application, Text } from 'pixi.js';
import { SongClock } from './clock';
import { Character } from './character';

// Keys that trigger the sing animations for each lane.
const KEYS: Record<string, string> = {
  ArrowLeft: 'singLEFT',
  ArrowDown: 'singDOWN',
  ArrowUp: 'singUP',
  ArrowRight: 'singRIGHT',
};

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ width: 1280, height: 720, background: '#f2a43a', resizeTo: window });
  document.body.appendChild(app.canvas);

  const label = new Text({
    text: "Friday Night Funkin' JavaScript Edition",
    style: { fill: 0x000000, fontSize: 28, fontFamily: 'sans-serif' },
  });
  label.x = 24;
  label.y = 24;
  app.stage.addChild(label);

  const bf = await Character.load('/characters/bf');
  bf.position.set(app.screen.width * 0.7, app.screen.height * 0.45);
  bf.scale.set(0.6);
  app.stage.addChild(bf);

  const hint = new Text({
    text: 'Flechas: cantar · idle al terminar',
    style: { fill: 0x000000, fontSize: 20, fontFamily: 'sans-serif' },
  });
  hint.x = 24;
  hint.y = 64;
  app.stage.addChild(hint);

  // Browsers keep AudioContext suspended until a user gesture, so the clock
  // starts on the first key press or click.
  const audio = new AudioContext();
  const clock = new SongClock(audio);
  let started = false;
  const startClock = async (): Promise<void> => {
    if (started) return;
    started = true;
    await audio.resume();
    clock.start();
  };

  window.addEventListener('pointerdown', () => void startClock());
  window.addEventListener('keydown', (e) => {
    void startClock();
    const anim = KEYS[e.key];
    if (anim && !e.repeat) bf.play(anim);
  });

  app.ticker.add(() => {
    label.text = `FNF JS · ${clock.positionMs().toFixed(0)} ms · ${bf.animationName}`;
  });
}

boot();
