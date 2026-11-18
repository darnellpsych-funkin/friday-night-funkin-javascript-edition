// Juicio de notas. Usa el módulo WebAssembly escrito en Rust (rust-judge/)
// si se pudo cargar; si no, usa la misma lógica en TypeScript.

interface JudgeExports {
  judge(diffMs: number): number;
}

const TS_WINDOWS = [45, 90, 135, 166];
let wasm: JudgeExports | null = null;

function tsJudge(diffMs: number): number {
  const diff = Math.abs(diffMs);
  for (let i = 0; i < TS_WINDOWS.length; i++) {
    if (diff <= TS_WINDOWS[i]) return i;
  }
  return 4;
}

/** Intenta cargar wasm/judge.wasm. Devuelve true si quedó activo. Nunca lanza. */
export async function loadJudge(): Promise<boolean> {
  try {
    const url = new URL('wasm/judge.wasm', document.baseURI).href;
    const res = await fetch(url);
    if (!res.ok) return false;
    const { instance } = await WebAssembly.instantiate(await res.arrayBuffer(), {});
    wasm = instance.exports as unknown as JudgeExports;
    return true;
  } catch {
    wasm = null;
    return false;
  }
}

/** 0 = Sick, 1 = Good, 2 = Bad, 3 = Shit, 4 = fuera de ventana. */
export function judgeIndex(diffMs: number): number {
  return wasm ? wasm.judge(diffMs) : tsJudge(diffMs);
}

export function judgeUsesWasm(): boolean {
  return wasm !== null;
}
