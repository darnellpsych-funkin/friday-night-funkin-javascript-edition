import { Application, Container, Text } from 'pixi.js';
import { Character } from './character';
import { Gameplay } from './gameplay';
import { loadAudio, loadChart } from './song';

// Arrow keys mapped to player lanes (0 left, 1 down, 2 up, 3 right).
const KEY_TO_LANE: Record<string, number> = {
  ArrowLeft: 0,
  ArrowDown: 1,
  ArrowUp: 2,
  ArrowRight: 3,
};

const SING_ANIMS = ['singLEFT', 'singDOWN', 'singUP', 'singRIGHT'];
const SONG_PATH = '/songs/bopeebo';

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ width: 1280, height: 720, background: '#f2a43a', resizeTo: window });
  document.body.appendChild(app.canvas);

  const title = new Text({
    text: "Friday Night Funkin' JavaScript Edition",
    style: { fill: 0x000000, fontSize: 28, fontFamily: 'sans-serif' },
  });
  title.position.set(24, 24);
  app.stage.addChild(title);

  const status = new Text({
    text: 'Cargando...',
    style: { fill: 0x000000, fontSize: 22, fontFamily: 'sans-serif' },
  });
  status.position.set(24, 64);
  app.stage.addChild(status);

  const bf = await Character.load('/characters/bf');
  bf.position.set(1000, 80);
  bf.scale.set(0.5);
  app.stage.addChild(bf);

  const audio = new AudioContext();
  const [{ notes, speed }, inst, voices] = await Promise.all([
    loadChart(`${SONG_PATH}/bopeebo-chart.json`, 'normal'),
    loadAudio(audio, `${SONG_PATH}/Inst.ogg`),
    loadAudio(audio, `${SONG_PATH}/Voices-bf.ogg`),
  ]);

  status.text = `Bopeebo (normal): ${notes.length} notas · haz clic para empezar`;

  let gameplay: Gameplay | null = null;
  let results: Container | null = null;
  let resultsShown = false;

  const showResults = (g: Gameplay): void => {
    const s = g.stats;
    const box = new Container();
    const lines = [
      'Canción terminada',
      `Score: ${s.score}`,
      `Precisión: ${s.accuracy.toFixed(2)}%`,
      `Combo máximo: ${s.maxCombo}`,
      `Sick ${s.counts.Sick} · Good ${s.counts.Good} · Bad ${s.counts.Bad} · Shit ${s.counts.Shit} · Fallos ${s.counts.Fallo}`,
      'Clic o Enter para reiniciar',
    ];
    lines.forEach((text, i) => {
      const t = new Text({
        text,
        style: { fill: 0xffffff, fontSize: i === 0 ? 40 : 26, fontFamily: 'sans-serif' },
      });
      t.position.set(40, 200 + i * 56);
      box.addChild(t);
    });
    app.stage.addChild(box);
    results = box;
  };

  const start = async (): Promise<void> => {
    if (gameplay) return;
    await audio.resume();
    gameplay = new Gameplay(audio, notes, speed, inst, voices, (lane) => {
      bf.play(SING_ANIMS[lane]);
    });
    app.stage.addChild(gameplay);
    gameplay.start();
    status.text = 'Reproduciendo';
  };

  const restart = (): void => {
    if (!gameplay) return;
    gameplay.stopSong();
    app.stage.removeChild(gameplay);
    gameplay.destroy({ children: true });
    gameplay = null;
    resultsShown = false;
    if (results) {
      app.stage.removeChild(results);
      results.destroy({ children: true });
      results = null;
    }
    void start();
  };

  const onPrimary = (): void => {
    if (gameplay?.finished) restart();
    else void start();
  };

  window.addEventListener('pointerdown', onPrimary);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'Enter' && gameplay?.finished) {
      restart();
      return;
    }
    const lane = KEY_TO_LANE[e.key];
    if (lane === undefined) return;
    if (!gameplay) {
      void start();
      return;
    }
    gameplay.press(lane);
  });

  window.addEventListener('keyup', (e) => {
    const lane = KEY_TO_LANE[e.key];
    if (lane !== undefined) gameplay?.release(lane);
  });

  app.ticker.add(() => {
    if (!gameplay) return;
    gameplay.update();
    if (gameplay.finished && !resultsShown) {
      resultsShown = true;
      gameplay.stopSong();
      status.text = 'Fin';
      showResults(gameplay);
    }
  });

}

boot().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${String(err)}`;
});
