// Parses a Sparrow/Starling TextureAtlas XML (the format used by bf.xml).
export interface AtlasFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frameX: number;
  frameY: number;
}

export interface SparrowAtlas {
  imagePath: string;
  frames: AtlasFrame[];
}

export function parseSparrow(xml: string): SparrowAtlas {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.querySelector('TextureAtlas');
  if (!root) throw new Error('Invalid Sparrow atlas: missing TextureAtlas root');

  const frames: AtlasFrame[] = [];
  for (const el of Array.from(root.querySelectorAll('SubTexture'))) {
    frames.push({
      name: el.getAttribute('name') ?? '',
      x: Number(el.getAttribute('x') ?? 0),
      y: Number(el.getAttribute('y') ?? 0),
      width: Number(el.getAttribute('width') ?? 0),
      height: Number(el.getAttribute('height') ?? 0),
      frameX: Number(el.getAttribute('frameX') ?? 0),
      frameY: Number(el.getAttribute('frameY') ?? 0),
    });
  }
  return { imagePath: root.getAttribute('imagePath') ?? '', frames };
}

/** Groups frames by animation prefix, e.g. "BF NOTE LEFT0003" -> "BF NOTE LEFT". Keeps order. */
export function groupByPrefix(frames: AtlasFrame[]): Map<string, AtlasFrame[]> {
  const groups = new Map<string, AtlasFrame[]>();
  for (const frame of frames) {
    const match = /^(.*?)(\d{4})$/.exec(frame.name);
    const prefix = match ? match[1] : frame.name;
    const list = groups.get(prefix) ?? [];
    list.push(frame);
    groups.set(prefix, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}
