import { Application, Container, Text } from 'pixi.js';
import { Character } from './character';
import { Gameplay } from './gameplay';
import { Alphabet } from './alphabet';
import { PauseMenu } from './pause';
import { loadAudio, loadChart } from './song';

// Player lanes: 0 left, 1 down, 2 up, 3 right. Arrows always work; the
// extra keys for each scheme are added on top. Letters are lowercased.
const ARROWS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const SCHEMES: Array<{ name: string; keys: string[] }> = [
  { name: 'Solo flechas', keys: [] },
  { name: 'Flechas + WASD', keys: ['a', 's', 'w', 'd'] },
  { name: 'Flechas + DFJK', keys: ['d', 'f', 'j', 'k'] },
  { name: 'Flechas + ASKL', keys: ['a', 's', 'k', 'l'] },
];
const SCHEME_KEY = 'bambi-js-scheme';
const OFFSET_KEY = 'bambi-js-offset';
const OFFSET_STEP = 10; // ms per [ or ] press
const OFFSET_LIMIT = 300; // ms, either direction

function loadOffset(): number {
  try {
    const value = Number(localStorage.getItem(OFFSET_KEY));
    return Number.isFinite(value) ? Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, value)) : 0;
  } catch {
    return 0;
  }
}

function saveOffset(value: number): void {
  try {
    localStorage.setItem(OFFSET_KEY, String(value));
  } catch {
    // Ignore: the setting just won't persist.
  }
}

function loadScheme(): number {
  try {
    const value = Number(localStorage.getItem(SCHEME_KEY));
    return Number.isInteger(value) && value >= 0 && value < SCHEMES.length ? value : 0;
  } catch {
    return 0; // Storage can be blocked (private windows).
  }
}

function saveScheme(index: number): void {
  try {
    localStorage.setItem(SCHEME_KEY, String(index));
  } catch {
    // Ignore: the choice just won't persist.
  }
}

function laneFor(key: string, scheme: number): number | undefined {
  const normalized = key.length === 1 ? key.toLowerCase() : key;
  const arrow = ARROWS.indexOf(normalized);
  if (arrow >= 0) return arrow;
  const extra = SCHEMES[scheme].keys.indexOf(normalized);
  return extra >= 0 ? extra : undefined;
}

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
  const alphabet = await Alphabet.load('/ui');
  const metadata = (await (await fetch(`${SONG_PATH}/bopeebo-metadata.json`)).json()) as {
    songName?: string;
    artist?: string;
  };
  const songInfo = {
    song: metadata.songName ?? 'Bopeebo',
    artist: metadata.artist ?? '',
    difficulty: 'Normal',
  };

  let scheme = loadScheme();
  let offset = loadOffset();
  const schemeLabel = (): string =>
    `Teclas: ${SCHEMES[scheme].name} (Tab para cambiar)`;
  const offsetLabel = (): string => `Ajuste de audio: ${offset} ms ([ y ] para cambiar)`;
  const updateStatus = (): void => {
    status.text = `Bopeebo (normal): ${notes.length} notas · ${schemeLabel()} · ${offsetLabel()} · clic para empezar`;
  };
  updateStatus();

  let gameplay: Gameplay | null = null;
  let results: Container | null = null;
  let resultsShown = false;
  let pauseMenu: PauseMenu | null = null;

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
    gameplay = new Gameplay(
      audio,
      notes,
      speed,
      inst,
      voices,
      (lane) => {
        bf.play(SING_ANIMS[lane]);
      },
      offset,
    );
    app.stage.addChild(gameplay);
    gameplay.start();
    status.text = `Reproduciendo · ${schemeLabel()} · ${offsetLabel()}`;
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

  const removePauseMenu = (): void => {
    if (!pauseMenu) return;
    app.stage.removeChild(pauseMenu);
    pauseMenu.destroy({ children: true });
    pauseMenu = null;
  };

  const openPause = (): void => {
    if (!gameplay || gameplay.finished || gameplay.isPaused) return;
    gameplay.pause();
    pauseMenu = new PauseMenu(app.screen.width, app.screen.height, alphabet, songInfo);
    app.stage.addChild(pauseMenu);
  };

  const closePause = (): void => {
    gameplay?.resume();
    removePauseMenu();
  };

  const exitToTitle = (): void => {
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
    updateStatus();
  };

  // Runs the option highlighted in the pause menu.
  const activatePause = (): void => {
    if (!pauseMenu) return;
    const choice = pauseMenu.current;
    if (choice === 0) {
      closePause();
    } else if (choice === 1) {
      removePauseMenu();
      restart();
    } else {
      removePauseMenu();
      exitToTitle();
    }
  };

  const onPrimary = (): void => {
    if (gameplay?.finished) restart();
    else void start();
  };

  window.addEventListener('pointerdown', () => {
    if (pauseMenu) activatePause();
    else onPrimary();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      // Cycle schemes only before the song starts, so the keys don't change mid-song.
      e.preventDefault();
      if (!gameplay) {
        scheme = (scheme + 1) % SCHEMES.length;
        saveScheme(scheme);
        updateStatus();
      }
      return;
    }
    if (e.repeat) return;
    if (gameplay?.isPaused) {
      if (e.key === 'ArrowUp') pauseMenu?.move(-1);
      else if (e.key === 'ArrowDown') pauseMenu?.move(1);
      else if (e.key === 'Enter') activatePause();
      else if (e.key === 'Escape') closePause();
      return;
    }
    if (gameplay && !gameplay.finished && (e.key === 'Enter' || e.key === 'Escape')) {
      openPause();
      return;
    }
    if (!gameplay && (e.key === '[' || e.key === ']')) {
      // Audio offset, adjusted only before the song starts.
      const delta = e.key === ']' ? OFFSET_STEP : -OFFSET_STEP;
      offset = Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, offset + delta));
      saveOffset(offset);
      updateStatus();
      return;
    }
    if (e.key === 'Enter' && gameplay?.finished) {
      restart();
      return;
    }
    const lane = laneFor(e.key, scheme);
    if (lane === undefined) return;
    if (!gameplay) {
      void start();
      return;
    }
    gameplay.press(lane);
  });

  window.addEventListener('keyup', (e) => {
    const lane = laneFor(e.key, scheme);
    if (lane !== undefined) gameplay?.release(lane);
  });

  app.ticker.add(() => {
    if (!gameplay || gameplay.isPaused) return;
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
