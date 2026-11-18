// Loads a V-Slice style chart and decodes the song audio.

/** One note from a chart. `d` 0-3 is the opponent, 4-7 is the player. */
export interface ChartNote {
  t: number; // time in ms
  d: number; // raw lane index
  l?: number; // hold length in ms (not used yet)
}

export interface Chart {
  scrollSpeed: Record<string, number>;
  notes: Record<string, ChartNote[]>;
}

/** Player lane (0 left, 1 down, 2 up, 3 right) for a note, or -1 for opponent notes. */
export function playerLane(note: ChartNote): number {
  return note.d >= 4 ? note.d - 4 : -1;
}

/** Opponent lane (0-3) for a note, or -1 for player notes. */
export function opponentLane(note: ChartNote): number {
  return note.d < 4 ? note.d : -1;
}

export async function loadChart(
  path: string,
  difficulty: string,
): Promise<{ notes: ChartNote[]; opponent: ChartNote[]; speed: number }> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Chart not found: ${path} (${response.status})`);
  const chart = (await response.json()) as Chart;

  const notes = chart.notes[difficulty];
  if (!notes) throw new Error(`Difficulty "${difficulty}" missing in ${path}`);

  const speed = chart.scrollSpeed[difficulty] ?? 1;
  const sorted = [...notes].sort((a, b) => a.t - b.t);
  return {
    notes: sorted.filter((n) => playerLane(n) >= 0),
    opponent: sorted.filter((n) => opponentLane(n) >= 0),
    speed,
  };
}

export async function loadAudio(ctx: AudioContext, path: string): Promise<AudioBuffer> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Audio not found: ${path} (${response.status})`);
  return ctx.decodeAudioData(await response.arrayBuffer());
}
