export interface ColorDef {
  name: string;
  hex: string;
  /** Pairs with everything without penalty. */
  neutral: boolean;
  metallic?: boolean;
  /** Hue in degrees for non-neutrals (harmony math). */
  hue?: number;
}

export const COLOR_DEFS: ColorDef[] = [
  { name: "black", hex: "#211E1B", neutral: true },
  { name: "white", hex: "#F6F4EE", neutral: true },
  { name: "cream", hex: "#EDE4D2", neutral: true },
  { name: "grey", hex: "#9B9893", neutral: true },
  { name: "beige", hex: "#D8C8AB", neutral: true },
  { name: "camel", hex: "#B3865A", neutral: true },
  { name: "brown", hex: "#6C4A33", neutral: true },
  { name: "navy", hex: "#26334E", neutral: true },
  { name: "denim", hex: "#54718F", neutral: true },
  { name: "olive", hex: "#6F6A45", neutral: true },
  { name: "sage", hex: "#9BA88D", neutral: false, hue: 105 },
  { name: "green", hex: "#4C6B4B", neutral: false, hue: 122 },
  { name: "blue", hex: "#3F6CB3", neutral: false, hue: 218 },
  { name: "red", hex: "#A93030", neutral: false, hue: 0 },
  { name: "burgundy", hex: "#6F2437", neutral: false, hue: 345 },
  { name: "pink", hex: "#D9A5B3", neutral: false, hue: 342 },
  { name: "purple", hex: "#6E5581", neutral: false, hue: 276 },
  { name: "yellow", hex: "#D9B23F", neutral: false, hue: 47 },
  { name: "orange", hex: "#C87C40", neutral: false, hue: 27 },
  { name: "gold", hex: "#B8913F", neutral: true, metallic: true },
  { name: "silver", hex: "#B9BCC0", neutral: true, metallic: true },
];

export const COLOR_NAMES = COLOR_DEFS.map((c) => c.name);

const BY_NAME = new Map(COLOR_DEFS.map((c) => [c.name, c]));

export function colorDef(name: string): ColorDef {
  return BY_NAME.get(name) ?? COLOR_DEFS[0];
}

export function colorHex(name: string): string {
  return colorDef(name).hex;
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const PALETTE_RGB = COLOR_DEFS.map((c) => ({ name: c.name, rgb: hexRgb(c.hex) }));

/** Perceptual-ish distance ("redmean"). */
function dist(a: [number, number, number], b: [number, number, number]): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export function nearestColorName(r: number, g: number, b: number): string {
  let best = "black";
  let bd = Infinity;
  for (const p of PALETTE_RGB) {
    // Skip metallics in pixel matching — they read as beige/grey anyway.
    if (p.name === "gold" || p.name === "silver") continue;
    const d = dist([r, g, b], p.rgb);
    if (d < bd) {
      bd = d;
      best = p.name;
    }
  }
  return best;
}

/**
 * Detect the dominant palette colors of a garment image.
 * Works with transparent (bg-removed) images and, as a fallback for opaque
 * photos, discards whatever color dominates the border (the backdrop).
 */
export async function detectColors(blob: Blob): Promise<string[]> {
  const bmp = await createImageBitmap(blob);
  const S = 56;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, S, S);
  bmp.close();
  const data = ctx.getImageData(0, 0, S, S).data;

  // Border histogram → likely backdrop color for opaque photos.
  const borderTally = new Map<string, number>();
  let borderTotal = 0;
  const tallyPx = (i: number, map: Map<string, number>) => {
    const a = data[i + 3];
    if (a < 24) return false;
    map.set(nearestColorName(data[i], data[i + 1], data[i + 2]), (map.get(nearestColorName(data[i], data[i + 1], data[i + 2])) ?? 0) + 1);
    return true;
  };
  for (let x = 0; x < S; x++) {
    for (const y of [0, 1, S - 2, S - 1]) {
      if (tallyPx((y * S + x) * 4, borderTally)) borderTotal++;
    }
  }
  for (let y = 2; y < S - 2; y++) {
    for (const x of [0, 1, S - 2, S - 1]) {
      if (tallyPx((y * S + x) * 4, borderTally)) borderTotal++;
    }
  }
  let backdrop: string | null = null;
  for (const [name, n] of borderTally) {
    if (borderTotal > 40 && n / borderTotal > 0.6) backdrop = name;
  }

  const tally = new Map<string, number>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 40) continue; // transparent → not garment
    const name = nearestColorName(data[i], data[i + 1], data[i + 2]);
    if (backdrop && name === backdrop) continue;
    tally.set(name, (tally.get(name) ?? 0) + 1);
    total++;
  }
  if (total === 0) return ["grey"];
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const out: string[] = [];
  for (const [name, n] of sorted) {
    if (out.length === 0 || (n / total > 0.16 && out.length < 2)) out.push(name);
  }
  return out;
}

export interface HarmonyResult {
  pts: number; // 0..22
  tag: string | null;
}

function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Score the color chemistry of a whole look (primary color per piece).
 * Neutrals are the luxury baseline; hue relationships add or subtract.
 */
export function outfitHarmony(colorsPerPiece: string[][]): HarmonyResult {
  const primaries = colorsPerPiece.filter((c) => c.length > 0).map((c) => colorDef(c[0]));
  if (primaries.length < 2) return { pts: 12, tag: null };

  const nonNeutral = primaries.filter((c) => !c.neutral && c.hue !== undefined);
  const families = new Set(nonNeutral.map((c) => Math.round((c.hue ?? 0) / 30)));

  if (nonNeutral.length === 0) {
    return { pts: 20, tag: "tonal neutrals" };
  }
  if (nonNeutral.length === 1) {
    return { pts: 18, tag: `${nonNeutral[0].name} against neutrals` };
  }

  // Pairwise hue relationships between accent colors.
  let sum = 0;
  let pairs = 0;
  let bestTag: string | null = null;
  for (let i = 0; i < nonNeutral.length; i++) {
    for (let j = i + 1; j < nonNeutral.length; j++) {
      const d = hueDiff(nonNeutral[i].hue!, nonNeutral[j].hue!);
      pairs++;
      if (d <= 40) {
        sum += 16;
        bestTag = bestTag ?? "analogous accents";
      } else if (d >= 150 && d <= 210) {
        sum += 14;
        bestTag = bestTag ?? "complementary accents";
      } else if (d >= 90) {
        sum += 8;
      } else {
        sum += 3;
        bestTag = "clashing accents";
      }
    }
  }
  let pts = sum / pairs;
  if (families.size > 2) {
    pts -= 7;
    bestTag = "busy palette";
  }
  return { pts: Math.max(0, Math.round(pts)), tag: bestTag };
}
