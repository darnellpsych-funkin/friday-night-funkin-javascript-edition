import { Application, Container, Text } from 'pixi.js';
import { Character } from './character';
import { Gameplay, type Stats } from './gameplay';
import { Alphabet } from './alphabet';
import { PauseMenu } from './pause';
import { MainMenu } from './mainmenu';
import { StoryMenu } from './story';
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
// Songs with audio and charts in this project, by difficulty.
const AVAILABLE: Record<string, string[]> = { bopeebo: ['normal'] };
const MENU_SOON = 'Esta sección llega en una fase siguiente';

type Screen = 'menu' | 'story' | 'play';

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({ width: 1280, height: 720, background: '#000000', resizeTo: window });
  document.body.appendChild(app.canvas);

  const status = new Text({
    text: 'Cargando...',
    style: { fill: 0xffffff, fontSize: 18, fontFamily: 'monospace', stroke: { color: 0, width: 3 } },
  });
  status.anchor.set(1, 1);
  app.stage.addChild(status);
  const placeStatus = (): void => {
    status.position.set(app.screen.width - 12, app.screen.height - 12);
  };
  placeStatus();

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

  const mainMenu = await MainMenu.load(app.screen.width, app.screen.height, alphabet);
  const story = await StoryMenu.load();
  story.fit(app.screen.width, app.screen.height);
  app.stage.addChild(mainMenu, story);

  let scheme = loadScheme();
  let offset = loadOffset();
  let screen: Screen = 'menu';
  let playing = { song: 'bopeebo', difficulty: 'normal' };
  let gameplay: Gameplay | null = null;
  let results: Container | null = null;
  let resultsShown = false;
  let pauseMenu: PauseMenu | null = null;

  const schemeLabel = (): string => `Teclas: ${SCHEMES[scheme].name} (Tab)`;
  const offsetLabel = (): string => `Ajuste de audio: ${offset} ms ([ y ])`;
  const updateStatus = (text?: string): void => {
    status.text = text ?? `${schemeLabel()} · ${offsetLabel()}`;
    placeStatus();
  };
  updateStatus();

  const show = (next: Screen): void => {
    screen = next;
    mainMenu.visible = next === 'menu';
    story.visible = next === 'story';
    bf.visible = next === 'play';
  };
  show('menu');

  window.addEventListener('resize', () => {
    story.fit(app.screen.width, app.screen.height);
    placeStatus();
  });

  const showResults = (stats: Stats): void => {
    const box = new Container();
    const lines = [
      'Canción terminada',
      `Score: ${stats.score}`,
      `Precisión: ${stats.accuracy.toFixed(2)}%`,
      `Combo máximo: ${stats.maxCombo}`,
      `Sick ${stats.counts.Sick} · Good ${stats.counts.Good} · Bad ${stats.counts.Bad} · Shit ${stats.counts.Shit} · Fallos ${stats.counts.Fallo}`,
      'Clic o Enter para reiniciar · Esc para el menú',
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

  const start = async (song: string, difficulty: string): Promise<void> => {
    if (gameplay) return;
    if (!AVAILABLE[song]?.includes(difficulty)) {
      story.showNotice(`${song} (${difficulty}) aún no está copiada al proyecto`);
      return;
    }
    await audio.resume();
    playing = { song, difficulty };
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
    show('play');
    gameplay.start();
    updateStatus(`Reproduciendo · ${schemeLabel()} · ${offsetLabel()}`);
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
    pauseMenu = new PauseMenu(app.screen.width, app.screen.height, alphabet, {
      song: metadata.songName ?? 'Bopeebo',
      artist: metadata.artist ?? '',
      difficulty: 'Normal',
    });
    app.stage.addChild(pauseMenu);
  };

  const closePause = (): void => {
    gameplay?.resume();
    removePauseMenu();
  };

  const clearGameplay = (): void => {
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
  };

  const restart = (): void => {
    if (!gameplay) return;
    clearGameplay();
    void start(playing.song, playing.difficulty);
  };

  const exitToMenu = (): void => {
    clearGameplay();
    show('menu');
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
      exitToMenu();
    }
  };

  // Main menu choice: only Story Mode works for now.
  const chooseMenu = (): void => {
    if (mainMenu.choice === 'story') {
      show('story');
      updateStatus();
    } else {
      updateStatus(MENU_SOON);
    }
  };

  // Story mode: start the first song of the selected week.
  const playStory = (): void => {
    void start(story.firstSong, story.difficulty);
  };

  window.addEventListener('pointerdown', () => {
    if (pauseMenu) activatePause();
    else if (gameplay?.finished) restart();
    else if (screen === 'menu') chooseMenu();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      // Cycle schemes only outside a song, so the keys don't change mid-song.
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

    if (!gameplay) {
      if (e.key === '[' || e.key === ']') {
        const delta = e.key === ']' ? OFFSET_STEP : -OFFSET_STEP;
        offset = Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, offset + delta));
        saveOffset(offset);
        updateStatus();
        return;
      }
      if (screen === 'menu') {
        if (e.key === 'ArrowUp') mainMenu.move(-1);
        else if (e.key === 'ArrowDown') mainMenu.move(1);
        else if (e.key === 'Enter') chooseMenu();
      } else if (screen === 'story') {
        if (e.key === 'ArrowUp') story.moveWeek(-1);
        else if (e.key === 'ArrowDown') story.moveWeek(1);
        else if (e.key === 'ArrowLeft') story.moveDifficulty(-1);
        else if (e.key === 'ArrowRight') story.moveDifficulty(1);
        else if (e.key === 'Enter') playStory();
        else if (e.key === 'Escape') {
          show('menu');
          updateStatus();
        }
      }
      return;
    }

    if (e.key === 'Enter' && gameplay.finished) {
      restart();
      return;
    }
    const lane = laneFor(e.key, scheme);
    if (lane !== undefined) gameplay.press(lane);
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
      showResults(gameplay.stats);
    }
  });
}

boot().catch((err) => {
  console.error(err);
  document.body.textContent = `Error: ${String(err)}`;
});
